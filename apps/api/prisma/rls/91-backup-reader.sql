-- ============================================================================
-- 91 — app_backup: the database backup's read-only role (ADR 068)
-- ============================================================================
-- `pg_dump` must read every row of every table, and every table forces row-level security, so the
-- backup connects with its OWN login (BACKUP_DATABASE_URL) that:
--
--   * is a member of this NOLOGIN group role, which may only SELECT (tables, sequences) and use the
--     schema — no INSERT, UPDATE, DELETE, TRUNCATE or DDL, ever;
--   * carries the BYPASSRLS attribute itself (an attribute, so it is not inherited from a group role).
--
-- The LOGIN role (name + password from BACKUP_DATABASE_URL) is created by
-- `pnpm --filter @workspace/api db:provision-backup-login` or by your infrastructure tooling —
-- credentials never live in this file. The application's own roles are unchanged: `app_runtime` stays
-- without BYPASSRLS (RuntimeRoleProof). Idempotent: REVOKE first.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_backup') THEN
    CREATE ROLE app_backup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_backup;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_backup;

GRANT USAGE ON SCHEMA public TO app_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO app_backup;
