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
CREATE POLICY notification_insert ON public."Notification" FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS marketing_consent_read ON public."MarketingConsent";
CREATE POLICY marketing_consent_read ON public."MarketingConsent"
  FOR SELECT
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('MarketingConsent')));
DROP POLICY IF EXISTS marketing_consent_insert ON public."MarketingConsent";
CREATE POLICY marketing_consent_insert ON public."MarketingConsent"
  FOR INSERT
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('MarketingConsent')));

DROP POLICY IF EXISTS tenant_customer_read ON public."TenantCustomer";
CREATE POLICY tenant_customer_read ON public."TenantCustomer"
  FOR SELECT
  USING (app_owns("userId") OR app_tenant_member_of("tenantId") OR (SELECT app_rls_bypass_on('TenantCustomer')));
-- A till's checkout (API-key session) creates and stamps its own tenant's links: a referrer's credit
-- claim and a redemption happen there (ADR 073). Only rows of the key's tenant.

DROP POLICY IF EXISTS broadcast_read ON public."Broadcast";
CREATE POLICY broadcast_read ON public."Broadcast"
  FOR SELECT
  USING (("tenantId" IS NOT NULL AND app_tenant_member_of("tenantId")) OR (SELECT app_rls_bypass_on('Broadcast')));

DROP POLICY IF EXISTS broadcast_report_own ON public."BroadcastReport";
CREATE POLICY broadcast_report_own ON public."BroadcastReport"
  FOR SELECT
  USING (app_owns("reporterUserId") OR (SELECT app_rls_bypass_on('BroadcastReport')));
DROP POLICY IF EXISTS broadcast_report_file ON public."BroadcastReport";
CREATE POLICY broadcast_report_file ON public."BroadcastReport"
  FOR INSERT
  WITH CHECK (app_owns("reporterUserId") OR (SELECT app_rls_bypass_on('BroadcastReport')));

