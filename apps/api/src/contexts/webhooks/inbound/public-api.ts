/*
 * The inbound half of the webhooks context's public surface (ADR 081). Receiving contexts import only
 * this file (or the context's own public-api.ts, which re-exports it).
 *
 * - `WebhooksInboundModule`: import it for `INBOUND_WEBHOOK_RECEIVER` (`InboundWebhookReceiverPort`),
 *   the one path every inbound webhook takes — verify → claim → hand to your handler → record.
 * - The signature schemes (one keyed verifier per scheme) and the provider profiles (how each
 *   provider's deliveries are told apart). A receiving context keys a verifier with its own secret.
 * - `inboundWebhookRequest`: a route's raw body and headers as the receiver takes them.
 */
export type { InboundWebhookHandling, InboundWebhookReceiverPort, ReceiveWebhookInput, WebhookReception } from "./application/ports/inbound-webhook-receiver.port";
export { INBOUND_WEBHOOK_RECEIVER } from "./application/ports/webhooks-inbound.tokens";
export type { InboundWebhookEnvelope, InboundWebhookProfile } from "./domain/deliveries/inbound-webhook-profile";
export {
	BILLPLZ_CALLBACK_PROFILE,
	CHIP_CALLBACK_PROFILE,
	FAKE_PAYMENT_CALLBACK_PROFILE,
	GITHUB_WEBHOOK_PROFILE,
	RESEND_WEBHOOK_PROFILE,
	TWILIO_INBOUND_MESSAGE_PROFILE,
	TWILIO_STATUS_CALLBACK_PROFILE,
} from "./domain/deliveries/provider-profiles";
export { inboundWebhookRequest, type InboundWebhookHeaders, type InboundWebhookRequest } from "./domain/inbound-webhook-request";
export type { EpochMsSource, RejectedSignatureCheck, SignatureCheck, WebhookSignatureVerifier } from "./domain/signature-check";
export { formFields } from "./domain/form-fields";
export { BILLPLZ_SIGNATURE_FIELD, BillplzSignatureVerifier, billplzSignature, billplzSignatureSource } from "./domain/signatures/billplz-x-signature.signature";
export { HmacSha256HeaderVerifier, hmacSha256HeaderSignature, type HmacSha256HeaderScheme } from "./domain/signatures/hmac-sha256-header.signature";
export { RsaSha256HeaderVerifier } from "./domain/signatures/rsa-sha256-header.signature";
export {
	missingStandardWebhookHeaders,
	StandardWebhooksVerifier,
	standardWebhookHeaders,
	STANDARD_WEBHOOKS_TOLERANCE_SECONDS,
} from "./domain/signatures/standard-webhooks.signature";
export { TWILIO_SIGNATURE_HEADER, TwilioSignatureVerifier, twilioSignature } from "./domain/signatures/twilio-request.signature";

// ── The Nest module (last: the values above must be initialised before its graph loads) ──
export { WebhooksInboundModule } from "./webhooks-inbound.module";
