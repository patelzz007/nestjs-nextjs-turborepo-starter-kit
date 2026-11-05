-- ============================================================================
-- 70 — Audit-record retention (ADR 078): the only way an audit row is ever deleted
-- ============================================================================
-- Why hand-written (ADR 078 §1): Prisma has no syntax for roles, role-specific policies or
-- SECURITY DEFINER functions.
--
-- `AuditLog` and `DataChangeLog` are append-only for the application: `app_runtime` holds no UPDATE or
-- DELETE on them (prisma/rls/withheld-privileges.ts). Records past the platform's retention are removed by
-- ONE function, `public.app_purge_audit_batch`, which runs with the rights of `app_retention`, a NOLOGIN
-- role that is the only holder of DELETE on these tables (through policies written for it alone).
-- `app_runtime` may only EXECUTE the function, and the function itself refuses:
--
--   * outside the `maintenance.audit_record_retention` system operation;
--   * a cutoff newer than the retention (RETENTION_DAYS below = RECORD_RETENTION_DAYS in
--     src/platform/domain/record-retention.ts; a unit spec keeps them equal), so even a compromised
--     application can't purge recent history;
--   * a batch outside 1..MAX_BATCH;
--   * an unknown target.
--
-- Rows under an active `AuditLegalHold` (its tenant and/or its user, as the row's actor) are never
-- deleted, whatever their age. With `dry_run` it only counts. Idempotent: re-applied by every
-- `db:apply-security`.
--
-- Rollback / recovery: `DROP FUNCTION public.app_purge_audit_batch(text, bigint, integer, boolean);`
-- then `DROP OWNED BY app_retention; DROP ROLE app_retention;`. Nothing else depends on them; deleted rows
-- come back only from a backup taken before the run (the `RetentionRun` log says which runs deleted what).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_retention') THEN
    CREATE ROLE app_retention NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_retention;
GRANT USAGE ON SCHEMA public TO app_retention;
GRANT SELECT, DELETE ON public."AuditLog", public."DataChangeLog", public."DataChangeGroup" TO app_retention;
GRANT SELECT ON public."AuditLegalHold" TO app_retention;

-- The retention tables: platform data, every read and write under a named system operation.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['AuditLegalHold', 'RetentionRun']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS audit_legal_hold_bypass ON public."AuditLegalHold";
CREATE POLICY audit_legal_hold_bypass ON public."AuditLegalHold"
  USING ((SELECT public.app_rls_bypass_on('AuditLegalHold')))
  WITH CHECK ((SELECT public.app_rls_bypass_on('AuditLegalHold')));

DROP POLICY IF EXISTS retention_run_bypass ON public."RetentionRun";
CREATE POLICY retention_run_bypass ON public."RetentionRun"
  USING ((SELECT public.app_rls_bypass_on('RetentionRun')))
  WITH CHECK ((SELECT public.app_rls_bypass_on('RetentionRun')));

-- `app_retention` reads holds and reads + deletes audit rows; these policies name it alone, so they
-- grant nothing to `app_runtime` or anyone else.
DROP POLICY IF EXISTS audit_legal_hold_retention_read ON public."AuditLegalHold";
CREATE POLICY audit_legal_hold_retention_read ON public."AuditLegalHold" FOR SELECT TO app_retention USING (true);

DROP POLICY IF EXISTS audit_log_retention_read ON public."AuditLog";
CREATE POLICY audit_log_retention_read ON public."AuditLog" FOR SELECT TO app_retention USING (true);
DROP POLICY IF EXISTS audit_log_retention_delete ON public."AuditLog";
CREATE POLICY audit_log_retention_delete ON public."AuditLog" FOR DELETE TO app_retention USING (true);

DROP POLICY IF EXISTS data_change_log_retention_read ON public."DataChangeLog";
CREATE POLICY data_change_log_retention_read ON public."DataChangeLog" FOR SELECT TO app_retention USING (true);
DROP POLICY IF EXISTS data_change_log_retention_delete ON public."DataChangeLog";
CREATE POLICY data_change_log_retention_delete ON public."DataChangeLog" FOR DELETE TO app_retention USING (true);

DROP POLICY IF EXISTS data_change_group_retention_read ON public."DataChangeGroup";
CREATE POLICY data_change_group_retention_read ON public."DataChangeGroup" FOR SELECT TO app_retention USING (true);
DROP POLICY IF EXISTS data_change_group_retention_delete ON public."DataChangeGroup";
CREATE POLICY data_change_group_retention_delete ON public."DataChangeGroup" FOR DELETE TO app_retention USING (true);

-- One batch of retention. `affected`: rows deleted (or, dry, eligible); `held`: rows past the cutoff an
-- active legal hold keeps (counted on a dry run only, so a real batch never pays for that scan).
CREATE OR REPLACE FUNCTION public.app_purge_audit_batch(target text, cutoff bigint, batch_size integer, dry_run boolean)
RETURNS TABLE (affected bigint, held bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  -- = RECORD_RETENTION_DAYS (src/platform/domain/record-retention.ts).
  retention_days CONSTANT integer := 3653;
  max_batch CONSTANT integer := 10000;
  ms_per_day CONSTANT bigint := 86400000;
  newest_allowed bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint - retention_days::bigint * ms_per_day;
BEGIN
  IF public.app_system_operation() IS DISTINCT FROM 'maintenance.audit_record_retention' THEN
    RAISE EXCEPTION 'app_purge_audit_batch runs only under the maintenance.audit_record_retention system operation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF cutoff IS NULL OR cutoff > newest_allowed THEN
    RAISE EXCEPTION 'retention cutoff % is newer than the % day retention allows (%)', cutoff, retention_days, newest_allowed
      USING ERRCODE = 'check_violation';
  END IF;
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > max_batch THEN
    RAISE EXCEPTION 'retention batch size must be 1..%', max_batch USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF target = 'AUDIT_LOG' THEN
    IF dry_run THEN
      RETURN QUERY
        SELECT
          count(*) FILTER (WHERE NOT on_hold),
          count(*) FILTER (WHERE on_hold)
        FROM (
          SELECT EXISTS (
            SELECT 1 FROM public."AuditLegalHold" h
            WHERE h."liftedAt" IS NULL AND h."isDeleted" = false
              AND (h."tenantId" IS NOT NULL OR h."userId" IS NOT NULL)
              AND (h."tenantId" IS NULL OR h."tenantId" = r."tenantId")
              AND (h."userId" IS NULL OR h."userId" = r."actorUserId")
          ) AS on_hold
          FROM public."AuditLog" r WHERE r."occurredAt" < cutoff
        ) AS rows;
      RETURN;
    END IF;
    RETURN QUERY
      WITH doomed AS (
        SELECT r.id FROM public."AuditLog" r
        WHERE r."occurredAt" < cutoff
          AND NOT EXISTS (
            SELECT 1 FROM public."AuditLegalHold" h
            WHERE h."liftedAt" IS NULL AND h."isDeleted" = false
              AND (h."tenantId" IS NOT NULL OR h."userId" IS NOT NULL)
              AND (h."tenantId" IS NULL OR h."tenantId" = r."tenantId")
              AND (h."userId" IS NULL OR h."userId" = r."actorUserId")
          )
        ORDER BY r."occurredAt"
        LIMIT batch_size
      ), deleted AS (
        DELETE FROM public."AuditLog" r USING doomed d WHERE r.id = d.id RETURNING 1
      )
      SELECT count(*)::bigint, 0::bigint FROM deleted;
    RETURN;
  END IF;

  IF target = 'DATA_CHANGE_LOG' THEN
    IF dry_run THEN
      RETURN QUERY
        SELECT
          count(*) FILTER (WHERE NOT on_hold),
          count(*) FILTER (WHERE on_hold)
        FROM (
          SELECT EXISTS (
            SELECT 1 FROM public."AuditLegalHold" h
            WHERE h."liftedAt" IS NULL AND h."isDeleted" = false
              AND (h."tenantId" IS NOT NULL OR h."userId" IS NOT NULL)
              AND (h."tenantId" IS NULL OR h."tenantId" = r."tenantId")
              AND (h."userId" IS NULL OR h."userId" = r."actorUserId")
          ) AS on_hold
          FROM public."DataChangeLog" r WHERE r."occurredAt" < cutoff
        ) AS rows;
      RETURN;
    END IF;
    RETURN QUERY
      WITH doomed AS (
        SELECT r.id, r."correlationId" FROM public."DataChangeLog" r
        WHERE r."occurredAt" < cutoff
          AND NOT EXISTS (
            SELECT 1 FROM public."AuditLegalHold" h
            WHERE h."liftedAt" IS NULL AND h."isDeleted" = false
              AND (h."tenantId" IS NOT NULL OR h."userId" IS NOT NULL)
              AND (h."tenantId" IS NULL OR h."tenantId" = r."tenantId")
              AND (h."userId" IS NULL OR h."userId" = r."actorUserId")
          )
        ORDER BY r."occurredAt"
        LIMIT batch_size
      ), deleted AS (
        DELETE FROM public."DataChangeLog" r USING doomed d WHERE r.id = d.id RETURNING r."correlationId"
      ), emptied_groups AS (
        -- A group whose changes are all gone has nothing left to index.
        DELETE FROM public."DataChangeGroup" g
        WHERE g."correlationId" IN (SELECT DISTINCT "correlationId" FROM deleted)
          AND NOT EXISTS (
            SELECT 1 FROM public."DataChangeLog" l
            WHERE l."correlationId" = g."correlationId"
              AND l.id NOT IN (SELECT id FROM doomed)
          )
        RETURNING 1
      )
      SELECT (SELECT count(*) FROM deleted)::bigint, 0::bigint;
    RETURN;
  END IF;

  RAISE EXCEPTION 'unknown retention target %', target USING ERRCODE = 'invalid_parameter_value';
END;
$$;

ALTER FUNCTION public.app_purge_audit_batch(text, bigint, integer, boolean) OWNER TO app_retention;
REVOKE ALL ON FUNCTION public.app_purge_audit_batch(text, bigint, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_purge_audit_batch(text, bigint, integer, boolean) TO app_runtime;
