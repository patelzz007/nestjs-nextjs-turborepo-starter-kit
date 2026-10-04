-- ============================================================================
-- app_runtime grants (run last — after migrations + RLS fragments)
-- ============================================================================
-- Re-applies table/sequence/function grants so every object created by Prisma
-- migrations is visible to SET ROLE app_runtime (seed, API pool, tenant tx).
-- Idempotent; safe to run on every `pnpm db:apply-security`.
-- ============================================================================

-- The role itself is created in 00-app-helpers.sql (applied first).

GRANT USAGE ON SCHEMA public TO app_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;


DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_rls_bypass') THEN
    GRANT EXECUTE ON FUNCTION app_rls_bypass() TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_system_operation') THEN
    GRANT EXECUTE ON FUNCTION app_system_operation() TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_current_user_id') THEN
    GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_current_organization_id') THEN
    GRANT EXECUTE ON FUNCTION app_current_organization_id() TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_owns') THEN
    GRANT EXECUTE ON FUNCTION app_owns(text) TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_organization_member_of') THEN
    GRANT EXECUTE ON FUNCTION app_organization_member_of(text) TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_organization_member_of') THEN
    GRANT EXECUTE ON FUNCTION app_tenant_organization_member_of(text) TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_org_member') THEN
    GRANT EXECUTE ON FUNCTION app_tenant_org_member(text) TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_has_location_access') THEN
    GRANT EXECUTE ON FUNCTION app_tenant_has_location_access(text) TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_row_org_location_access') THEN
    GRANT EXECUTE ON FUNCTION app_tenant_row_org_location_access(text, text) TO app_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_org_optional_location_access') THEN
    GRANT EXECUTE ON FUNCTION app_tenant_org_optional_location_access(text, text) TO app_runtime;
  END IF;
END $$;

-- ============================================================================
-- Append-only and soft-delete-only tables (run AFTER the blanket grants above,
-- which would otherwise hand UPDATE/DELETE straight back to app_runtime)
-- ============================================================================
-- Audit trails are append-only for the application role (rules/10 → "Storage
-- and immutability"); soft-delete-only data is never hard-deleted.
--
-- The tables and privileges are declared ONCE, in
-- prisma/rls/withheld-privileges.ts (APP_RUNTIME_WITHHELD_PRIVILEGES).
-- `pnpm db:apply-security` (scripts/apply-rls.ts) appends the generated
-- REVOKEs to THIS file's transaction — right after the blanket grant above —
-- and then verifies against the live catalog that app_runtime lacks each one.
-- Do not hand-write `REVOKE … FROM app_runtime` here or in rls.sql:
-- `db:check-rls-manifest` rejects it.

-- ============================================================================
-- app_enumerator grants — the `tenant.enumerate` system operation's role
-- ============================================================================
-- Exactly what listing active organization ids needs: SELECT on
-- `organizations`, and SELECT on `organization_memberships` because the
-- `organizations_member` policy reads it. No DML, no other table. Revoke
-- first so a grant removed here is also removed from existing databases.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_enumerator;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_enumerator;
GRANT USAGE ON SCHEMA public TO app_enumerator;
GRANT SELECT ON TABLE public.organizations TO app_enumerator;
GRANT SELECT ON TABLE public.organization_memberships TO app_enumerator;
GRANT EXECUTE ON FUNCTION app_rls_bypass() TO app_enumerator;
GRANT EXECUTE ON FUNCTION app_system_operation() TO app_enumerator;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_enumerator;
GRANT EXECUTE ON FUNCTION app_organization_member_of(text) TO app_enumerator;
