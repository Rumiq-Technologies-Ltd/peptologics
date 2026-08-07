-- Customer inquiries.
--
-- Named `orders` to match CLAUDE.md, but nothing here is a purchase: no payment
-- is taken on the website. A row is a lead that a representative follows up
-- manually, and `subtotal_cents` is an indicative figure, not an invoice total.

-- Human-readable reference for the follow-up call. Starts at 1000 so the first
-- inquiry reads PL-001000 rather than PL-000001.
create sequence public.order_number_seq as bigint start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),

  order_number text not null default (
    'PL-' || lpad(nextval('public.order_number_seq')::text, 6, '0')
  ),

  -- Client-generated per form mount. The UNIQUE constraint plus
  -- ON CONFLICT DO NOTHING in create_inquiry() is the whole idempotency
  -- mechanism: a double-click or a network retry yields one row, one email.
  idempotency_key uuid not null,

  -- Customer details. Required set confirmed by the client; apartment and notes
  -- are the only optional fields.
  customer_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  apartment text,
  city text not null,
  state text not null,
  zip_code text not null,
  country char(2) not null default 'US',
  notes text,

  -- Computed server-side from products.price_cents, never from the request
  -- payload (ADR-005). The inquiry schema has no price field at all.
  subtotal_cents integer not null,
  currency char(3) not null default 'USD',
  item_count integer not null,

  status text not null default 'new',

  -- When the visitor accepted the Research-Use-Only gate. Null for inquiries
  -- created before the gate shipped.
  ruo_acknowledged_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint orders_order_number_unique unique (order_number),
  constraint orders_idempotency_key_unique unique (idempotency_key),

  constraint orders_status_valid check (
    status in ('new', 'contacted', 'confirmed', 'cancelled', 'completed')
  ),
  constraint orders_subtotal_nonnegative check (subtotal_cents >= 0),
  constraint orders_item_count_positive check (item_count > 0),

  -- Deliberately permissive. Real validation is the Zod schema; this exists to
  -- stop obviously malformed data reaching storage, not to police RFC 5322.
  constraint orders_email_format check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint orders_email_length check (length(email) between 5 and 254),
  constraint orders_name_length check (length(btrim(customer_name)) between 1 and 200),
  constraint orders_phone_length check (length(btrim(phone)) between 7 and 32),
  constraint orders_address_length check (length(btrim(address)) between 1 and 300),
  constraint orders_city_length check (length(btrim(city)) between 1 and 120),
  constraint orders_state_length check (length(btrim(state)) between 2 and 100),
  constraint orders_zip_length check (length(btrim(zip_code)) between 3 and 20),
  constraint orders_notes_length check (notes is null or length(notes) <= 2000),
  constraint orders_apartment_length check (apartment is null or length(apartment) <= 120)
);

comment on table public.orders is
  'Customer inquiries. Not purchases — no payment is processed. subtotal_cents is indicative and confirmed by a representative.';
comment on column public.orders.idempotency_key is
  'Client-generated UUID, stable per form mount. Replaying it returns the original order without re-notifying.';
comment on column public.orders.subtotal_cents is
  'Computed server-side from products.price_cents. Never taken from the request payload.';

-- The operator view: newest inquiries first.
create index orders_created_at_idx on public.orders (created_at desc) where deleted_at is null;

-- Working the pipeline: new -> contacted -> confirmed.
create index orders_status_idx on public.orders (status, created_at desc) where deleted_at is null;

-- Recognising a returning customer.
create index orders_email_idx on public.orders (email) where deleted_at is null;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------
-- Enabled with NO policies, which denies everything to anon and authenticated.
-- Only service_role — used server-side on the write path — can reach this table.
-- Customer PII must never be readable with a key that could reach a browser.

alter table public.orders enable row level security;
