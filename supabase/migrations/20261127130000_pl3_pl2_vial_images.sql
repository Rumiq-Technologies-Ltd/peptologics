-- 27 Nov 2026 (Chat 08, follow-up 4).
--
-- PL3 and PL2 have new vial artwork. 20261127120000 set their image_url to null (the
-- placeholder) while the old photos were removed; this points each row at its new file in
-- public/products/. Apply together with 20261127120000 at the production release.
--
-- Reverse by setting image_url back to null.

update public.products set image_url = '/products/pl3-10mg.webp' where slug = 'pl3-10mg';
update public.products set image_url = '/products/pl3-30mg.webp' where slug = 'pl3-30mg';
update public.products set image_url = '/products/pl2-10mg.webp' where slug = 'pl2-10mg';
update public.products set image_url = '/products/pl2-30mg.webp' where slug = 'pl2-30mg';
