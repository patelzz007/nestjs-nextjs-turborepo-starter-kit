-- ============================================================================
-- 50 — Platform operations (ADR 068): bypass-only tables
-- ============================================================================
-- The operations console's tables hold platform data no tenant and no end user owns: servers and
-- their agent credentials, the metric history, alerts, the settings, backups and load tests. Every
-- read and write runs under a named `operations.*` / `load_test.*` system operation
-- (src/prisma/system-operation.registry.ts), so the only policy each table has admits exactly that.
-- Idempotent.
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[    'OpsServer',
    'OpsServerSample',
    'OpsInstanceSample',
    'OpsDependencySample',
    'OpsAlert',
    'OpsSettings',
    'OpsBackup',
    'OpsRestoreDrill',
    'StatusIncident',
    'StatusIncidentUpdate',
    'FeatureFlagCatalogVersion',
    'FeatureFlagKillSwitch',
    'FlagRevision',
    'FeatureFlagOverride',
    'FlagGroup',
    'FlagGroupMember',
    'FeatureFlagExposure',
    'FeatureFlagExposureDaily',
    'Experiment',
    'ExperimentMetricEvent',
    'ExperimentResult',
    'LoadTestRun',
    'LoadTestPoint',
    'LoadTestStepStat'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- The public status page (enhancement 4.5): read anonymously and written by staff, always under a named
-- `operations.status.*` system operation.

-- Feature flags v2 (ADR 086, ADR 087): the catalogue version, kill switches, revisions, flag overrides and flag
-- groups are read and written only under a named `feature_flags.*` system operation (the API evaluates every
-- flag; no client reads these tables). Exposures, their daily sums, experiments and experiment results are also
-- read by the API under those operations; the analytics consumer's own access is in 90-analytics-consumer.sql.

