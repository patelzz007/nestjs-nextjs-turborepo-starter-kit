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


DROP POLICY IF EXISTS ops_server_bypass ON public."OpsServer";
CREATE POLICY ops_server_bypass ON public."OpsServer"
  USING ((SELECT app_rls_bypass_on('OpsServer')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsServer')));

DROP POLICY IF EXISTS ops_server_sample_bypass ON public."OpsServerSample";
CREATE POLICY ops_server_sample_bypass ON public."OpsServerSample"
  USING ((SELECT app_rls_bypass_on('OpsServerSample')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsServerSample')));

DROP POLICY IF EXISTS ops_instance_sample_bypass ON public."OpsInstanceSample";
CREATE POLICY ops_instance_sample_bypass ON public."OpsInstanceSample"
  USING ((SELECT app_rls_bypass_on('OpsInstanceSample')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsInstanceSample')));

DROP POLICY IF EXISTS ops_dependency_sample_bypass ON public."OpsDependencySample";
CREATE POLICY ops_dependency_sample_bypass ON public."OpsDependencySample"
  USING ((SELECT app_rls_bypass_on('OpsDependencySample')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsDependencySample')));

DROP POLICY IF EXISTS ops_alert_bypass ON public."OpsAlert";
CREATE POLICY ops_alert_bypass ON public."OpsAlert"
  USING ((SELECT app_rls_bypass_on('OpsAlert')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsAlert')));

DROP POLICY IF EXISTS ops_settings_bypass ON public."OpsSettings";
CREATE POLICY ops_settings_bypass ON public."OpsSettings"
  USING ((SELECT app_rls_bypass_on('OpsSettings')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsSettings')));

DROP POLICY IF EXISTS ops_backup_bypass ON public."OpsBackup";
CREATE POLICY ops_backup_bypass ON public."OpsBackup"
  USING ((SELECT app_rls_bypass_on('OpsBackup')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsBackup')));

DROP POLICY IF EXISTS ops_restore_drill_bypass ON public."OpsRestoreDrill";
CREATE POLICY ops_restore_drill_bypass ON public."OpsRestoreDrill"
  USING ((SELECT app_rls_bypass_on('OpsRestoreDrill')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsRestoreDrill')));

-- The public status page (enhancement 4.5): read anonymously and written by staff, always under a named
-- `operations.status.*` system operation.
DROP POLICY IF EXISTS status_incident_bypass ON public."StatusIncident";
CREATE POLICY status_incident_bypass ON public."StatusIncident"
  USING ((SELECT app_rls_bypass_on('StatusIncident')))
  WITH CHECK ((SELECT app_rls_bypass_on('StatusIncident')));

DROP POLICY IF EXISTS status_incident_update_bypass ON public."StatusIncidentUpdate";
CREATE POLICY status_incident_update_bypass ON public."StatusIncidentUpdate"
  USING ((SELECT app_rls_bypass_on('StatusIncidentUpdate')))
  WITH CHECK ((SELECT app_rls_bypass_on('StatusIncidentUpdate')));

-- Runtime feature flags (enhancement 5.6): read by every admin staff member, changed with FEATURE_FLAG:UPDATE,
-- always under a named `feature_flags.*` system operation.
DROP POLICY IF EXISTS feature_flag_setting_bypass ON public."FeatureFlagSetting";
CREATE POLICY feature_flag_setting_bypass ON public."FeatureFlagSetting"
  USING ((SELECT app_rls_bypass_on('FeatureFlagSetting')))
  WITH CHECK ((SELECT app_rls_bypass_on('FeatureFlagSetting')));

-- A store's own setting of a store feature flag (enhancement 5.11): only under the `feature_flags.*` operations.
DROP POLICY IF EXISTS feature_flag_store_override_bypass ON public."FeatureFlagStoreOverride";
CREATE POLICY feature_flag_store_override_bypass ON public."FeatureFlagStoreOverride"
  USING ((SELECT app_rls_bypass_on('FeatureFlagStoreOverride')))
  WITH CHECK ((SELECT app_rls_bypass_on('FeatureFlagStoreOverride')));

DROP POLICY IF EXISTS load_test_run_bypass ON public."LoadTestRun";
CREATE POLICY load_test_run_bypass ON public."LoadTestRun"
  USING ((SELECT app_rls_bypass_on('LoadTestRun')))
  WITH CHECK ((SELECT app_rls_bypass_on('LoadTestRun')));

DROP POLICY IF EXISTS load_test_point_bypass ON public."LoadTestPoint";
CREATE POLICY load_test_point_bypass ON public."LoadTestPoint"
  USING ((SELECT app_rls_bypass_on('LoadTestPoint')))
  WITH CHECK ((SELECT app_rls_bypass_on('LoadTestPoint')));

DROP POLICY IF EXISTS load_test_step_stat_bypass ON public."LoadTestStepStat";
CREATE POLICY load_test_step_stat_bypass ON public."LoadTestStepStat"
  USING ((SELECT app_rls_bypass_on('LoadTestStepStat')))
  WITH CHECK ((SELECT app_rls_bypass_on('LoadTestStepStat')));
