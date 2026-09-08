import { Injectable, Logger, OnModuleDestroy, Inject } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import { BoundedTtlCache, SecurityKeyStore } from "@workspace/shared";
import type Redis from "ioredis";

import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../../../infrastructure/redis/redis.tokens";

interface MemoryRecord {
	totalHits: number;
	expiresAt: number;
}

/**
 * Redis-backed throttler storage with in-memory fallback when Redis is unavailable.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
	private readonly logger: Logger = new Logger(RedisThrottlerStorage.name);
	private readonly memory: BoundedTtlCache<string, MemoryRecord>;
	private readonly keyStore: SecurityKeyStore<string>;

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(REDIS_PUBLISHER) private readonly redis: Redis | null,
	) {
		this.memory = new BoundedTtlCache<string, MemoryRecord>({
			maxEntries: config.securityCounterMaxKeys,
			capacityPolicy: "reject-new",
		});
		this.keyStore = new SecurityKeyStore<string>({ maxKeys: config.securityCounterMaxKeys });
	}

	public async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
		const storageKey = `throttle:${throttlerName}:${key}`;

		if (this.redis !== null) {
			try {
				const hits = await this.redis.incr(storageKey);
				if (hits === 1) {
					await this.redis.pexpire(storageKey, ttl);
				}
				const ttlRemaining = await this.redis.pttl(storageKey);
				const isBlocked = hits > limit;
				return {
					totalHits: hits,
					timeToExpire: ttlRemaining > 0 ? ttlRemaining : ttl,
					isBlocked,
					timeToBlockExpire: isBlocked ? blockDuration : 0,
				};
			} catch (error) {
				this.logger.warn(`Redis throttler fallback to memory for key ${storageKey}`, error);
			}
		}

		return this.incrementMemory(storageKey, ttl, limit, blockDuration);
	}

	public onModuleDestroy(): void {
		this.memory.clear();
		this.keyStore.clear();
	}

	private incrementMemory(key: string, ttl: number, limit: number, blockDuration: number): ThrottlerStorageRecord {
		const now = Date.now();
		const expiresAt = now + ttl;
		const existing = this.memory.get(key, now);

		if (existing === null) {
			if (!this.keyStore.reserveKey(key, expiresAt, now)) {
				this.logger.warn(`Throttler memory fallback at capacity — blocking key ${key}`);
				return { totalHits: limit + 1, timeToExpire: ttl, isBlocked: true, timeToBlockExpire: blockDuration };
			}
			const stored = this.memory.set(key, { totalHits: 1, expiresAt }, ttl, now);
			if (!stored) {
				this.keyStore.delete(key);
				return { totalHits: limit + 1, timeToExpire: ttl, isBlocked: true, timeToBlockExpire: blockDuration };
			}
			return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
		}

		const totalHits = existing.totalHits + 1;
		this.memory.set(key, { totalHits, expiresAt: existing.expiresAt }, Math.max(0, existing.expiresAt - now), now);
		this.keyStore.touchKey(key, existing.expiresAt);
		const isBlocked = totalHits > limit;
		return {
			totalHits,
			timeToExpire: Math.max(0, existing.expiresAt - now),
			isBlocked,
			timeToBlockExpire: isBlocked ? blockDuration : 0,
		};
	}
}
