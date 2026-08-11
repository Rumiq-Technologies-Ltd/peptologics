-- Coupon discounts on inquiries.
--
-- `discount_cents` is what the server computed from its own coupon table against its
-- own subtotal. The request cannot express an amount — only a code — so this column
-- records a figure the application derived, exactly like subtotal_cents (ADR-005).
--
-- `coupon_code` is the canonical code that was actually applied, not what the visitor
-- typed. An unrecognised code applies nothing and leaves this null, so the column is a
-- record of discounts given rather than of text submitted.
--
-- `total_cents` is generated rather than written: it is subtotal minus discount by
-- definition, and a stored copy is a chance for the three to disagree.
--
-- Reversal:
--   alter table public.orders
--     drop column total_cents,
--     drop constraint orders_discount_within_subtotal,
--     drop column discount_cents,
--     drop column coupon_code;
alter table public.orders
  add column if not exists coupon_code text
    check (coupon_code is null or length(btrim(coupon_code)) between 1 and 40),
  add column if not exists discount_cents integer not null default 0
    check (discount_cents >= 0);

-- A discount larger than the order it applies to would produce a negative total.
alter table public.orders
  drop constraint if exists orders_discount_within_subtotal;

alter table public.orders
  add constraint orders_discount_within_subtotal
  check (discount_cents <= subtotal_cents);

alter table public.orders
  add column if not exists total_cents integer
  generated always as (subtotal_cents - discount_cents) stored;

comment on column public.orders.coupon_code is
  'Canonical coupon code actually applied by the server, or null. Never the raw text submitted.';
comment on column public.orders.discount_cents is
  'Computed server-side from the coupon table and subtotal_cents. Never taken from the request payload.';
comment on column public.orders.total_cents is
  'Generated: subtotal_cents - discount_cents. Read-only.';
