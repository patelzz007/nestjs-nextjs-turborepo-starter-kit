import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import type Redis from "ioredis";

import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../../../infrastructure/redis/redis.tokens";
import { Inject } from "@nestjs/common";

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
	private readonly memory = new Map<string, MemoryRecord>();

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(REDIS_PUBLISHER) private readonly redis: Redis | null,
	) {}

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
	}

	private incrementMemory(key: string, ttl: number, limit: number, blockDuration: number): ThrottlerStorageRecord {
		const now = Date.now();
		const existing = this.memory.get(key);
		if (existing === undefined || now > existing.expiresAt) {
			this.memory.set(key, { totalHits: 1, expiresAt: now + ttl });
			return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
		}

		const totalHits = existing.totalHits + 1;
		const expiresAt = existing.expiresAt;
		this.memory.set(key, { totalHits, expiresAt });
		const isBlocked = totalHits > limit;
		return {
			totalHits,
			timeToExpire: Math.max(0, expiresAt - now),
			isBlocked,
			timeToBlockExpire: isBlocked ? blockDuration : 0,
		};
	}
}
