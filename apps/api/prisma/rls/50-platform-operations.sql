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
    'FeatureFlagSetting',
    'FeatureFlagStoreOverride',
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

-- Runtime feature flags (enhancement 5.6): read by every admin staff member, changed with FEATURE_FLAG:UPDATE,
-- always under a named `feature_flags.*` system operation.

-- A store's own setting of a store feature flag (enhancement 5.11): only under the `feature_flags.*` operations.

