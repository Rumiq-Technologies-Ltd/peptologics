-- Product catalog seed.
--
-- Source: the client's price list poster (public/assets/product list.jpeg).
--
-- Idempotent: keyed on `slug`, so re-running is safe and a price correction can
-- be made by editing this file and running it again.
--
-- `description` is deliberately NULL for every row. Product copy for these
-- compounds is regulated-adjacent and must be written or approved by the client,
-- not generated. Tracked as open question 1 in docs/decisions.md.
--
-- Prices are integer cents. cost_per_mg is a generated column and is NOT set
-- here — Postgres derives it. The expected values, all of which are exactly
-- price / strength, are noted per row so a future edit can be sanity-checked.

insert into public.products (
  slug, name, category, strength_mg, price_cents, is_blend, featured, sort_order
)
values
  -- $6.00/mg
  ('retatrutide-10mg',  'Retatrutide',  'peptide',  10,    6000,  false, true,  10),
  -- $5.00/mg
  ('bpc-157-10mg',      'BPC-157',      'peptide',  10,    5000,  false, true,  20),
  -- $6.50/mg
  ('tesamorelin-10mg',  'Tesamorelin',  'peptide',  10,    6500,  false, false, 30),
  -- $0.60/mg — copper peptide, arguably 'cosmetic'; category to confirm
  ('ghk-cu-50mg',       'GHK-Cu',       'peptide',  50,    3000,  false, true,  40),
  -- $5.00/mg
  ('mots-c-10mg',       'MOTS-c',       'peptide',  10,    5000,  false, false, 50),
  -- $5.00/mg
  ('kpv-10mg',          'KPV',          'peptide',  10,    5000,  false, false, 60),
  -- $5.00/mg
  ('glutathione-10mg',  'Glutathione',  'peptide',  10,    5000,  false, false, 70),
  -- $6.00/mg
  ('ss-31-10mg',        'SS-31',        'peptide',  10,    6000,  false, false, 80),
  -- $0.11/mg
  ('nad-plus-500mg',    'NAD+',         'peptide',  500,   5500,  false, true,  90),
  -- $0.9375/mg, displays as $0.94. Multi-peptide blend: composition unknown, so
  -- cost-per-mg is suppressed in the UI via is_blend.
  ('k-l-o-w-80mg',      'K-L-O-W',      'blend',    80,    7500,  true,  false, 100),
  -- $3.3333/mg, displays as $3.33
  ('tirzepatide-30mg',  'Tirzepatide',  'peptide',  30,    10000, false, true,  110),
  -- $4.50/mg
  ('ipamorelin-10mg',   'Ipamorelin',   'peptide',  10,    4500,  false, false, 120)
on conflict (slug) do update set
  name        = excluded.name,
  category    = excluded.category,
  strength_mg = excluded.strength_mg,
  price_cents = excluded.price_cents,
  is_blend    = excluded.is_blend,
  featured    = excluded.featured,
  sort_order  = excluded.sort_order,
  -- Revive a previously archived row rather than leaving it hidden.
  status      = 'active',
  deleted_at  = null;
