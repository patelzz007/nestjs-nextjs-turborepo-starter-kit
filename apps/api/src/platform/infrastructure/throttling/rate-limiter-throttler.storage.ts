import { Inject, Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";

import { RATE_LIMITER, type RateLimiter, type RateLimitSubjectKind } from "../../application/ports/rate-limiter.port";
import { SECURITY_PENALTY } from "../rate-limiting/security-penalty";

const MS_PER_SECOND = 1_000;

/**
 * The throttlers that guard credentials and unauthenticated traffic (ADR 071): they fail closed when
 * Redis is down and carry the growing penalty. `default` and `webhook` fail open without one.
 */
export const SECURITY_THROTTLERS: readonly string[] = ["preAuth", "strict"];

/**
 * The policy name each `@nestjs/throttler` throttler counts under (Redis keys, the refusal log, the
 * `RateLimit-Policy` header): the same SCREAMING_SNAKE names as every other policy (ADR 071).
 */
const THROTTLER_POLICY_NAMES: Readonly<Record<string, string>> = {
	preAuth: "PRE_AUTH",
	strict: "SECURITY_ROUTES",
	default: "AUTHENTICATED_ROUTES",
	webhook: "WEBHOOK",
};

/** The policy a throttler counts under; an unknown throttler keeps its own name. */
export function throttlerPolicyName(throttlerName: string): string {
	return THROTTLER_POLICY_NAMES[throttlerName] ?? throttlerName;
}

/** The subject kind a throttler's tracker counts (`default` tracks the principal; the rest the address). */
function subjectKindOf(throttlerName: string): RateLimitSubjectKind {
	return throttlerName === "default" ? "principal" : "ip";
}

/** `@nestjs/throttler` reads both times in whole seconds (they become `Retry-After`). */
function toSeconds(milliseconds: number): number {
	return Math.max(1, Math.ceil(milliseconds / MS_PER_SECOND));
}

/**
 * `@nestjs/throttler`'s storage, counted by the shared {@link RateLimiter}: one atomic sliding-window
 * decision per call, so a key can never be left without its expiry and a window edge cannot double a
 * burst. Registered as the `storage` of the one `ThrottlerModule` (see `ThrottlingModule`).
 */
@Injectable()
export class RateLimiterThrottlerStorage implements ThrottlerStorage {
	public constructor(@Inject(RATE_LIMITER) private readonly limiter: RateLimiter) {}

	public async increment(key: string, ttl: number, limit: number, _blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
		const security = SECURITY_THROTTLERS.includes(throttlerName);
		const decision = await this.limiter.consume({
			policyName: throttlerPolicyName(throttlerName),
			rule: { algorithm: "sliding-window", limit, windowMs: ttl, penalty: security ? SECURITY_PENALTY : null },
			subject: { kind: subjectKindOf(throttlerName), id: key },
			cost: 1,
			failMode: security ? "closed" : "open",
		});
		return {
			totalHits: decision.allowed ? limit - decision.remaining : limit + 1,
			timeToExpire: toSeconds(decision.resetAfterMs),
			isBlocked: !decision.allowed,
			timeToBlockExpire: decision.allowed ? 0 : toSeconds(decision.retryAfterMs),
		};
	}
}
