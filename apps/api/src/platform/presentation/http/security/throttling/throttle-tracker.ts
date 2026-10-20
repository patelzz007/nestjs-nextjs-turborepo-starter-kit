import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { clientIpThrottleTracker, principalThrottleTracker } from "../../../../infrastructure/http/client-ip";
import type { RateLimitThrottlerName, RateLimitTracker } from "./rate-limit-policy";

/** Reflector key holding the throttler a route's `@RateLimit` policy runs on. */
export const RATE_LIMIT_THROTTLER_KEY = "rate_limit_throttler";

/** The throttler's tracker callback: the request in, the bucket key out. */
export type ThrottleTrackerFunction = (request: object) => string;

/** Maps a policy's tracker to the key it buckets requests by (migration plan §10.2). */
export function throttleTrackerFunction(tracker: RateLimitTracker): ThrottleTrackerFunction {
	switch (tracker) {
		case "ip":
			return clientIpThrottleTracker;
		case "principal":
			return principalThrottleTracker;
	}
}

const reflector: Reflector = new Reflector();

/** The throttler the route's `@RateLimit` policy declared, or `undefined` when it declared none. */
export function routeThrottler(context: ExecutionContext): RateLimitThrottlerName | undefined {
	return reflector.getAllAndOverride<RateLimitThrottlerName | undefined>(RATE_LIMIT_THROTTLER_KEY, [context.getHandler(), context.getClass()]);
}
