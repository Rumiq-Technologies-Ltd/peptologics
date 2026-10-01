-- Correct the Glutathione vial strength while retaining its $50 price.
update public.products
   set slug = 'glutathione-600mg',
       strength_mg = 600,
       image_url = '/products/glutathione-600mg.png'
 where slug = 'glutathione-1500mg';
