-- ============================================================================
-- 66 — Outgoing webhooks for integrators (ADR 082)
-- ============================================================================
-- Who may see what:
--   * Endpoints and the delivery log: that tenant's members read and write them (the console's
--     `merchant:manage_webhooks` check runs before every use); the fan-out and the delivery worker reach
--     them through the `webhooks.outbound.*` system operations (src/prisma/system-operation.registry.ts).
--   * Events: the same treatment as `OutboxEvent` (rls.sql). An event is written by an in-transaction
--     handler in the PRODUCER'S transaction, under that producer's own (tenant, user or system) session, so
--     any app session may APPEND a fresh row — nothing more: no SELECT (so no INSERT … RETURNING; the
--     producer assigns the id), no UPDATE / DELETE, no row that claims to be fanned out already. Reading,
--     fanning out and purging stay bypass-only. Widening every producer's system-operation scope instead
--     would grant each of them reads of every tenant's events.
-- Idempotent.
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'WebhookEndpoint',
    'WebhookEvent',
    'WebhookDelivery'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS webhook_endpoint_tenant ON public."WebhookEndpoint";
CREATE POLICY webhook_endpoint_tenant ON public."WebhookEndpoint"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('WebhookEndpoint')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('WebhookEndpoint')));

DROP POLICY IF EXISTS webhook_delivery_tenant ON public."WebhookDelivery";
CREATE POLICY webhook_delivery_tenant ON public."WebhookDelivery"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('WebhookDelivery')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('WebhookDelivery')));

DROP POLICY IF EXISTS webhook_event_bypass ON public."WebhookEvent";
CREATE POLICY webhook_event_bypass ON public."WebhookEvent"
  USING ((SELECT app_rls_bypass_on('WebhookEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('WebhookEvent')));

DROP POLICY IF EXISTS webhook_event_append ON public."WebhookEvent";
CREATE POLICY webhook_event_append ON public."WebhookEvent"
  FOR INSERT
  WITH CHECK ("fannedOutAt" IS NULL);
