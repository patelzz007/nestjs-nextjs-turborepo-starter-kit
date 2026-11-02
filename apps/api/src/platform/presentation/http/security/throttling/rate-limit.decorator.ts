import { applyDecorators, SetMetadata } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

import { ALWAYS_ON_THROTTLERS, RATE_LIMIT_POLICY, type RateLimitPolicy, type RateLimitThrottlerName } from "./rate-limit-policy";
import { RATE_LIMIT_THROTTLER_KEY, throttleTrackerFunction } from "./throttle-tracker";

/** Reflector key the coverage test reads to see which named policy a route declared. */
export const RATE_LIMIT_POLICY_KEY = "rate_limit_policy";

/** Reflector key for an explicit skip. The value is the reason the route is not limited. */
export const RATE_LIMIT_SKIP_REASON_KEY = "rate_limit_skip_reason";

export { RATE_LIMIT_POLICY };

/**
 * The always-on throttler that also counts every route with a policy of its own: the per-principal
 * backstop, kept above every policy's limit (rate-limit-policies.e2e-spec.ts checks that).
 */
const BACKSTOP_THROTTLER: RateLimitThrottlerName = "default";

/**
 * The always-on throttlers a policy's route skips, so the route is counted by its own policy (plus the
 * per-principal backstop) and nothing stricter it didn't ask for (ADR 071; DDD + CQRS plan §10.2–10.3):
 *
 * - a `strict` policy (credential routes, per client IP): skips nothing; `default` still backs it up;
 * - a `default` policy (per principal): skips `strict`, so a signed-in user's mutations are never also
 *   capped per client IP at the credential limit (everyone behind one office address would share it);
 * - an opt-in throttler (`webhook`): skips both, counted by that throttler only.
 *
 * Every request is still counted per client IP by the `preAuth` throttler, in its own guard.
 */
export function alwaysOnThrottlersSkippedBy(policy: RateLimitPolicy): readonly RateLimitThrottlerName[] {
	const alwaysOn: readonly RateLimitThrottlerName[] = ALWAYS_ON_THROTTLERS;
	if (!alwaysOn.includes(policy.throttler)) {
		return alwaysOn;
	}
	return alwaysOn.filter((name: RateLimitThrottlerName): boolean => name !== policy.throttler && name !== BACKSTOP_THROTTLER);
}

/** The `@Throttle` the policy maps to (its limit, window and tracker override its named throttler), and any `@SkipThrottle`. */
function throttleDecorators(policy: RateLimitPolicy): MethodDecorator[] {
	const throttle: MethodDecorator = Throttle({
		[policy.throttler]: { ttl: policy.ttlMs, limit: policy.limit, getTracker: throttleTrackerFunction(policy.tracker) },
	});
	const skipped = alwaysOnThrottlersSkippedBy(policy);
	if (skipped.length === 0) {
		return [throttle];
	}
	return [throttle, SkipThrottle(Object.fromEntries(skipped.map((name): [string, boolean] => [name, true])))];
}

/** Declare the named policy for one route. Replaces a raw `@Throttle({...})` literal. */
export function RateLimit(policy: RateLimitPolicy): MethodDecorator {
	return applyDecorators(...throttleDecorators(policy), SetMetadata(RATE_LIMIT_POLICY_KEY, policy.name), SetMetadata(RATE_LIMIT_THROTTLER_KEY, policy.throttler));
}
