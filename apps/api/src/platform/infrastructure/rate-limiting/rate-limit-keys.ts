// ============================================
// platform/infrastructure/rate-limiting/rate-limit-keys.ts — every Redis key a rate-limit decision touches
// ============================================
// One subject of one policy owns one key family. The `{…}` hash tag keeps the family in one Redis
// Cluster slot, so a script may touch all of it atomically.

import type { RateLimitSubject } from "../../application/ports/rate-limiter.port";
import type { RedisNamespace } from "../redis/redis-namespace";

export interface RateLimitKeyFamily {
	/** Prefix of the sliding-window counters (`<base>:<window index>`). */
	readonly windowBase: string;
	readonly penalty: string;
	readonly strikes: string;
	readonly penaltyLevel: string;
	readonly bucket: string;
	readonly leases: string;
}

export function rateLimitKeyFamily(namespace: RedisNamespace, policyName: string, subject: RateLimitSubject): RateLimitKeyFamily {
	const base = namespace.key(`rl:{${policyName}:${subject.kind}:${subject.id}}`);
	return {
		windowBase: `${base}:w`,
		penalty: `${base}:penalty`,
		strikes: `${base}:strikes`,
		penaltyLevel: `${base}:level`,
		bucket: `${base}:tat`,
		leases: `${base}:leases`,
	};
}
