import { Global, Logger, Module } from "@nestjs/common";
import type Redis from "ioredis";

import { TypedConfigService } from "../../../config/typed-config.service";
import { APP_CACHE, type AppCache } from "../../application/ports/app-cache.port";
import { REDIS_PUBLISHER } from "../redis/redis.tokens";
import { GcmCacheCipher } from "./cache-cipher";
import { CacheInvalidationBus } from "./cache-invalidation-bus";
import { ioredisCacheClient } from "./redis-cache-client";
import { TieredAppCache } from "./tiered-app-cache";
import { CacheHealthIndicator } from "./cache-health.indicator";

/** The one cache (ADR 072): Redis when configured, encryption when a key ring is set, every instance listening. */
export function createAppCache(config: TypedConfigService, redis: Redis | null, bus: CacheInvalidationBus): AppCache {
	const keys = config.caches.encryptionKeys;
	const cache = new TieredAppCache({
		namespace: config.redisNamespace,
		client: redis === null ? null : ioredisCacheClient(redis),
		cipher: keys === null ? null : new GcmCacheCipher(keys),
		logger: new Logger("AppCache"),
	});
	if (redis !== null && keys === null) {
		new Logger("AppCache").warn("CACHE_ENCRYPTION_KEYS is not set: caches holding personal data stay in each API process and never reach Redis");
	}
	cache.listen(bus);
	return cache;
}

@Global()
@Module({
	providers: [
		CacheInvalidationBus,
		{ provide: APP_CACHE, inject: [TypedConfigService, REDIS_PUBLISHER, CacheInvalidationBus], useFactory: createAppCache },
		CacheHealthIndicator,
	],
	exports: [APP_CACHE, CacheHealthIndicator],
})
export class AppCacheModule {}
