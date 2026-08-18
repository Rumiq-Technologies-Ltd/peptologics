-- Adds the customer confirmation intent to create_inquiry (ADR-027).
--
-- Everything else is byte-identical to 20260811140500_create_inquiry_with_coupon.sql.
-- Replacing the function rather than patching it keeps the current definition readable
-- in one file, which matters for something this load-bearing.
--
-- The only change is the notification_log insert: it now writes one pending row per
-- channel, `email` and `customer_email`, in a single statement. Both are written inside
-- the order's transaction for the same reason the first one always was — a channel whose
-- intent row is missing is a channel that can be silently forgotten, and there is then
-- nothing in the dead-letter list to say a customer was never confirmed.
--
-- The function still does not decide the discount. It stores what the service computed,
-- the same way it already stores subtotal_cents — Postgres has no view of the coupon table
-- and should not grow one. The coalesce on discount_cents covers a caller that omits
-- the key entirely, so an older deploy posting the previous payload shape still
-- succeeds with no discount rather than failing a NOT NULL.
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
    coupon_code,
    discount_cents,
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
    nullif(btrim(coalesce(p_payload->>'coupon_code', '')), ''),
    coalesce((p_payload->>'discount_cents')::integer, 0),
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

    -- Both notification intents, written inside the same transaction so neither channel
    -- can be silently forgotten. The notification service updates these rows after the
    -- commit; it cannot affect the order.
    --
    -- `email` is the internal notification to the company. `customer_email` is the
    -- confirmation to the person who submitted the form (ADR-027).
    insert into public.notification_log (order_id, channel, status)
    values
      (v_order_id, 'email', 'pending'),
      (v_order_id, 'customer_email', 'pending');
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
  'Atomically creates one order, its items, and one pending notification_log row per channel (email, customer_email). Stores the coupon code and discount the application computed; it does not evaluate coupons itself. Idempotent on idempotency_key: a replay returns the original order with created = false and notifies nobody again.';

-- CREATE OR REPLACE preserves privileges, but they are restated so this file is a
-- complete description of the function's access rather than a diff against an
-- earlier migration.
revoke all on function public.create_inquiry(jsonb) from public;
revoke all on function public.create_inquiry(jsonb) from anon;
revoke all on function public.create_inquiry(jsonb) from authenticated;
grant execute on function public.create_inquiry(jsonb) to service_role;
