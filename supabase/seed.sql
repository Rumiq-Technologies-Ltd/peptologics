-- Product catalog seed.
--
-- Source: the client's price list, most recently revised 27 Aug 2026.
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
--
-- Where a compound is stocked in two vial sizes, the sizes sit next to each other in
-- `sort_order` so the catalog reads as one product offered at two strengths rather than
-- as two unrelated rows.
--
-- Tesamorelin 10 mg carries the only certificate the compound has. The scan published
-- against the 5 mg vial until 17 Aug 2026 names "Tesamorelin 10mg", lot 0771, on its face;
-- it is the 10 mg certificate and sits on the 10 mg row where it belongs.
insert into public.products (
  slug, name, category, strength_mg, price_cents, is_blend, featured, sort_order, coa_url,
  image_url
)
values
  -- $5.00/mg. Renamed from Retatrutide on 27 Aug 2026; the slug is unchanged so existing
  -- links keep working. Its 10 mg sibling was retired the same day — see the archive
  -- statement at the foot of this file — and it inherits the featured slot that vial held.
  ('retatrutide-30mg',  'RETA-PL3',     'peptide',  30,    15000, false, true,  10,  null, '/products/retatrutide-30mg.webp'),
  -- $5.00/mg
  ('bpc-157-10mg',      'BPC-157',      'peptide',  10,    5000,  false, true,  20,  '/coa/bpc-157-10mg.jpg', '/products/bpc-157-10mg.webp'),
  -- $7.50/mg
  ('tesamorelin-10mg',  'Tesamorelin',  'peptide',  10,    7500,  false, false, 30,  '/coa/tesamorelin-10mg.jpg', '/products/tesamorelin-10mg.webp'),
  -- $7.00/mg
  ('tesamorelin-20mg',  'Tesamorelin',  'peptide',  20,    14000, false, false, 40,  null, '/products/tesamorelin-20mg.webp'),
  -- $0.60/mg — copper peptide, arguably 'cosmetic'; category to confirm
  ('ghk-cu-50mg',       'GHK-Cu',       'peptide',  50,    3000,  false, true,  50,  null, '/products/ghk-cu-50mg.webp'),
  -- $6.00/mg
  ('mots-c-10mg',       'MOTS-c',       'peptide',  10,    6000,  false, false, 60,  '/coa/mots-c-10mg.jpg', '/products/mots-c-10mg.webp'),
  -- $3.75/mg
  ('mots-c-40mg',       'MOTS-c',       'peptide',  40,    15000, false, false, 70,  '/coa/mots-c-40mg.jpg', '/products/mots-c-40mg.webp'),
  -- $5.00/mg
  ('kpv-10mg',          'KPV',          'peptide',  10,    5000,  false, false, 80,  null, '/products/kpv-10mg.webp'),
  -- $0.0333/mg, displays as $0.03
  ('glutathione-1500mg','Glutathione',  'peptide',  1500,  5000,  false, false, 90,  null, '/products/glutathione-1500mg.webp'),
  -- $6.00/mg
  ('ss-31-10mg',        'SS-31',        'peptide',  10,    6000,  false, false, 100, '/coa/ss-31-10mg.jpg', '/products/ss-31-10mg.webp'),
  -- $0.11/mg
  ('nad-plus-500mg',    'NAD+',         'peptide',  500,   5500,  false, true,  110, '/coa/nad-plus-500mg.jpg', '/products/nad-plus-500mg.webp'),
  -- $0.08/mg
  ('nad-plus-1000mg',   'NAD+',         'peptide',  1000,  8000,  false, false, 120, null, '/products/nad-plus-1000mg.webp'),
  -- $6.00/mg. Listed at 30 mg until 27 Aug 2026, when the vial renders arrived reading
  -- 10 MG; the strength was corrected and the slug moved with it, redirected in
  -- next.config.ts. Category stays 'blend', but is_blend is false so the cost-per-mg
  -- figure is shown: the client asked for it on 8 Aug 2026. Wolverine follows the same rule.
  ('cjc-ipa-10mg',      'CJC/IPA',      'blend',    10,    6000,  false, false, 130, null, '/products/cjc-ipa-10mg.webp'),
  -- $4.50/mg
  ('wolverine-20mg',    'Wolverine',    'blend',    20,    9000,  false, false, 140, '/coa/wolverine-20mg.jpg', '/products/wolverine-20mg.webp'),
  -- $3.3333/mg, displays as $3.33. Renamed from Tirzepatide on 27 Aug 2026; slug unchanged.
  ('tirzepatide-30mg',  'TIRZ-PL2',     'peptide',  30,    10000, false, true,  150, '/coa/tirzepatide-30mg.jpg', '/products/tirzepatide-30mg.webp'),
  -- $4.50/mg
  ('ipamorelin-10mg',   'Ipamorelin',   'peptide',  10,    4500,  false, false, 160, null, '/products/ipamorelin-10mg.webp')
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
  ('bacteriostatic-water-3ml', 'Bacteriostatic Water', 'supply', 3, 'ml', 600,
   false, false, 170, null, '/products/bacteriostatic-water-3ml.webp'),
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

-- Withdrawn products.
--
-- Archived rather than deleted: `order_items` snapshots a name and price but still
-- references `product_id`, and a real inquiry for one of these exists. RLS hides anything
-- that is not `status = 'active'`, so an archived row leaves the catalog, the sitemap, the
-- featured strip and the certificate library on its own.
--
-- Kept as an explicit statement rather than simply being absent from the insert above,
-- because `on conflict do update` sets `status = 'active'` — a row merely dropped from the
-- list would stay live in any database that already has it.
--
-- - K-L-O-W: discontinued 27 Aug 2026. No equivalent vial, so no redirect (next.config.ts).
-- - RETA-PL3 10 mg and Tesamorelin 5 mg: both compounds dropped their smaller vial on
--   27 Aug 2026. Each redirects to the size still sold. The RETA-PL3 10 mg certificate is
--   genuinely a 10 mg lot — "3/RETA 10mg", net content 11.87 mg — so it retires with the
--   product rather than moving onto the 30 mg, which now has none.
update public.products
   set status = 'archived', deleted_at = coalesce(deleted_at, now())
 where slug in ('k-l-o-w-80mg', 'retatrutide-10mg', 'tesamorelin-5mg');
