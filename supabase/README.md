# Legacy: Supabase

Supabase is being replaced by DynamoDB (ADR-035). This folder stays in place while Supabase is the
live store (`INQUIRY_DATA_STORE` unset or `supabase`) and for the two-week fallback after the
cutover (D7). Do not add migrations here for new features. Deleting this folder, `src/lib/supabase/`,
the Supabase repositories and the `SUPABASE_*` variables is a separate, later PR.

`seed.sql` is also the source for the DynamoDB dev table: copy the catalog with
`scripts/migrate-supabase-to-dynamodb.ts --products-only`.
