-- Vial contents are not always milligrams.
--
-- Bacteriostatic water is supplied as 10 mL, and the catalog previously had no way to
-- say so: `strength_mg` is the only size column, so the product would have rendered as
-- "10 mg/vial" directly beside a photograph of a label reading "10 ML".
--
-- `strength_mg` keeps its name and meaning for every existing row. This column records
-- the unit that number is expressed in, defaulting to 'mg' so all twelve peptides are
-- correct without being touched.
--
-- `cost_per_mg` stays generated and stays honest for milligram products. It is
-- meaningless for a diluent sold by volume, so the UI suppresses it whenever the unit
-- is not 'mg' — the same mechanism already used for multi-peptide blends.
--
-- Reversal: `alter table public.products drop column strength_unit;`
alter table public.products
  add column if not exists strength_unit text not null default 'mg'
    check (strength_unit in ('mg', 'ml'));

comment on column public.products.strength_unit is
  'Unit for strength_mg: mg for lyophilized compounds, ml for liquids such as diluents. cost_per_mg is only meaningful when this is mg.';
