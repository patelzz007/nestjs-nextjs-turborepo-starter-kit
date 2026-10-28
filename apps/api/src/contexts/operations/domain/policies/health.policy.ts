// ============================================
// domain/policies/health.policy.ts — UP / DOWN / UNKNOWN from when something last reported
// ============================================
// Pure functions (no I/O).

import type { EpochMs, OpsHealth } from "@workspace/shared";

/**
 * A reporter's health: `UNKNOWN` if it never reported, `DOWN` once it has been silent for longer than
 * `silentAfterMs`, `UP` otherwise.
 */
export function reporterHealth(lastSeenAt: EpochMs | null, now: EpochMs, silentAfterMs: number): OpsHealth {
	if (lastSeenAt === null) {
		return "UNKNOWN";
	}
	return now - lastSeenAt > silentAfterMs ? "DOWN" : "UP";
}

/** Percent of a part in a whole, 0 when the whole is 0 (a machine that reports no swap has none in use). */
export function percentOf(part: number, whole: number): number {
	const hundred = 100;
	return whole <= 0 ? 0 : Math.min(hundred, (part / whole) * hundred);
}
