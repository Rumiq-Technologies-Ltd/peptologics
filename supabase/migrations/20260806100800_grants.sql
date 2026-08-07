-- Table-level grants for the client roles.
--
-- Two problems found by probing the live database after the tables were created,
-- both caused by Supabase's ALTER DEFAULT PRIVILEGES on the public schema. RLS
-- alone does not describe what a role can do — a policy can only filter access
-- that a GRANT already permits, and some privileges ignore RLS entirely.

-- ---------------------------------------------------------------------------
-- 1. anon had no SELECT on products, so `products_public_read` was dead weight.
--
-- A policy cannot grant access; it can only narrow it. Without this the catalog
-- read path fails outright with "permission denied for table products". Verified
-- with has_table_privilege('anon', 'public.products', 'SELECT') = false.
--
-- The policy still does the real work of restricting rows to
-- status = 'active' AND deleted_at IS NULL.
-- ---------------------------------------------------------------------------

grant select on table public.products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. anon held TRUNCATE on every table, including orders.
--
-- TRUNCATE is NOT filtered by row level security. A leaked anon key plus any
-- path that executes SQL as anon could therefore run
-- `truncate public.orders cascade` and destroy every lead, every line item and
-- every delivery record — despite orders having RLS enabled with no policies.
--
-- REFERENCES and TRIGGER are removed for the same reason: no client role has any
-- legitimate use for them, and both are levers for altering schema behaviour.
-- ---------------------------------------------------------------------------

revoke truncate, trigger, references on table
  public.products,
  public.orders,
  public.order_items,
  public.notification_log,
  public.rate_limit_hits
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Stop the same defaults applying to future tables.
--
-- Without this, the next migration that creates a table silently reintroduces
-- the TRUNCATE grant and the problem returns.
-- ---------------------------------------------------------------------------

alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resulting posture
--
--   anon / authenticated : SELECT on products only, further narrowed by RLS to
--                          active, non-deleted rows. Nothing at all on orders,
--                          order_items, notification_log or rate_limit_hits.
--                          No EXECUTE on create_inquiry or check_rate_limit.
--   service_role         : full access, bypasses RLS. Server-side write path only.
--
-- The browser never holds either key: both Supabase clients are server-only.
-- ---------------------------------------------------------------------------
