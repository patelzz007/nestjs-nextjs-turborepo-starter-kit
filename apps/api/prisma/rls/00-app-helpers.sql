-- ============================================================================
-- 00 — base session helpers (applied FIRST)
-- ============================================================================
-- The primitives every other RLS file depends on:
--   - `01-acl-location-access.sql` builds SECURITY DEFINER functions on top of
--     them (its SQL bodies call app_rls_bypass() / app_current_user_id()).
--   - `prisma/rls.sql` policies call app_owns() / app_rls_bypass().
-- They used to live in `rls.sql` §2, which runs AFTER `01` — on a fresh
-- database (no app_* functions yet) `01` failed with:
--   ERROR: function app_rls_bypass() does not exist
-- so `pnpm db:apply-security` aborted before any grants were applied.
-- They now live here. The apply order and a use-before-define check live in
-- `RLS_APPLY_ORDER` (scripts/rls-apply-plan.ts) and run before any SQL executes.
-- It also creates the `app_runtime` role — the ONLY place it is created. Every
-- later file GRANTs to it (01 does so for its SECURITY DEFINER helpers), so on
-- a brand-new cluster it must exist before anything else runs; the apply plan
-- (`assertRlsRoleDependencies`) rejects any file that uses a role before the
-- file that creates it.
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE) — safe to re-run.
-- ============================================================================

-- ── app_runtime role (NOLOGIN: reached only via SET ROLE; NOBYPASSRLS: policies always apply)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT app_runtime TO CURRENT_USER;

-- ── app_enumerator role — the role of the `tenant.enumerate` system operation
-- (apps/api/src/prisma/system-operation.registry.ts). Read-only and narrow:
-- 99-app-runtime-grants.sql grants it SELECT on `organizations` (plus the
-- `organization_memberships` table that policy reads) and nothing else, so a
-- scheduler fan-out can list tenant ids but never read or write tenant data.
-- Reached only via SET ROLE, like app_runtime.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_enumerator') THEN
    CREATE ROLE app_enumerator NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT app_enumerator TO CURRENT_USER;

-- ── session primitives

-- The allowlisted system operation the session runs under (NULL for user /
-- anonymous sessions). Set by the API pool checkout and by
-- `withSystemOperation` (transaction-local); policies that only ONE operation
-- may pass (geo reference-data writes, the HTTP audit log) compare it by name.
CREATE OR REPLACE FUNCTION app_system_operation() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.system_operation', true), '');
$$;

-- A bypass is granted only when the session BOTH asks for it AND names the
-- allowlisted system operation that justifies it. `app.rls_bypass = true`
-- without an operation name is not a bypass (ADR 012).
CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.rls_bypass', true), ''), 'false')::boolean
     AND app_system_operation() IS NOT NULL;
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
