-- ============================================================================
-- 95 — audit trail live signal (`NOTIFY audit_trail`)
-- ============================================================================
-- The admin audit log updates live: the API LISTENs on `audit_trail` and
-- streams a "something changed" signal to the page over SSE
-- (`GET /admin/audit-trail/events`), which refetches through the normal list
-- endpoint. The signal comes from the database, not the API, because the audit
-- trail has writers the API never sees: background jobs, scripts and manual
-- SQL write `DataChangeLog` through the capture triggers.
--
-- The payload is only the table name — never a row's content; whoever is
-- told reads the trail through its own authorized endpoint. NOTIFY is
-- delivered on commit (a rolled-back write signals nothing) and identical
-- notifications of one transaction collapse into one.
--
--   audit_logs        once per request row, EXCEPT reads of the audit log
--                     itself: viewing the log is audited, and signalling those
--                     reads would make every open page refetch forever.
--   data_change_logs  once per statement — a bulk job signals once.
--
-- Idempotent: the function is replaced, the triggers dropped and recreated.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_trail_notify() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM pg_notify('audit_trail', TG_TABLE_NAME);
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS audit_trail_notify ON public."AuditLog";
CREATE TRIGGER audit_trail_notify
  AFTER INSERT ON public."AuditLog"
  FOR EACH ROW
  WHEN (NOT (NEW.method = 'GET' AND NEW.endpoint ~ '^/api/v[0-9]+/admin/(audit-|data-changes)'))
  EXECUTE FUNCTION public.audit_trail_notify();

DROP TRIGGER IF EXISTS audit_trail_notify ON public."DataChangeLog";
CREATE TRIGGER audit_trail_notify
  AFTER INSERT ON public."DataChangeLog"
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.audit_trail_notify();
