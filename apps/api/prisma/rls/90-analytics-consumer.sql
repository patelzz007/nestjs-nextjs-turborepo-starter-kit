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
-- (prisma/rls/10-policies.sql) apply to `app_runtime` only, so even a consumer session
-- that sets `app.rls_bypass` gains nothing: its rows are limited to the
-- `analytics-warehouse` inbox consumer id (ANALYTICS_CONSUMER_ID in
-- packages/messaging/src/inbox/message-handler.ts — keep the two in step).
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

-- The applying login may act as the consumer (`SET ROLE`), as it may act as app_runtime: `pnpm
-- db:seed` replays the outbox through the consumer's own SQL under this role (prisma/seed/
-- analytics-ingest.ts). The role is narrower than the login, so the membership widens nothing.
GRANT analytics_consumer TO CURRENT_USER;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM analytics_consumer;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM analytics_consumer;

GRANT USAGE ON SCHEMA public TO analytics_consumer;
GRANT SELECT, INSERT, DELETE ON TABLE public."InboxProcessedEvent" TO analytics_consumer;
GRANT INSERT ON TABLE public."AnalyticsEvent" TO analytics_consumer;
GRANT SELECT (id) ON TABLE public."AnalyticsEvent" TO analytics_consumer;
GRANT SELECT, INSERT, DELETE ON TABLE public."InboxDeadLetter" TO analytics_consumer;

DROP POLICY IF EXISTS inbox_processed_events_analytics_consumer ON public."InboxProcessedEvent";
CREATE POLICY inbox_processed_events_analytics_consumer ON public."InboxProcessedEvent"
  TO analytics_consumer
  USING (consumer = 'analytics-warehouse')
  WITH CHECK (consumer = 'analytics-warehouse');

-- INSERT … ON CONFLICT (id) checks the new row against SELECT policies as
-- well (the arbiter is read), hence the SELECT policy; the column grant above
-- still limits what the role can actually read to `id`.
DROP POLICY IF EXISTS analytics_events_analytics_consumer_insert ON public."AnalyticsEvent";
CREATE POLICY analytics_events_analytics_consumer_insert ON public."AnalyticsEvent"
  FOR INSERT
  TO analytics_consumer
  WITH CHECK (true);

DROP POLICY IF EXISTS analytics_events_analytics_consumer_select ON public."AnalyticsEvent";
CREATE POLICY analytics_events_analytics_consumer_select ON public."AnalyticsEvent"
  FOR SELECT
  TO analytics_consumer
  USING (true);

DROP POLICY IF EXISTS inbox_dead_letters_analytics_consumer ON public."InboxDeadLetter";
CREATE POLICY inbox_dead_letters_analytics_consumer ON public."InboxDeadLetter"
  TO analytics_consumer
  USING (consumer = 'analytics-warehouse')
  WITH CHECK (consumer = 'analytics-warehouse');

-- Feature flags v2 (ADR 087): the consumer projects `feature_flag.exposure` events into exposures, sums them per
-- day, works out running experiments' results, and purges exposures older than their 90-day window.
--
--   FeatureFlagExposure       INSERT, SELECT, DELETE      the projection (ON CONFLICT reads the arbiter), sums, purge
--   FeatureFlagExposureDaily  INSERT, SELECT, DELETE      a day's sums are rewritten while its raw rows are kept
--   ExperimentMetricEvent     INSERT, SELECT, DELETE      metric occurrences projected from claim / redeem / sign-in events, purge
--   Experiment                SELECT                      which experiments are running, their plan
--   ExperimentResult          INSERT, SELECT, UPDATE      upserted per experiment, metric and variant
GRANT SELECT, INSERT, DELETE ON TABLE public."FeatureFlagExposure" TO analytics_consumer;
GRANT SELECT, INSERT, DELETE ON TABLE public."FeatureFlagExposureDaily" TO analytics_consumer;
GRANT SELECT, INSERT, DELETE ON TABLE public."ExperimentMetricEvent" TO analytics_consumer;
GRANT SELECT ON TABLE public."Experiment" TO analytics_consumer;
GRANT SELECT, INSERT, UPDATE ON TABLE public."ExperimentResult" TO analytics_consumer;

DROP POLICY IF EXISTS feature_flag_exposures_analytics_consumer ON public."FeatureFlagExposure";
CREATE POLICY feature_flag_exposures_analytics_consumer ON public."FeatureFlagExposure"
  TO analytics_consumer
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS feature_flag_exposure_dailies_analytics_consumer ON public."FeatureFlagExposureDaily";
CREATE POLICY feature_flag_exposure_dailies_analytics_consumer ON public."FeatureFlagExposureDaily"
  TO analytics_consumer
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS experiment_metric_events_analytics_consumer ON public."ExperimentMetricEvent";
CREATE POLICY experiment_metric_events_analytics_consumer ON public."ExperimentMetricEvent"
  TO analytics_consumer
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS experiments_analytics_consumer_select ON public."Experiment";
CREATE POLICY experiments_analytics_consumer_select ON public."Experiment"
  FOR SELECT
  TO analytics_consumer
  USING ("isDeleted" = false);

DROP POLICY IF EXISTS experiment_results_analytics_consumer ON public."ExperimentResult";
CREATE POLICY experiment_results_analytics_consumer ON public."ExperimentResult"
  TO analytics_consumer
  USING (true)
  WITH CHECK (true);
