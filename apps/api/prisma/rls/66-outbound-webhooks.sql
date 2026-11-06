-- ============================================================================
-- 66 — Outgoing webhooks for integrators (ADR 082)
-- ============================================================================
-- Who may see what:
--   * Endpoints and the delivery log: that tenant's members read and write them (the console's
--     `merchant:manage_webhooks` check runs before every use); the fan-out and the delivery worker reach
--     them through the `webhooks.outbound.*` system operations (src/prisma/system-operation.registry.ts).
--   * Events: the same treatment as `OutboxEvent` (10-policies.sql). An event is written by an in-transaction
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

DROP POLICY IF EXISTS webhook_event_append ON public."WebhookEvent";
CREATE POLICY webhook_event_append ON public."WebhookEvent"
  FOR INSERT
  WITH CHECK ("fannedOutAt" IS NULL);
