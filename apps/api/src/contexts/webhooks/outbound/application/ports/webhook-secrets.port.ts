import type { SealedWebhookSecret } from "../../domain/aggregates/webhook-endpoint.aggregate";

/** A new signing secret: shown to the member once, stored only sealed. */
export interface NewWebhookSecret {
	readonly plaintext: string;
	readonly sealed: SealedWebhookSecret;
}

/** Signing secrets, sealed at rest (`WEBHOOK_SECRET_ENCRYPTION_KEYS`, ADR 082). */
export interface WebhookSecretsPort {
	/** Whether outgoing webhooks are configured at all: without a key ring no secret can be sealed. */
	isConfigured(): boolean;
	/** A new secret for this endpoint (the ciphertext is bound to it: copied onto another endpoint it does not open). */
	create(endpointId: string): NewWebhookSecret;
	/** The plaintext of a sealed secret of this endpoint, to sign a delivery with. */
	open(ciphertext: string, endpointId: string): string;
}
