-- ============================================================================
-- 90 — analytics_consumer: the analytics consumer's least-privilege role
-- ============================================================================
-- apps/analytics-consumer connects with its OWN login
-- (ANALYTICS_CONSUMER_DATABASE_URL), a member of this NOLOGIN group role, and
-- never switches role or sets `app.rls_bypass`. What it may do is exactly
-- what the ingest and retention paths need:
--
--   inbox_processed_events  SELECT, INSERT, DELETE   claim (ON CONFLICT DO NOTHING) + retention purge
--   analytics_events        INSERT, SELECT (id)      the analytics row; ON CONFLICT (id) needs SELECT on its arbiter column
--   inbox_dead_letters      SELECT, INSERT, DELETE   park + retention purge
--
-- No other table, no sequence, no UPDATE, no DDL. The tables' bypass policies
-- (prisma/rls.sql) apply to `app_runtime` only, so even a consumer session
-- that sets `app.rls_bypass` gains nothing: its rows are limited to the
-- `analytics-warehouse` inbox consumer id (ANALYTICS_CONSUMER_ID in
-- apps/analytics-consumer/src/message-handler.ts — keep the two in step).
--
-- The LOGIN role (name + password from ANALYTICS_CONSUMER_DATABASE_URL) is
-- created by `pnpm --filter @workspace/analytics-consumer db:provision-login`
-- or by your infrastructure tooling — credentials never live in this file.
-- Idempotent: REVOKE first, so a grant removed here is removed from existing
-- databases too.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_consumer') THEN
    CREATE ROLE analytics_consumer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM analytics_consumer;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM analytics_consumer;

GRANT USAGE ON SCHEMA public TO analytics_consumer;
GRANT SELECT, INSERT, DELETE ON TABLE public.inbox_processed_events TO analytics_consumer;
GRANT INSERT ON TABLE public.analytics_events TO analytics_consumer;
GRANT SELECT (id) ON TABLE public.analytics_events TO analytics_consumer;
GRANT SELECT, INSERT, DELETE ON TABLE public.inbox_dead_letters TO analytics_consumer;

DROP POLICY IF EXISTS inbox_processed_events_analytics_consumer ON public.inbox_processed_events;
CREATE POLICY inbox_processed_events_analytics_consumer ON public.inbox_processed_events
  TO analytics_consumer
  USING (consumer = 'analytics-warehouse')
  WITH CHECK (consumer = 'analytics-warehouse');

-- INSERT … ON CONFLICT (id) checks the new row against SELECT policies as
-- well (the arbiter is read), hence the SELECT policy; the column grant above
-- still limits what the role can actually read to `id`.
DROP POLICY IF EXISTS analytics_events_analytics_consumer_insert ON public.analytics_events;
CREATE POLICY analytics_events_analytics_consumer_insert ON public.analytics_events
  FOR INSERT
  TO analytics_consumer
  WITH CHECK (true);

DROP POLICY IF EXISTS analytics_events_analytics_consumer_select ON public.analytics_events;
CREATE POLICY analytics_events_analytics_consumer_select ON public.analytics_events
  FOR SELECT
  TO analytics_consumer
  USING (true);

DROP POLICY IF EXISTS inbox_dead_letters_analytics_consumer ON public.inbox_dead_letters;
CREATE POLICY inbox_dead_letters_analytics_consumer ON public.inbox_dead_letters
  TO analytics_consumer
  USING (consumer = 'analytics-warehouse')
  WITH CHECK (consumer = 'analytics-warehouse');
