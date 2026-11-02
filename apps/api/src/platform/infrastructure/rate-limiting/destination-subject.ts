import { createHash } from "node:crypto";

import type { RateLimitSubject } from "../../application/ports/rate-limiter.port";

/**
 * The rate-limit subject of an email address or E.164 phone number: a SHA-256 of the normalized
 * value, so no address or number is ever written to Redis or the refusal log (ADR 071).
 */
export function destinationSubject(destination: string): RateLimitSubject {
	return { kind: "destination", id: createHash("sha256").update(destination.trim().toLowerCase()).digest("hex") };
}
