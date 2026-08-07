-- Drop the WhatsApp notification intent (ADR-023).
--
-- The client decided against the Meta Cloud API: it needs Business Verification, a
-- WABA, a registered number, a System User token and an approved template, and email
-- already delivers every lead reliably. Rather than leave a channel that can only ever
-- record `skipped`, the function now writes one intent row instead of two.
--
-- Everything else is byte-identical to 20260806100600_fn_create_inquiry.sql. Replacing
-- the function rather than patching it keeps the current definition readable in one
-- file, which matters for something this load-bearing.
--
-- The `notification_log_channel_valid` CHECK still permits 'whatsapp'. Deliberate: a
-- constraint that allows an unused value costs nothing, and re-adding a channel later
-- should not require a schema migration — only an adapter.

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

    -- The email intent, written inside the same transaction so the channel can never
    -- be silently forgotten. The notification service updates this row after the
    -- commit; it cannot affect the order.
    insert into public.notification_log (order_id, channel, status)
    values (v_order_id, 'email', 'pending');
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
  'Atomically creates one order, its items, and one pending notification_log row for the email channel. Idempotent on idempotency_key: a replay returns the original order with created = false.';

-- CREATE OR REPLACE preserves privileges, but they are restated so this file is a
-- complete description of the function's access rather than a diff against an
-- earlier migration.
revoke all on function public.create_inquiry(jsonb) from public;
revoke all on function public.create_inquiry(jsonb) from anon;
revoke all on function public.create_inquiry(jsonb) from authenticated;
grant execute on function public.create_inquiry(jsonb) to service_role;
