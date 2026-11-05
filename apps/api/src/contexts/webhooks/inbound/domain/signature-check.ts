// ============================================
// signature-check.ts - What a signature scheme says about a request (ADR 081)
// ============================================
// One port per signature scheme (signatures/*): each is keyed with the provider's secret or public key and
// answers VALID, MISSING (nothing to check) or INVALID (wrong key, other bytes, or a signed timestamp outside
// the provider's tolerance). It never reads a field of the body as trusted before VALID.

import { createHash, timingSafeEqual } from "node:crypto";

import type { InboundWebhookRequest } from "./inbound-webhook-request";

/** A refused signature, and why (one line, for the log and the route's own message). */
export type RejectedSignatureCheck = { readonly verdict: "MISSING"; readonly reason: string } | { readonly verdict: "INVALID"; readonly reason: string };

/** What a signature scheme says about a request. */
export type SignatureCheck = { readonly verdict: "VALID" } | RejectedSignatureCheck;

/** A signature scheme, keyed for one provider (a scheme that signs a timestamp is also given the clock). */
export interface WebhookSignatureVerifier {
	verify(request: InboundWebhookRequest): SignatureCheck;
}

/** Now, in epoch milliseconds — what a timestamped scheme checks its tolerance against. */
export type EpochMsSource = () => number;

export const VALID_SIGNATURE: SignatureCheck = { verdict: "VALID" };

export function missingSignature(reason: string): RejectedSignatureCheck {
	return { verdict: "MISSING", reason };
}

export function invalidSignature(reason: string): RejectedSignatureCheck {
	return { verdict: "INVALID", reason };
}

/**
 * Whether two byte strings are equal, in time that depends on neither's content nor length: both are
 * hashed to a fixed-length digest first, so unequal lengths do not return early either.
 */
export function constantTimeEquals(left: Buffer, right: Buffer): boolean {
	return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}
