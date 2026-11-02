-- ============================================================================
-- 60 — Notifications, broadcasts and tenant customers (ADR 070, 073), rate-limit overrides (ADR 071)
-- ============================================================================
-- Who may see what:
--   * A person's own inbox, preferences, schedule, push devices and consent history: `app_owns("userId")`.
--     Consent is append-only (UPDATE/DELETE withheld in withheld-privileges.ts): it is proof.
--   * Notifications, deliveries, suppressions, strikes and rate-limit overrides: only the named
--     `notifications.*` / `broadcasts.*` / `rate_limits.*` system operations (src/prisma/system-operation.registry.ts).
--   * Tenant customers and a tenant's broadcasts: that tenant's members read them; the customer reads
--     their own links; every write is a system operation.
--   * Broadcast reports: the reporter files and reads their own; review is a system operation.
-- Idempotent.
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Notification',
    'NotificationDelivery',
    'InAppNotification',
    'NotificationPreference',
    'NotificationSchedule',
    'MarketingConsent',
    'NotificationSuppression',
    'PushDevice',
    'TenantCustomer',
    'Broadcast',
    'BroadcastReport',
    'TenantBroadcastStrike',
    'TenantRateLimitOverride'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Any transaction may REQUEST a notification (the producer's own unit of work, like EmailLog): the row
-- commits with the business change. Reading and changing it is the fan-out's and workers' alone.
DROP POLICY IF EXISTS notification_bypass ON public."Notification";
DROP POLICY IF EXISTS notification_insert ON public."Notification";
DROP POLICY IF EXISTS notification_select ON public."Notification";
DROP POLICY IF EXISTS notification_update ON public."Notification";
DROP POLICY IF EXISTS notification_delete ON public."Notification";
CREATE POLICY notification_insert ON public."Notification" FOR INSERT WITH CHECK (true);
CREATE POLICY notification_select ON public."Notification" FOR SELECT USING ((SELECT app_rls_bypass_on('Notification')));
CREATE POLICY notification_update ON public."Notification" FOR UPDATE USING ((SELECT app_rls_bypass_on('Notification'))) WITH CHECK ((SELECT app_rls_bypass_on('Notification')));
CREATE POLICY notification_delete ON public."Notification" FOR DELETE USING ((SELECT app_rls_bypass_on('Notification')));

DROP POLICY IF EXISTS notification_delivery_bypass ON public."NotificationDelivery";
CREATE POLICY notification_delivery_bypass ON public."NotificationDelivery"
  USING ((SELECT app_rls_bypass_on('NotificationDelivery')))
  WITH CHECK ((SELECT app_rls_bypass_on('NotificationDelivery')));

DROP POLICY IF EXISTS in_app_notification_own ON public."InAppNotification";
CREATE POLICY in_app_notification_own ON public."InAppNotification"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('InAppNotification')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('InAppNotification')));

DROP POLICY IF EXISTS notification_preference_own ON public."NotificationPreference";
CREATE POLICY notification_preference_own ON public."NotificationPreference"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('NotificationPreference')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('NotificationPreference')));

DROP POLICY IF EXISTS notification_schedule_own ON public."NotificationSchedule";
CREATE POLICY notification_schedule_own ON public."NotificationSchedule"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('NotificationSchedule')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('NotificationSchedule')));

DROP POLICY IF EXISTS marketing_consent_read ON public."MarketingConsent";
CREATE POLICY marketing_consent_read ON public."MarketingConsent"
  FOR SELECT
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('MarketingConsent')));
DROP POLICY IF EXISTS marketing_consent_insert ON public."MarketingConsent";
CREATE POLICY marketing_consent_insert ON public."MarketingConsent"
  FOR INSERT
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('MarketingConsent')));

DROP POLICY IF EXISTS notification_suppression_bypass ON public."NotificationSuppression";
CREATE POLICY notification_suppression_bypass ON public."NotificationSuppression"
  USING ((SELECT app_rls_bypass_on('NotificationSuppression')))
  WITH CHECK ((SELECT app_rls_bypass_on('NotificationSuppression')));

