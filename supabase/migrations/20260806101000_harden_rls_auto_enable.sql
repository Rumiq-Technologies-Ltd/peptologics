-- Hardening for a pre-existing project object, not something this project created.
--
-- `public.rls_auto_enable()` backs the `ensure_rls` event trigger, which enables
-- row level security automatically on any new table in `public`. A useful safety
-- net, and it stays exactly as it is.
--
-- The problem is its grants. It is SECURITY DEFINER and owned by `postgres`, and
-- EXECUTE was held by PUBLIC — so `anon` could invoke it over the REST API at
-- `/rest/v1/rpc/rls_auto_enable` and it would run with postgres privileges. That
-- was verified against the live database, not inferred: assuming an
-- event-trigger function cannot be called directly turned out to be wrong. It
-- executed.
--
-- Impact today is nil: outside an event-trigger context
-- pg_event_trigger_ddl_commands() yields no rows, so the loop body never runs.
-- The reason to fix it anyway is that it is a standing privilege-escalation
-- surface on the public API — the day the function body changes, anon inherits
-- postgres rights on whatever it does next.
--
-- Revoking EXECUTE does NOT disable the event trigger. Event triggers are fired
-- by the system during DDL and do not consult the invoking role's EXECUTE grant,
-- exactly as ordinary triggers do not. Verified after applying this migration by
-- creating a table and confirming RLS was still switched on automatically.

revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

comment on function public.rls_auto_enable is
  'Event trigger function for `ensure_rls`: enables RLS on new public tables. EXECUTE is revoked from anon and authenticated — it is SECURITY DEFINER owned by postgres and must not be callable over the REST API. The event trigger fires regardless of these grants.';
