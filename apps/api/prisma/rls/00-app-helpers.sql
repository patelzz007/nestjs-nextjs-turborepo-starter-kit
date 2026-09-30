-- ============================================================================
-- 00 — base session helpers (applied FIRST)
-- ============================================================================
-- The four primitives every other RLS file depends on:
--   - `01-acl-location-access.sql` builds SECURITY DEFINER functions on top of
--     them (its SQL bodies call app_rls_bypass() / app_current_user_id()).
--   - `prisma/rls.sql` policies call app_owns() / app_rls_bypass().
-- They used to live in `rls.sql` §2, which runs AFTER `01` — on a fresh
-- database (no app_* functions yet) `01` failed with:
--   ERROR: function app_rls_bypass() does not exist
-- so `pnpm db:apply-security` aborted before any grants were applied.
-- They now live here. The apply order and a use-before-define check live in
-- `RLS_APPLY_ORDER` (scripts/rls-apply-plan.ts) and run before any SQL executes.
-- Idempotent (CREATE OR REPLACE) — safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.rls_bypass', true), ''), 'false')::boolean;
$$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_current_organization_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_owns(owner_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_rls_bypass() OR (app_current_user_id() IS NOT NULL AND app_current_user_id() = owner_id);
$$;
