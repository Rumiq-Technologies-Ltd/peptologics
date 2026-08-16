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
-- image_url points at a vial photograph in `public/products/`, named for the slug.
-- Every row has one; a null would render the placeholder rather than break.
insert into public.products (
  slug, name, category, strength_mg, price_cents, is_blend, featured, sort_order, coa_url,
  image_url
)
--
-- Where a compound is stocked in two vial sizes, the sizes sit next to each other in
-- `sort_order` so the catalog reads as one product offered at two strengths rather than
-- as two unrelated rows. That is why the numbering was rewritten on 16 Aug 2026 when the
-- larger Retatrutide, Tesamorelin and MOTS-c vials were added; the relative order of the
-- original rows is unchanged.
values
  -- $6.00/mg
  ('retatrutide-10mg',  'Retatrutide',  'peptide',  10,    6000,  false, true,  10,  '/coa/retatrutide-10mg.jpg', '/products/retatrutide-10mg.webp'),
  -- $5.00/mg
  ('retatrutide-30mg',  'Retatrutide',  'peptide',  30,    15000, false, false, 20,  null, '/products/retatrutide-30mg.webp'),
  -- $5.00/mg
  ('bpc-157-10mg',      'BPC-157',      'peptide',  10,    5000,  false, true,  30,  '/coa/bpc-157-10mg.jpg', '/products/bpc-157-10mg.webp'),
  -- $8.00/mg
  ('tesamorelin-5mg',   'Tesamorelin',  'peptide',  5,     4000,  false, false, 40,  '/coa/tesamorelin-5mg.jpg', '/products/tesamorelin-5mg.webp'),
  -- $7.00/mg
  ('tesamorelin-10mg',  'Tesamorelin',  'peptide',  10,    7000,  false, false, 50,  null, '/products/tesamorelin-10mg.webp'),
  -- $0.60/mg — copper peptide, arguably 'cosmetic'; category to confirm
  ('ghk-cu-50mg',       'GHK-Cu',       'peptide',  50,    3000,  false, true,  60,  null, '/products/ghk-cu-50mg.webp'),
  -- $6.00/mg
  ('mots-c-10mg',       'MOTS-c',       'peptide',  10,    6000,  false, false, 70,  '/coa/mots-c-10mg.jpg', '/products/mots-c-10mg.webp'),
  -- $3.75/mg
  ('mots-c-40mg',       'MOTS-c',       'peptide',  40,    15000, false, false, 80,  '/coa/mots-c-40mg.jpg', '/products/mots-c-40mg.webp'),
  -- $5.00/mg
  ('kpv-10mg',          'KPV',          'peptide',  10,    5000,  false, false, 90,  null, '/products/kpv-10mg.webp'),
  -- $0.0333/mg, displays as $0.03
  ('glutathione-1500mg','Glutathione',  'peptide',  1500,  5000,  false, false, 100, null, '/products/glutathione-1500mg.webp'),
  -- $6.00/mg
  ('ss-31-10mg',        'SS-31',        'peptide',  10,    6000,  false, false, 110, '/coa/ss-31-10mg.jpg', '/products/ss-31-10mg.webp'),
  -- $0.11/mg
  ('nad-plus-500mg',    'NAD+',         'peptide',  500,   5500,  false, true,  120, '/coa/nad-plus-500mg.jpg', '/products/nad-plus-500mg.webp'),
  -- $1.125/mg, displays as $1.13. Category stays 'blend', but is_blend is false so
  -- the cost-per-mg figure is shown: the client asked for it on 8 Aug 2026. The two
  -- blends below follow the same rule.
  ('k-l-o-w-80mg',      'K-L-O-W',      'blend',    80,    9000,  false, false, 130, '/coa/k-l-o-w-80mg.jpg', '/products/k-l-o-w-80mg.webp'),
  -- $2.00/mg
  ('cjc-ipa-30mg',      'CJC/IPA',      'blend',    30,    6000,  false, false, 140, null, '/products/cjc-ipa-30mg.webp'),
  -- $4.50/mg
  ('wolverine-20mg',    'Wolverine',    'blend',    20,    9000,  false, false, 150, '/coa/wolverine-20mg.jpg', '/products/wolverine-20mg.webp'),
  -- $3.3333/mg, displays as $3.33
  ('tirzepatide-30mg',  'Tirzepatide',  'peptide',  30,    10000, false, true,  160, '/coa/tirzepatide-30mg.jpg', '/products/tirzepatide-30mg.webp'),
  -- $4.50/mg
  ('ipamorelin-10mg',   'Ipamorelin',   'peptide',  10,    4500,  false, false, 170, null, '/products/ipamorelin-10mg.webp')
on conflict (slug) do update set
  name        = excluded.name,
  category    = excluded.category,
  strength_mg = excluded.strength_mg,
  price_cents = excluded.price_cents,
  is_blend    = excluded.is_blend,
  coa_url     = excluded.coa_url,
  image_url   = excluded.image_url,
  featured    = excluded.featured,
  sort_order  = excluded.sort_order,
  -- Revive a previously archived row rather than leaving it hidden.
  status      = 'active',
  deleted_at  = null;

-- Supplies, kept in their own statement because they carry a unit the peptides do not.
--
-- Bacteriostatic water is sold by volume: the vial is 10 mL, not 10 mg. `strength_unit`
-- records that, and the UI suppresses cost-per-mg for it — dollars per milligram of
-- water is not a figure anyone should be shown.
insert into public.products (
  slug, name, category, strength_mg, strength_unit, price_cents, is_blend, featured,
  sort_order, coa_url, image_url
)
values
  ('bacteriostatic-water-10ml', 'Bacteriostatic Water', 'supply', 10, 'ml', 1200,
   false, false, 180, null, '/products/bacteriostatic-water-10ml.webp')
on conflict (slug) do update set
  name          = excluded.name,
  category      = excluded.category,
  strength_mg   = excluded.strength_mg,
  strength_unit = excluded.strength_unit,
  price_cents   = excluded.price_cents,
  is_blend      = excluded.is_blend,
  coa_url       = excluded.coa_url,
  image_url     = excluded.image_url,
  featured      = excluded.featured,
  sort_order    = excluded.sort_order,
  status        = 'active',
  deleted_at    = null;
