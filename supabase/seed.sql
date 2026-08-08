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

-- coa_url points at a published certificate in `public/coa/`, named for the slug. Null
-- for a compound whose certificate the client has not supplied yet; the lab-testing page
-- lists only the rows that have one.
insert into public.products (
  slug, name, category, strength_mg, price_cents, is_blend, featured, sort_order, coa_url
)
values
  -- $6.00/mg
  ('retatrutide-10mg',  'Retatrutide',  'peptide',  10,    6000,  false, true,  10,  '/coa/retatrutide-10mg.jpg'),
  -- $5.00/mg
  ('bpc-157-10mg',      'BPC-157',      'peptide',  10,    5000,  false, true,  20,  '/coa/bpc-157-10mg.jpg'),
  -- $8.00/mg
  ('tesamorelin-5mg',   'Tesamorelin',  'peptide',  5,     4000,  false, false, 30,  '/coa/tesamorelin-5mg.jpg'),
  -- $0.60/mg — copper peptide, arguably 'cosmetic'; category to confirm
  ('ghk-cu-50mg',       'GHK-Cu',       'peptide',  50,    3000,  false, true,  40,  null),
  -- $6.00/mg
  ('mots-c-10mg',       'MOTS-c',       'peptide',  10,    6000,  false, false, 50,  '/coa/mots-c-10mg.jpg'),
  -- $5.00/mg
  ('kpv-10mg',          'KPV',          'peptide',  10,    5000,  false, false, 60,  null),
  -- $0.0333/mg, displays as $0.03
  ('glutathione-1500mg','Glutathione',  'peptide',  1500,  5000,  false, false, 70,  null),
  -- $6.00/mg
  ('ss-31-10mg',        'SS-31',        'peptide',  10,    6000,  false, false, 80,  '/coa/ss-31-10mg.jpg'),
  -- $0.11/mg
  ('nad-plus-500mg',    'NAD+',         'peptide',  500,   5500,  false, true,  90,  '/coa/nad-plus-500mg.jpg'),
  -- $1.125/mg, displays as $1.13. Category stays 'blend', but is_blend is false so
  -- the cost-per-mg figure is shown: the client asked for it on 8 Aug 2026.
  ('k-l-o-w-80mg',      'K-L-O-W',      'blend',    80,    9000,  false, false, 100, '/coa/k-l-o-w-80mg.jpg'),
  -- $3.3333/mg, displays as $3.33
  ('tirzepatide-30mg',  'Tirzepatide',  'peptide',  30,    10000, false, true,  110, '/coa/tirzepatide-30mg.jpg'),
  -- $4.50/mg
  ('ipamorelin-10mg',   'Ipamorelin',   'peptide',  10,    4500,  false, false, 120, null)
on conflict (slug) do update set
  name        = excluded.name,
  category    = excluded.category,
  strength_mg = excluded.strength_mg,
  price_cents = excluded.price_cents,
  is_blend    = excluded.is_blend,
  coa_url     = excluded.coa_url,
  featured    = excluded.featured,
  sort_order  = excluded.sort_order,
  -- Revive a previously archived row rather than leaving it hidden.
  status      = 'active',
  deleted_at  = null;
