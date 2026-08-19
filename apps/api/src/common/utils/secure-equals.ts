import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison. Both operands are hashed to a fixed-length
 * digest before `timingSafeEqual`, so unequal lengths do not short-circuit.
 */
export function secureEquals(a: string, b: string): boolean {
	const hashA: Buffer = createHash("sha256").update(a).digest();
	const hashB: Buffer = createHash("sha256").update(b).digest();
	return timingSafeEqual(hashA, hashB);
}
