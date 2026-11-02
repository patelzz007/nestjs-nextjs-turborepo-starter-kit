// ============================================
// platform/infrastructure/cache/cache-health.indicator.ts — is the shared cache healthy? (ADR 072)
// ============================================
// Non-critical: the cache only ever speeds things up (a miss loads from the database), so a full or
// unreachable Redis degrades the instance, never takes it out of rotation. It reports degraded when Redis
// is past `CACHE_MEMORY_ALERT_PERCENT` of its maxmemory, runs any policy but `noeviction` (queues share
// the instance), or the cache's circuit is open.

import { Inject, Injectable } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { APP_CACHE, cacheMemoryOverAlert, REQUIRED_REDIS_MEMORY_POLICY, type AppCache } from "../../application/ports/app-cache.port";
import type { ModuleHealthIndicator, ModuleHealthReport } from "../../presentation/http/health/health.service";

@Injectable()
export class CacheHealthIndicator implements ModuleHealthIndicator {
	public constructor(
		@Inject(APP_CACHE) private readonly cache: AppCache,
		private readonly config: TypedConfigService,
	) {}

	public async isHealthy(): Promise<boolean> {
		if (this.cache.isCircuitOpen()) {
			return false;
		}
		const memory = await this.cache.memory();
		return memory === null || (memory.policy === REQUIRED_REDIS_MEMORY_POLICY && !cacheMemoryOverAlert(memory, this.config.caches.memoryAlertPercent));
	}

	public async getReport(): Promise<ModuleHealthReport> {
		const memory = await this.cache.memory();
		return {
			circuitOpen: this.cache.isCircuitOpen(),
			redisUsedBytes: memory?.usedBytes ?? null,
			redisMaxBytes: memory?.maxBytes ?? null,
			redisPolicy: memory?.policy ?? null,
			alertPercent: this.config.caches.memoryAlertPercent,
		};
	}
}
