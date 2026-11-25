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

-- PL3 (both vials) and PL2 carry no coa_url as of 27 Sep 2026: the client asked for their
-- certificates to come off the site for now. The scans are still in `public/coa/`, so
-- restoring one is a matter of putting its path back on the row — nothing was deleted.
--
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
-- Tesamorelin 20 mg replaced the 10 mg vial on 24 Nov 2026 and keeps the only certificate
-- the compound has. The scan names "Tesamorelin 10mg", lot 0771, on its face; the client
-- asked for it to stay on the 20 mg row because the 20 mg vial is the same material at
-- double the quantity. The file keeps its original name (`tesamorelin-10mg.webp`) so it
-- remains an honest record of what the scan says.
--
-- `name` is the client's vial label, not the compound's generic name, and the two have
-- diverged: PL3 is retatrutide, PL2 is tirzepatide, IPA is ipamorelin. Slugs still carry the
-- generic name, which is deliberate — they are indexed links and renaming one costs a redirect. Shortened 27 Sep 2026 at the client's request;
-- Tesa 10 went back to the full name, Tesamorelin, on 24 Nov 2026 (also at the client's
-- request).
--
-- IPA was "IPA 10" until 25 Nov 2026, when the client asked for the bare name so it matches
-- the rest of the catalog, where the strength is printed beside the name rather than in it.
insert into public.products (
  slug, name, category, strength_mg, price_cents, is_blend, featured, sort_order, coa_url,
  image_url
)
values
  -- $7.50/mg. Retired 27 Aug 2026 and brought back 21 Sep 2026 at the client's request.
  -- The redirect to the 30 mg vial was removed from next.config.ts.
  -- Certificate withheld 27 Sep 2026 — see the note above this statement.
  ('retatrutide-10mg',  'PL3',          'peptide',  10,    7500,  false, false, 5,   null, '/products/retatrutide-10mg.webp'),
  -- $6.00/mg. Renamed from Retatrutide on 27 Aug 2026; the slug is unchanged so existing
  -- links keep working. Repriced 28 Aug 2026 against the official price menu
  -- (PeptoLogics_Price_Menu_Original.pdf).
  -- Certificate withheld 27 Sep 2026 — see the note above this statement.
  ('retatrutide-30mg',  'PL3',          'peptide',  30,    18000, false, true,  10,  null, '/products/retatrutide-30mg.webp'),
  -- $5.00/mg. Certificate refreshed 17 Sep 2026 (Bioviridian lot BPC10-260101-057).
  ('bpc-157-10mg',      'BPC-157',      'peptide',  10,    5000,  false, true,  20,  '/coa/bpc-157-10mg.webp', '/products/bpc-157-10mg.webp'),
  -- $4.25/mg. Added 24 Nov 2026. No certificate yet.
  ('bpc-157-20mg',      'BPC-157',      'peptide',  20,    8500,  false, false, 25,  null, '/products/bpc-157-20mg.webp'),
  -- $7.50/mg. Replaced the 10 mg vial on 24 Nov 2026 (slug `tesamorelin-10mg`, redirected
  -- here). The certificate is the 10 mg lot — see the note above this statement.
  ('tesamorelin-20mg',  'Tesamorelin',  'peptide',  20,    15000, false, false, 30,  '/coa/tesamorelin-10mg.webp', '/products/tesamorelin-20mg.webp'),
  -- $0.65/mg — copper peptide, arguably 'cosmetic'; category to confirm. Listed at 50 mg
  -- until 28 Aug 2026, when the official price menu (PeptoLogics_Price_Menu_Original.pdf)
  -- showed 100 mg / $65; the slug moved with it, redirected in next.config.ts. The 100 mg
  -- vial render arrived 1 Sep 2026.
  -- Certificate added 17 Sep 2026 (Bioviridian lot GHK100-260101-060).
  ('ghk-cu-100mg',      'GHK-Cu',       'peptide',  100,   6500,  false, true,  50,  '/coa/ghk-cu-100mg.webp', '/products/ghk-cu-100mg.webp'),
  -- $0.65/mg. Alanine-histidine-lysine copper peptide, a different compound from GHK-Cu.
  -- Added 24 Nov 2026; category follows GHK-Cu. No certificate yet.
  ('ahk-cu-100mg',      'AHK-Cu',       'peptide',  100,   6500,  false, false, 55,  null, '/products/ahk-cu-100mg.webp'),
  -- $6.00/mg
  ('mots-c-10mg',       'MOTS-c',       'peptide',  10,    6000,  false, false, 60,  '/coa/mots-c-10mg.jpg', '/products/mots-c-10mg.webp'),
  -- $3.75/mg. Certificate refreshed 17 Sep 2026 (Bioviridian lot MS40-260101-058).
  ('mots-c-40mg',       'MOTS-c',       'peptide',  40,    15000, false, false, 70,  '/coa/mots-c-40mg.webp', '/products/mots-c-40mg.webp'),
  -- $5.00/mg. Certificate added 17 Sep 2026 (Bioviridian lot KPV10-260101-055).
  ('kpv-10mg',          'KPV',          'peptide',  10,    5000,  false, false, 80,  '/coa/kpv-10mg.webp', '/products/kpv-10mg.webp'),
  -- $0.0833/mg, displays as $0.08. Strength corrected from 1500 mg on 1 Oct 2026.
  ('glutathione-600mg', 'Glutathione',  'peptide',  600,   5000,  false, false, 90,  null, '/products/glutathione-600mg.png'),
  -- $7.00/mg. Repriced 28 Aug 2026 against the official price menu. Renamed SS-31 ->
  -- PL-31SS on 1 Sep 2026 to match the new vial label; slug and certificate are unchanged
  -- since both still describe the same 10 mg lot regardless of what the label calls it.
  ('ss-31-10mg',        'PL-31SS',      'peptide',  10,    7000,  false, false, 100, '/coa/ss-31-10mg.jpg', '/products/ss-31-10mg.webp'),
  -- $0.11/mg
  ('nad-plus-500mg',    'NAD+',         'peptide',  500,   5500,  false, true,  110, '/coa/nad-plus-500mg.jpg', '/products/nad-plus-500mg.webp'),
  -- $0.08/mg
  ('nad-plus-1000mg',   'NAD+',         'peptide',  1000,  8000,  false, false, 120, null, '/products/nad-plus-1000mg.webp'),
  -- $8.00/mg. Listed at 30 mg until 27 Aug 2026, when the vial renders arrived reading
  -- 10 MG; the strength was corrected and the slug moved with it, redirected in
  -- next.config.ts. Category stays 'blend', but is_blend is false so the cost-per-mg
  -- figure is shown: the client asked for it on 8 Aug 2026. Wolverine follows the same rule.
  -- Repriced 28 Aug 2026 against the official price menu.
  ('cjc-ipa-10mg',      'CJC/IPA',      'blend',    10,    8000,  false, false, 130, null, '/products/cjc-ipa-10mg.webp'),
  -- $5.00/mg. Repriced 28 Aug 2026 against the official price menu.
  -- Certificate refreshed 17 Sep 2026 (Bioviridian lot WOLV20-260101-058).
  ('wolverine-20mg',    'Wolverine',    'blend',    20,    10000, false, false, 140, '/coa/wolverine-20mg.webp', '/products/wolverine-20mg.webp'),
  -- $5.00/mg. Renamed from Tirzepatide on 27 Aug 2026; slug unchanged. Repriced 28 Aug 2026
  -- against the official price menu.
  -- Certificate withheld 27 Sep 2026 — see the note above this statement.
  ('tirzepatide-30mg',  'PL2',          'peptide',  30,    15000, false, true,  150, null, '/products/tirzepatide-30mg.webp'),
  -- $7.50/mg. Added 24 Nov 2026. No certificate yet.
  ('tirzepatide-10mg',  'PL2',          'peptide',  10,    7500,  false, false, 155, null, '/products/tirzepatide-10mg.webp'),
  -- $5.00/mg. Repriced 28 Aug 2026 against the official price menu. Certificate added
  -- 17 Sep 2026 (Bioviridian lot IPA10-260101-060).
  ('ipamorelin-10mg',   'IPA',          'peptide',  10,    5000,  false, false, 160, '/coa/ipamorelin-10mg.webp', '/products/ipamorelin-10mg.webp'),
  -- $20.00/mg. Added 24 Nov 2026 at the client's request, named Eloralintide. No
  -- certificate yet. The vial render's label reads ELORA, the client's short name.
  ('eloralintide-5mg',  'Eloralintide', 'peptide',  5,     10000, false, false, 165, null, '/products/eloralintide-5mg.webp')
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
  -- Both repriced 28 Aug 2026 against the official price menu.
  ('bacteriostatic-water-3ml', 'Bacteriostatic Water', 'supply', 3, 'ml', 800,
   false, false, 170, null, '/products/bacteriostatic-water-3ml.webp'),
  ('bacteriostatic-water-10ml', 'Bacteriostatic Water', 'supply', 10, 'ml', 1500,
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
-- - Tesamorelin 5 mg: dropped 27 Aug 2026 when the compound retired its smaller vial, and
--   redirected to the 10 mg still sold.
-- - Tesamorelin 10 mg (Tesa 10): replaced by the 20 mg vial on 24 Nov 2026 at the client's
--   request and redirected to it. The 20 mg row was archived from 27 Sep 2026 until then,
--   so it is listed in the insert above rather than here.
--
-- PL3 10 mg was archived here alongside K-L-O-W on 27 Aug 2026 and returned to the catalog
-- on 21 Sep 2026, so it is listed in the insert above rather than archived here.
update public.products
   set status = 'archived', deleted_at = coalesce(deleted_at, now())
 where slug in ('k-l-o-w-80mg', 'tesamorelin-5mg', 'tesamorelin-10mg');