DROP POLICY IF EXISTS push_device_own ON public."PushDevice";
CREATE POLICY push_device_own ON public."PushDevice"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('PushDevice')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('PushDevice')));

DROP POLICY IF EXISTS tenant_customer_read ON public."TenantCustomer";
CREATE POLICY tenant_customer_read ON public."TenantCustomer"
  FOR SELECT
  USING (app_owns("userId") OR app_tenant_member_of("tenantId") OR (SELECT app_rls_bypass_on('TenantCustomer')));
-- A till's checkout (API-key session) creates and stamps its own tenant's links: a referrer's credit
-- claim and a redemption happen there (ADR 073). Only rows of the key's tenant.
DROP POLICY IF EXISTS tenant_customer_api_key_read ON public."TenantCustomer";
CREATE POLICY tenant_customer_api_key_read ON public."TenantCustomer"
  FOR SELECT TO app_runtime USING (app_api_key_org_access("tenantId"));
DROP POLICY IF EXISTS tenant_customer_api_key_insert ON public."TenantCustomer";
CREATE POLICY tenant_customer_api_key_insert ON public."TenantCustomer"
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_org_access("tenantId"));
DROP POLICY IF EXISTS tenant_customer_api_key_update ON public."TenantCustomer";
CREATE POLICY tenant_customer_api_key_update ON public."TenantCustomer"
  FOR UPDATE TO app_runtime USING (app_api_key_org_access("tenantId")) WITH CHECK (app_api_key_org_access("tenantId"));
DROP POLICY IF EXISTS tenant_customer_write ON public."TenantCustomer";
CREATE POLICY tenant_customer_write ON public."TenantCustomer"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('TenantCustomer')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantCustomer')));

DROP POLICY IF EXISTS broadcast_read ON public."Broadcast";
CREATE POLICY broadcast_read ON public."Broadcast"
  FOR SELECT
  USING (("tenantId" IS NOT NULL AND app_tenant_member_of("tenantId")) OR (SELECT app_rls_bypass_on('Broadcast')));
DROP POLICY IF EXISTS broadcast_write ON public."Broadcast";
CREATE POLICY broadcast_write ON public."Broadcast"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('Broadcast')))
  WITH CHECK ((SELECT app_rls_bypass_on('Broadcast')));

DROP POLICY IF EXISTS broadcast_report_own ON public."BroadcastReport";
CREATE POLICY broadcast_report_own ON public."BroadcastReport"
  FOR SELECT
  USING (app_owns("reporterUserId") OR (SELECT app_rls_bypass_on('BroadcastReport')));
DROP POLICY IF EXISTS broadcast_report_file ON public."BroadcastReport";
CREATE POLICY broadcast_report_file ON public."BroadcastReport"
  FOR INSERT
  WITH CHECK (app_owns("reporterUserId") OR (SELECT app_rls_bypass_on('BroadcastReport')));
DROP POLICY IF EXISTS broadcast_report_review ON public."BroadcastReport";
CREATE POLICY broadcast_report_review ON public."BroadcastReport"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('BroadcastReport')))
  WITH CHECK ((SELECT app_rls_bypass_on('BroadcastReport')));

DROP POLICY IF EXISTS tenant_broadcast_strike_bypass ON public."TenantBroadcastStrike";
CREATE POLICY tenant_broadcast_strike_bypass ON public."TenantBroadcastStrike"
  USING ((SELECT app_rls_bypass_on('TenantBroadcastStrike')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantBroadcastStrike')));

DROP POLICY IF EXISTS tenant_rate_limit_override_bypass ON public."TenantRateLimitOverride";
CREATE POLICY tenant_rate_limit_override_bypass ON public."TenantRateLimitOverride"
  USING ((SELECT app_rls_bypass_on('TenantRateLimitOverride')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantRateLimitOverride')));
