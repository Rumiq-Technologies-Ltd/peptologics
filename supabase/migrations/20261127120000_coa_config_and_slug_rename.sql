-- 27 Nov 2026 (Chat 08).
--
-- 1. COAs move out of the database. The single source of truth is now
--    `src/features/coa/constants/coaReports.ts`, keyed by product slug, so
--    `products.coa_url` is cleared on every row and no longer read. The column is kept
--    (dropping it is destructive and can wait until Supabase is retired).
-- 2. PL3, PL2 and Elora move to new slugs. Their old slugs redirect in next.config.ts.
--    PL3 and PL2 vial photos are removed from the site, so their image_url becomes null
--    (the placeholder) until new artwork arrives.
--
-- Past orders are untouched: order_items keep the name and slug they were sold under.
-- Reverse by renaming the slugs back and restoring image_url / coa_url from the previous
-- seed.sql in git history.

update public.products
   set slug = 'pl3-10mg', image_url = null
 where slug = 'retatrutide-10mg';

update public.products
   set slug = 'pl3-30mg', image_url = null
 where slug = 'retatrutide-30mg';

update public.products
   set slug = 'pl2-10mg', image_url = null
 where slug = 'tirzepatide-10mg';

update public.products
   set slug = 'pl2-30mg', image_url = null
 where slug = 'tirzepatide-30mg';

update public.products
   set slug = 'elora-5mg', image_url = '/products/elora-5mg.webp'
 where slug = 'eloralintide-5mg';

update public.products
   set coa_url = null
 where coa_url is not null;
