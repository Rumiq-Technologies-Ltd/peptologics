-- One row per product line on an inquiry.
--
-- Stored as rows rather than a JSON blob on `orders` so lines can be aggregated,
-- constrained, and joined — CLAUDE.md is explicit about this.

create table public.order_items (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null,
  product_id uuid not null,

  -- Snapshot of the product at inquiry time. Denormalised on purpose: a rename
  -- or a repricing must not rewrite history, and the follow-up call needs to
  -- show what the customer actually saw.
  product_name text not null,
  product_slug text not null,
  strength_mg numeric(10, 3) not null,

  quantity integer not null,
  unit_price_cents integer not null,
  subtotal_cents integer not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_items_order_fk
    foreign key (order_id) references public.orders (id) on delete cascade,

  -- RESTRICT, not CASCADE or SET NULL: a product that appears on a historical
  -- inquiry must not be deletable. Retire it with status = 'archived' instead.
  constraint order_items_product_fk
    foreign key (product_id) references public.products (id) on delete restrict,

  -- Quantity is carried on one row, so the same product cannot appear twice.
  constraint order_items_one_row_per_product unique (order_id, product_id),

  constraint order_items_quantity_range check (quantity between 1 and 99),
  constraint order_items_unit_price_positive check (unit_price_cents > 0),
  constraint order_items_strength_positive check (strength_mg > 0),

  -- The invariant integer cents exist to make possible. Any drift between the
  -- line total and its parts is rejected at the storage layer.
  constraint order_items_subtotal_matches check (subtotal_cents = unit_price_cents * quantity)
);

comment on table public.order_items is
  'Product lines on an inquiry. Name, slug and strength are point-in-time snapshots so a later rename or repricing does not rewrite history.';

create index order_items_order_id_idx on public.order_items (order_id);

-- "Which products are most requested?" — the obvious first reporting question.
create index order_items_product_id_idx on public.order_items (product_id);

create trigger order_items_set_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();

-- RLS: enabled with no policies. Line items are as sensitive as the order.
alter table public.order_items enable row level security;
