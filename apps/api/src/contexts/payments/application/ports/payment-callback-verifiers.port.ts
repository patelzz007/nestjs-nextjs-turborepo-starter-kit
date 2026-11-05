import type { PaymentProviderName } from "@workspace/shared";

import type { WebhookSignatureVerifier } from "../../../webhooks/inbound/public-api";

/** Each configured gateway's keyed callback signature check (ADR 081), by name. */
export interface PaymentCallbackVerifiersPort {
	/** The gateway's callback verifier, or null when this deployment isn't configured for it. */
	callbackVerifier(name: PaymentProviderName): WebhookSignatureVerifier | null;
}
