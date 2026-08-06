-- The product catalog.
--
-- Prices are integer cents (ADR-002): PostgREST serialises `numeric` as a JSON
-- string, so a numeric price would arrive in TypeScript as "60.00" and force
-- float parsing back into subtotal arithmetic. Integer cents stay exact.

create table public.products (
  id uuid primary key default gen_random_uuid(),

  slug text not null,
  name text not null,
  description text,
  category text not null default 'peptide',

  -- Milligrams per vial. numeric, not integer, so a future sub-milligram
  -- product needs no migration.
  strength_mg numeric(10, 3) not null,
  price_cents integer not null,

  -- Derived, never written directly (ADR-003). Stored rather than computed in
  -- the application so "sort by best value per mg" can be an ORDER BY.
  -- numeric(10,4) keeps K-L-O-W's true 0.9375/mg honest; display rounds to 2.
  cost_per_mg numeric(10, 4) generated always as (
    price_cents::numeric / 100 / strength_mg
  ) stored,

  -- Cost per mg is not comparable across a multi-peptide blend and a single
  -- peptide, so the figure is suppressed in the UI when this is true.
  is_blend boolean not null default false,

  featured boolean not null default false,
  sort_order integer not null default 0,

  image_url text,
  coa_url text,

  status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint products_slug_unique unique (slug),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_name_not_blank check (length(btrim(name)) between 1 and 200),
  constraint products_strength_positive check (strength_mg > 0),
  constraint products_price_positive check (price_cents > 0),
  constraint products_sort_order_nonnegative check (sort_order >= 0),
  constraint products_status_valid check (status in ('active', 'out_of_stock', 'archived')),
  constraint products_category_valid check (category in ('peptide', 'blend', 'cosmetic', 'supply'))
);

comment on table public.products is
  'Research peptide catalog. Prices are indicative list pricing; a representative confirms final pricing per inquiry.';
comment on column public.products.cost_per_mg is
  'Generated: price_cents / 100 / strength_mg. Read-only. PostgREST returns this as a string — coerced once in product.mappers.ts, display only.';
comment on column public.products.status is
  'active | out_of_stock | archived. Only `active` rows are visible to anon.';

-- The catalog listing query: active products in display order.
create index products_status_sort_idx
  on public.products (status, sort_order, name)
  where deleted_at is null;

-- The home page featured strip.
create index products_featured_idx
  on public.products (sort_order)
  where featured and status = 'active' and deleted_at is null;

-- "Best value per mg" sorting.
create index products_cost_per_mg_idx
  on public.products (cost_per_mg)
  where status = 'active' and deleted_at is null;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------
-- The browser never talks to Supabase; reads go through the repository layer
-- using the anon key server-side. RLS is therefore a second layer behind the
-- repository's own filters rather than the only line of defence.

alter table public.products enable row level security;

create policy products_public_read on public.products
  for select
  to anon, authenticated
  using (status = 'active' and deleted_at is null);
