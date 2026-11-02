// ============================================
// notifications/domain/policies/mask-destination.ts — how the delivery log keys a destination (ADR 070)
// ============================================

import { createHash } from "node:crypto";

/** The lookup key of an address: a SHA-256 of its normalized form, never the address. */
export function destinationHash(address: string): string {
	return createHash("sha256").update(address.trim().toLowerCase()).digest("hex");
}
