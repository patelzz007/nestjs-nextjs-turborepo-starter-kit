import type { RedemptionCheckoutInput } from "@workspace/shared";

/**
 * Fingerprint of a checkout's payload: a retried idempotency key must carry the same bill and codes
 * to be replayed. Codes are hashed into it, never stored.
 */
export interface CheckoutFingerprintPort {
	of(input: RedemptionCheckoutInput): string;
}
