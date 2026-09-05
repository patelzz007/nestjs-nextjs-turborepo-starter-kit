import { Inject, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { SessionPermissionsResponseSchema, UserResponseSchema, type SessionPermissionsResponse, type UserResponse } from "@workspace/shared";
import type Redis from "ioredis";

import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../../../infrastructure/redis/redis.tokens";

import { UserSessionCacheService } from "./user-session-cache.service";

const ME_KEY_PREFIX = "auth:me:";
const PERMISSIONS_KEY_PREFIX = "auth:permissions:";

/**
 * Redis-backed user session cache — shared across web, admin, and merchant logins.
 *
 * All three apps hit the same API login endpoint; payloads are keyed by `userId`.
 */
export class RedisUserSessionCacheService extends UserSessionCacheService implements OnModuleInit, OnModuleDestroy {
	private readonly redisLogger: Logger = new Logger(RedisUserSessionCacheService.name);

	public constructor(
		config: TypedConfigService,
		@Inject(REDIS_PUBLISHER) private readonly redis: Redis,
	) {
		super(config);
	}

	public async onModuleInit(): Promise<void> {
		try {
			if (this.redis.status !== "ready") {
				await this.redis.connect();
			}
			this.redisLogger.log("Redis user session cache connected");
		} catch (error) {
			const message = error instanceof Error ? error.message : "unknown error";
			this.redisLogger.error(`Redis user session cache init failed: ${message}`);
		}
	}

	public async onModuleDestroy(): Promise<void> {
		if (this.redis.status !== "end") {
			await this.redis.quit();
		}
	}

	public override async getMe(userId: string): Promise<UserResponse | null> {
		const raw = await this.redis.get(this.meKey(userId));
		if (raw === null) {
			return null;
		}
		try {
			const parsed = UserResponseSchema.safeParse(JSON.parse(raw));
			return parsed.success ? parsed.data : null;
		} catch {
			return null;
		}
	}

	public override async setMe(userId: string, value: UserResponse, ttlMs?: number): Promise<void> {
		const parsed = UserResponseSchema.safeParse(value);
		if (!parsed.success) {
			this.logger.warn(`Skipped Redis /auth/me cache for user ${userId}`);
			return;
		}
		const ttlSeconds = Math.max(1, Math.ceil((ttlMs ?? this.defaultTtlMs) / 1000));
		await this.redis.setex(this.meKey(userId), ttlSeconds, this.serializeForRedis(parsed.data));
		this.logger.debug(`Stored /auth/me in Redis for user ${userId} (TTL ${String(ttlSeconds)}s)`);
	}

	public override async getPermissions(userId: string): Promise<SessionPermissionsResponse | null> {
		const raw = await this.redis.get(this.permissionsKey(userId));
		if (raw === null) {
			return null;
		}
		try {
			const parsed = SessionPermissionsResponseSchema.safeParse(JSON.parse(raw));
			return parsed.success ? parsed.data : null;
		} catch {
			return null;
		}
	}

	public override async setPermissions(userId: string, value: SessionPermissionsResponse, ttlMs?: number): Promise<void> {
		const parsed = SessionPermissionsResponseSchema.safeParse(value);
		if (!parsed.success) {
			this.logger.warn(`Skipped Redis /auth/permissions cache for user ${userId}`);
			return;
		}
		const ttlSeconds = Math.max(1, Math.ceil((ttlMs ?? this.defaultTtlMs) / 1000));
		await this.redis.setex(this.permissionsKey(userId), ttlSeconds, this.serializeForRedis(parsed.data));
		this.logger.debug(`Stored /auth/permissions in Redis for user ${userId} (TTL ${String(ttlSeconds)}s)`);
	}

	public override async invalidate(userId: string): Promise<void> {
		await this.redis.del(this.meKey(userId), this.permissionsKey(userId));
		this.logger.debug(`Deleted Redis user session cache for ${userId}`);
	}

	public override async invalidateUsers(userIds: readonly string[]): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		const keys: string[] = [];
		for (const userId of userIds) {
			keys.push(this.meKey(userId), this.permissionsKey(userId));
		}
		await this.redis.del(...keys);
		this.logger.debug(`Deleted Redis user session cache for ${String(userIds.length)} user(s)`);
	}

	public override async clear(): Promise<void> {
		const stream = this.redis.scanStream({ match: `${ME_KEY_PREFIX}*`, count: 100 });
		const meKeys: string[] = [];
		for await (const batch of stream) {
			for (const key of batch) {
				if (typeof key === "string") {
					meKeys.push(key);
				}
			}
		}
		const permStream = this.redis.scanStream({ match: `${PERMISSIONS_KEY_PREFIX}*`, count: 100 });
		const permissionKeys: string[] = [];
		for await (const batch of permStream) {
			for (const key of batch) {
				if (typeof key === "string") {
					permissionKeys.push(key);
				}
			}
		}
		const allKeys = [...meKeys, ...permissionKeys];
		if (allKeys.length > 0) {
			await this.redis.del(...allKeys);
		}
		this.logger.debug(`Cleared Redis user session cache (${String(allKeys.length)} keys)`);
	}

	private meKey(userId: string): string {
		return `${ME_KEY_PREFIX}${userId}`;
	}

	private permissionsKey(userId: string): string {
		return `${PERMISSIONS_KEY_PREFIX}${userId}`;
	}

	/** Pretty-printed JSON for human-readable inspection in Redis Insight / redis-cli. */
	private serializeForRedis(value: UserResponse | SessionPermissionsResponse): string {
		return JSON.stringify(value, null, 2);
	}
}
