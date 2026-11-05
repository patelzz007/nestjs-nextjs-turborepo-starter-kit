// ============================================
// inbound-webhook-receiver.port.ts - The one path every inbound webhook takes (ADR 081)
// ============================================
// verify → claim (provider, delivery id) → hand to the owning context → record the outcome. A receiving
// context keeps its route, its responses and its handler; it hands the receiver its keyed verifier, its
// provider profile, the errors its route answers with, and its handler. A redelivery answers
// `{ kind: "duplicate" }` (the route answers its provider's usual 2xx) without reaching the handler.

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { InboundWebhookEnvelope, InboundWebhookProfile } from "../../domain/deliveries/inbound-webhook-profile";
import type { InboundWebhookRequest } from "../../domain/inbound-webhook-request";
import type { RejectedSignatureCheck, WebhookSignatureVerifier } from "../../domain/signature-check";

/** What the owning context made of a verified, first-seen delivery. */
export interface InboundWebhookHandling<TResult> {
	/** RECORDED (applied or stored), DUPLICATE (it already had it) or IGNORED (verified, nothing to act on). */
	readonly outcome: "RECORDED" | "DUPLICATE" | "IGNORED";
	readonly result: TResult;
	/** The event's name when only the owner can read it from the body; omitted keeps the profile's. */
	readonly eventType?: string;
}

/** One received request, and what its route does with each turn of it. */
export interface ReceiveWebhookInput<TResult> {
	readonly actor: ActorContext;
	readonly profile: InboundWebhookProfile;
	readonly request: InboundWebhookRequest;
	/** The provider's key on this server; null when none is configured (nothing can be verified). */
	readonly verifier: WebhookSignatureVerifier | null;
	/** The status the route answers a delivery it accepted with (its `@HttpCode`), recorded on the row. */
	readonly successStatus: number;
	/** The route's answer when it has no key (a 503, so the provider retries): logged, then thrown. */
	notConfigured(): Error;
	/** The route's answer to a missing or bad signature (its own status and message): logged, then thrown. */
	rejected(check: RejectedSignatureCheck): Error;
	/** Hands the delivery to its owning context. What it throws is logged (REJECTED for a 4xx, FAILED otherwise), then rethrown. */
	handle(envelope: InboundWebhookEnvelope): Promise<InboundWebhookHandling<TResult>>;
}

/** What became of a verified request: a redelivery answered without processing, or the owner's handling. */
export type WebhookReception<TResult> = { readonly kind: "duplicate" } | ({ readonly kind: "handled" } & InboundWebhookHandling<TResult>);

export interface InboundWebhookReceiverPort {
	receive<TResult>(input: ReceiveWebhookInput<TResult>): Promise<WebhookReception<TResult>>;
}
