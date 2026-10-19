import type { ExecutionContext } from "@nestjs/common";
import type { ThrottlerModuleOptions } from "@nestjs/throttler";

import type { TypedConfigService } from "../../../../../config/typed-config.service";
import type { RedisThrottlerStorage } from "../../../../infrastructure/throttling/redis-throttler.storage";
import { PRE_AUTH_LIMIT_MULTIPLIER, PRE_AUTH_THROTTLER, WEBHOOK_WINDOW_MS } from "./rate-limit-policy";
import { routeThrottler, throttleTrackerFunction } from "./throttle-tracker";

/** The 429 message on every route except a webhook. */
export const THROTTLED_MESSAGE = "Too many requests — please try again shortly.";

/** The 429 message on a webhook route. */
export const WEBHOOK_THROTTLED_MESSAGE = "Too many webhook requests — this endpoint is rate-limited per IP (WEBHOOK_RATE_LIMIT_PER_MINUTE). Try again shortly.";

/**
 * The ONE throttler registration (migration plan §10.1). Its named throttlers:
 *
 * - `strict`: credential endpoints, keyed by client IP (credential stuffing is
 *   limited per source, never per target account).
 * - `default`: authenticated mutations, keyed by the principal (user, then API key, then IP).
 * - `preAuth`: every request, one bucket per client IP across all routes, `PRE_AUTH_LIMIT_MULTIPLIER` × the default
 *   limit. Evaluated only by `PreAuthThrottlerGuard`, which runs BEFORE `AuthGuard`.
 * - `webhook`: opt-in. Only routes declaring `@RateLimit(RATE_LIMIT_POLICY.webhook)`
 *   count, per client IP per minute. `WEBHOOK_RATE_LIMIT_PER_MINUTE=0` turns it off.
 *
 * A route's `@RateLimit` policy overrides its throttler's limit, window and tracker.
 * `storage` is the Redis-backed storage, so every API instance shares one count.
 */
export function throttlerOptionsFactory(config: TypedConfigService, storage: RedisThrottlerStorage): ThrottlerModuleOptions {
	const webhookLimit: number = config.email.webhookRateLimitPerMinute;
	const webhookDisabled: boolean = webhookLimit === 0;
	return {
		storage,
		errorMessage: (context: ExecutionContext): string => (routeThrottler(context) === "webhook" ? WEBHOOK_THROTTLED_MESSAGE : THROTTLED_MESSAGE),
		throttlers: [
			{
				name: PRE_AUTH_THROTTLER,
				ttl: config.rateLimits.throttleTtlMs,
				limit: config.rateLimits.throttleDefaultLimit * PRE_AUTH_LIMIT_MULTIPLIER,
				getTracker: throttleTrackerFunction("ip"),
				// One bucket per client IP across every route (the default key is per route).
				generateKey: (_context: ExecutionContext, tracker: string): string => tracker,
			},
			{ name: "strict", ttl: config.rateLimits.throttleTtlMs, limit: config.rateLimits.throttleStrictLimit, getTracker: throttleTrackerFunction("ip") },
			{ name: "default", ttl: config.rateLimits.throttleTtlMs, limit: config.rateLimits.throttleDefaultLimit, getTracker: throttleTrackerFunction("principal") },
			{
				name: "webhook",
				ttl: WEBHOOK_WINDOW_MS,
				limit: webhookLimit,
				getTracker: throttleTrackerFunction("ip"),
				skipIf: (context: ExecutionContext): boolean => webhookDisabled || routeThrottler(context) !== "webhook",
			},
		],
	};
}
