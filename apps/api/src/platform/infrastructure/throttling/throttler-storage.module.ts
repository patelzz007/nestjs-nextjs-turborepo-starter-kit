import { Module } from "@nestjs/common";

import { RedisThrottlerStorage } from "./redis-throttler.storage";

/**
 * Provides the one `RedisThrottlerStorage`. `ThrottlingModule` injects it into
 * the throttler options (`storage`), so `ThrottlerGuard` and every custom guard
 * that injects `ThrottlerStorage` share this instance. `REDIS_PUBLISHER` and
 * `TypedConfigService` come from their global modules.
 */
@Module({
	providers: [RedisThrottlerStorage],
	exports: [RedisThrottlerStorage],
})
export class ThrottlerStorageModule {}
