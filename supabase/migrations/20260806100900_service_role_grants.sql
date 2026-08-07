-- Write-path grants for service_role.
--
-- This project's ALTER DEFAULT PRIVILEGES grants only REFERENCES, TRIGGER and
-- TRUNCATE on new public tables — and grants them to service_role as well as to
-- anon. So `service_role` had no DML at all: the inquiry write path would have
-- failed with "permission denied for table orders" the first time a customer
-- submitted, despite service_role holding BYPASSRLS.
--
-- BYPASSRLS only exempts a role from row level security. It does not grant table
-- privileges. Both are required, and only one of them was present.
--
-- Granted per table, at the narrowest privilege each code path genuinely needs,
-- rather than a blanket GRANT ALL.

-- Price authority: the inquiry service re-reads price_cents before computing any
-- subtotal (ADR-005). Read-only — the application never writes the catalog.
grant select on table public.products to service_role;

-- create_inquiry inserts the order; the replay path reads it back after
-- ON CONFLICT DO NOTHING. No DELETE: inquiries are soft-deleted via deleted_at,
-- and status transitions are an operator action taken in Supabase Studio.
grant select, insert, update on table public.orders to service_role;

-- Line items are written once and never modified. No UPDATE, no DELETE — they
-- are a point-in-time snapshot, and CASCADE from orders handles removal.
grant select, insert on table public.order_items to service_role;

-- Written as `pending` inside create_inquiry, then updated to
-- sent / failed / skipped by the notification service.
grant select, insert, update on table public.notification_log to service_role;

-- check_rate_limit upserts the counter and deletes expired windows, so this is
-- the one table where DELETE is required.
grant select, insert, update, delete on table public.rate_limit_hits to service_role;

-- The sequence behind orders.order_number. Inserting an order evaluates
-- nextval(), which needs USAGE.
grant usage on sequence public.order_number_seq to service_role;

-- service_role has no more need for these than anon does. It is used only by the
-- application, which never truncates a table or attaches a trigger.
revoke truncate, trigger, references on table
  public.products,
  public.orders,
  public.order_items,
  public.notification_log,
  public.rate_limit_hits
from service_role;

alter default privileges in schema public
  revoke truncate, trigger, references on tables from service_role;
