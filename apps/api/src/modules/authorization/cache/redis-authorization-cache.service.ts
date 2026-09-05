import { Inject, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type Redis from "ioredis";

import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "../../../infrastructure/redis/redis.tokens";

import type { CachedAuthorization } from "./authorization-cache.service";
import { AuthorizationCacheService } from "./authorization-cache.service";

const INVALIDATE_CHANNEL = "rbac:invalidate";

type InvalidateMessage = { readonly type: "user"; readonly userId: string } | { readonly type: "users"; readonly userIds: readonly string[] } | { readonly type: "clear" };

/**
 * Delegates reads/writes to in-memory cache and publishes invalidations over Redis
 * so every API instance drops stale entries.
 */
export class RedisAuthorizationCacheService extends AuthorizationCacheService implements OnModuleInit, OnModuleDestroy {
	private readonly redisLogger: Logger = new Logger(RedisAuthorizationCacheService.name);

	public constructor(
		private readonly delegate: AuthorizationCacheService,
		@Inject(REDIS_PUBLISHER) private readonly publisher: Redis,
		@Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
	) {
		super();
	}

	public async onModuleInit(): Promise<void> {
		try {
			if (this.publisher.status !== "ready") {
				await this.publisher.connect();
			}
			if (this.subscriber.status !== "ready") {
				await this.subscriber.connect();
			}
			await this.subscriber.subscribe(INVALIDATE_CHANNEL);
			this.subscriber.on("message", (_channel: string, payload: string): void => {
				this.applyRemoteInvalidate(payload);
			});
			this.redisLogger.log("Redis authorization cache pub/sub connected");
		} catch (error) {
			const message = error instanceof Error ? error.message : "unknown error";
			this.redisLogger.error(`Redis authorization cache init failed: ${message}`);
		}
	}

	public async onModuleDestroy(): Promise<void> {
		if (this.subscriber.status !== "end") {
			await this.subscriber.quit();
		}
		if (this.publisher.status !== "end") {
			await this.publisher.quit();
		}
	}

	public override get(userId: string): CachedAuthorization | null {
		return this.delegate.get(userId);
	}

	public override set(userId: string, auth: CachedAuthorization, ttlMs?: number): void {
		this.delegate.set(userId, auth, ttlMs);
	}

	public override invalidate(userId: string): void {
		this.delegate.invalidate(userId);
		this.publish({ type: "user", userId });
	}

	public override invalidateUsers(userIds: readonly string[]): void {
		this.delegate.invalidateUsers(userIds);
		if (userIds.length > 0) {
			this.publish({ type: "users", userIds });
		}
	}

	public override clear(): void {
		this.delegate.clear();
		this.publish({ type: "clear" });
	}

	public override get size(): number {
		return this.delegate.size;
	}

	public override getHierarchy(): Map<string, string | null> | null {
		return this.delegate.getHierarchy();
	}

	public override setHierarchy(hierarchy: Map<string, string | null>): void {
		this.delegate.setHierarchy(hierarchy);
	}

	public override invalidateHierarchy(): void {
		this.delegate.invalidateHierarchy();
	}

	public override getMemoryEstimate(): { entries: number; estimatedBytes: number } {
		return this.delegate.getMemoryEstimate();
	}

	private publish(message: InvalidateMessage): void {
		void this.publisher.publish(INVALIDATE_CHANNEL, JSON.stringify(message)).catch((error: Error): void => {
			this.redisLogger.warn(`Redis publish failed: ${error.message}`);
		});
	}

	private applyRemoteInvalidate(payload: string): void {
		try {
			const parsed = JSON.parse(payload) as InvalidateMessage;
			if (parsed.type === "user") {
				this.delegate.invalidate(parsed.userId);
				return;
			}
			if (parsed.type === "users") {
				this.delegate.invalidateUsers(parsed.userIds);
				return;
			}
			if (parsed.type === "clear") {
				this.delegate.clear();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "unknown error";
			this.redisLogger.warn(`Invalid Redis invalidate payload: ${message}`);
		}
	}
}
