-- ============================================================================
-- 57 — Inbound webhooks (ADR 081): the received-webhook log, bypass-only
-- ============================================================================
-- `ReceivedWebhook` holds what providers (GitHub, Resend, Billplz, CHIP, Twilio, the fake gateway)
-- sent this server. No tenant and no end user owns a row, and no session ever reads one directly:
-- the receivers write it under `webhooks.inbound.record` (before and after the owning context's own
-- operation), the admin viewer reads it under `webhooks.inbound.read` after its AUDIT_LOG check
-- (src/prisma/system-operation.registry.ts). The one policy admits exactly those operations.
-- Idempotent.
-- ============================================================================

ALTER TABLE public."ReceivedWebhook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ReceivedWebhook" FORCE ROW LEVEL SECURITY;

