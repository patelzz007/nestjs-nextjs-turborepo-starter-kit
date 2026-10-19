import { applyDecorators, SetMetadata } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

import { ALWAYS_ON_THROTTLERS, RATE_LIMIT_POLICY, type RateLimitPolicy } from "./rate-limit-policy";
import { RATE_LIMIT_THROTTLER_KEY, throttleTrackerFunction } from "./throttle-tracker";

/** Reflector key the coverage test reads to see which named policy a route declared. */
export const RATE_LIMIT_POLICY_KEY = "rate_limit_policy";

/** Reflector key for an explicit skip. The value is the reason the route is not limited. */
export const RATE_LIMIT_SKIP_REASON_KEY = "rate_limit_skip_reason";

export { RATE_LIMIT_POLICY };

/**
 * The `@Throttle` (and, for an opt-in throttler, `@SkipThrottle`) a policy maps to.
 *
 * The policy's limit, window and tracker override its named throttler on this
 * route. A route on an opt-in throttler (`webhook`) is counted by that throttler
 * only, so the always-on `strict` and `default` throttlers skip it.
 */
function throttleDecorators(policy: RateLimitPolicy): MethodDecorator[] {
	const throttle: MethodDecorator = Throttle({
		[policy.throttler]: { ttl: policy.ttlMs, limit: policy.limit, getTracker: throttleTrackerFunction(policy.tracker) },
	});
	const alwaysOn: readonly string[] = ALWAYS_ON_THROTTLERS;
	if (alwaysOn.includes(policy.throttler)) {
		return [throttle];
	}
	const skipAlwaysOn: Record<string, boolean> = Object.fromEntries(ALWAYS_ON_THROTTLERS.map((name): [string, boolean] => [name, true]));
	return [throttle, SkipThrottle(skipAlwaysOn)];
}

/** Declare the named policy for one route. Replaces a raw `@Throttle({...})` literal. */
export function RateLimit(policy: RateLimitPolicy): MethodDecorator {
	return applyDecorators(...throttleDecorators(policy), SetMetadata(RATE_LIMIT_POLICY_KEY, policy.name), SetMetadata(RATE_LIMIT_THROTTLER_KEY, policy.throttler));
}
