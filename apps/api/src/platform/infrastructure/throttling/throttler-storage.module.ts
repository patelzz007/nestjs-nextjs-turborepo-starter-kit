import { Module } from "@nestjs/common";

import { RateLimiterThrottlerStorage } from "./rate-limiter-throttler.storage";

/**
 * Provides the one `RateLimiterThrottlerStorage`. `ThrottlingModule` injects it into the throttler
 * options (`storage`), so `ThrottlerGuard` and every custom guard share this instance. The
 * `RATE_LIMITER` it counts with comes from the global `RateLimitingModule`.
 */
@Module({
	providers: [RateLimiterThrottlerStorage],
	exports: [RateLimiterThrottlerStorage],
})
export class ThrottlerStorageModule {}
