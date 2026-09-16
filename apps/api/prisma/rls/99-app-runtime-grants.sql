-- ============================================================================
-- app_runtime grants (run last — after migrations + RLS fragments)
-- ============================================================================
-- Re-applies table/sequence/function grants so every object created by Prisma
-- migrations is visible to SET ROLE app_runtime (seed, API pool, tenant tx).
-- Idempotent; safe to run on every `pnpm db:apply-security`.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT app_runtime TO CURRENT_USER;

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
