import { Module } from "@nestjs/common";

import { LoadTestTrafficKeys } from "./load-test-traffic-keys";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

/**
 * Provides the one `RedisThrottlerStorage`. `ThrottlingModule` injects it into
 * the throttler options (`storage`), so `ThrottlerGuard` and every custom guard
 * that injects `ThrottlerStorage` share this instance. `REDIS_PUBLISHER` and
 * `TypedConfigService` come from their global modules. Also provides the load-test traffic keys the
 * guards let through (ADR 068).
 */
@Module({
	providers: [RedisThrottlerStorage, LoadTestTrafficKeys],
	exports: [RedisThrottlerStorage, LoadTestTrafficKeys],
})
export class ThrottlerStorageModule {}
