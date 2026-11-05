// ============================================
// notification-webhook-verifiers.port.ts - The keys Resend's and Twilio's callbacks are checked with (ADR 070, ADR 081)
// ============================================
// Each provider's signature scheme lives in the shared inbound receiver (`webhooks/inbound`); this port keys
// them with this deployment's secrets. A provider this server is not configured for has no verifier (null),
// which the receiver answers 503 so the provider retries once it is.

import type { WebhookSignatureVerifier } from "../../../webhooks/inbound/public-api";

/** Twilio's two callbacks: a sent message's delivery status, and a message someone sent us (STOP). */
export type TwilioCallbackKind = "status" | "inbound";

export interface NotificationWebhookVerifiersPort {
	/** Resend's (Standard Webhooks, through Svix), keyed by `RESEND_WEBHOOK_SECRET`; null when it is unset. */
	resend(): WebhookSignatureVerifier | null;
	/** Twilio's, keyed by the auth token and the exact public URL of that callback; null when Twilio is not configured. */
	twilio(kind: TwilioCallbackKind): WebhookSignatureVerifier | null;
}
