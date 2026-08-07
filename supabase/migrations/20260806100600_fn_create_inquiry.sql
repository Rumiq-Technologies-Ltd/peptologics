-- The atomicity guarantee (ADR-004).
--
-- The Supabase JS client cannot express a multi-statement transaction over
-- PostgREST, so inserting one `orders` row followed by N `order_items` rows is
-- not atomic from application code. A compensating delete on failure was
-- rejected: that is a distributed-transaction pattern which can itself fail,
-- leaving exactly the orphaned state it was meant to prevent.
--
-- Everything below runs in one implicit transaction. Either the order, all its
-- items, and both notification intents exist, or none of them do.
--
-- This function makes no business decisions. Prices are already resolved by the
-- service layer from products.price_cents; this is purely the write the client
-- library cannot express.

create or replace function public.create_inquiry(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_created boolean := false;
  v_item_count integer;
begin
  if p_payload is null or p_payload->>'idempotency_key' is null then
    raise exception 'create_inquiry: idempotency_key is required';
  end if;

  if jsonb_typeof(p_payload->'items') is distinct from 'array'
     or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'create_inquiry: items must be a non-empty array';
  end if;

  v_item_count := jsonb_array_length(p_payload->'items');

  insert into public.orders (
    idempotency_key,
    customer_name,
    email,
    phone,
    address,
    apartment,
    city,
    state,
    zip_code,
    country,
    notes,
    subtotal_cents,
    item_count,
    ruo_acknowledged_at
  )
  values (
    (p_payload->>'idempotency_key')::uuid,
    p_payload->'customer'->>'name',
    p_payload->'customer'->>'email',
    p_payload->'customer'->>'phone',
    p_payload->'customer'->>'address',
    nullif(btrim(coalesce(p_payload->'customer'->>'apartment', '')), ''),
    p_payload->'customer'->>'city',
    p_payload->'customer'->>'state',
    p_payload->'customer'->>'zip_code',
    coalesce(p_payload->'customer'->>'country', 'US'),
    nullif(btrim(coalesce(p_payload->'customer'->>'notes', '')), ''),
    (p_payload->>'subtotal_cents')::integer,
    v_item_count,
    (p_payload->>'ruo_acknowledged_at')::timestamptz
  )
  -- The replay path. DO NOTHING leaves v_order_id null, which is how we detect
  -- a duplicate submission below.
  on conflict (idempotency_key) do nothing
  returning id, order_number into v_order_id, v_order_number;

  if v_order_id is not null then
    v_created := true;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      product_slug,
      strength_mg,
      quantity,
      unit_price_cents,
      subtotal_cents
    )
    select
      v_order_id,
      (item->>'product_id')::uuid,
      item->>'product_name',
      item->>'product_slug',
      (item->>'strength_mg')::numeric,
      (item->>'quantity')::integer,
      (item->>'unit_price_cents')::integer,
      (item->>'subtotal_cents')::integer
    from jsonb_array_elements(p_payload->'items') as item;

    -- Notification intents, written inside the same transaction so a channel can
    -- never be silently forgotten. The notification service updates these rows
    -- after the commit; it cannot affect the order.
    insert into public.notification_log (order_id, channel, status)
    values (v_order_id, 'email', 'pending'), (v_order_id, 'whatsapp', 'pending');
  else
    -- Duplicate idempotency key: return the original order so the caller can
    -- show the same confirmation without creating or notifying twice.
    select o.id, o.order_number
      into v_order_id, v_order_number
      from public.orders as o
     where o.idempotency_key = (p_payload->>'idempotency_key')::uuid;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'created', v_created
  );
end;
$$;

comment on function public.create_inquiry is
  'Atomically creates one order, its items, and one pending notification_log row per channel. Idempotent on idempotency_key: a replay returns the original order with created = false.';

-- Least privilege. Functions are executable by PUBLIC by default, so the grant
-- must be revoked explicitly. Only the service role — used server-side on the
-- write path — may create an inquiry.
revoke all on function public.create_inquiry(jsonb) from public;
revoke all on function public.create_inquiry(jsonb) from anon;
revoke all on function public.create_inquiry(jsonb) from authenticated;
grant execute on function public.create_inquiry(jsonb) to service_role;
