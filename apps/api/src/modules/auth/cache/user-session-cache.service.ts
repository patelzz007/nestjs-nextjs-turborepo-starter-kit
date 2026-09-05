import { Injectable, Logger } from "@nestjs/common";
import { SessionPermissionsResponseSchema, UserResponseSchema, type SessionPermissionsResponse, type UserResponse } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";

interface MeCacheEntry {
	readonly value: UserResponse;
	readonly expiresAt: number;
}

interface PermissionsCacheEntry {
	readonly value: SessionPermissionsResponse;
	readonly expiresAt: number;
}

/**
 * In-memory `/auth/me` + `/auth/permissions` cache.
 *
 * When `REDIS_URL` is set (non-dev by default), {@link RedisUserSessionCacheService}
 * stores the same payloads in Redis instead.
 */
@Injectable()
export class UserSessionCacheService {
	protected readonly logger: Logger = new Logger(UserSessionCacheService.name);
	protected readonly defaultTtlMs: number;

	private readonly meStore = new Map<string, MeCacheEntry>();
	private readonly permissionsStore = new Map<string, PermissionsCacheEntry>();

	public constructor(protected readonly config: TypedConfigService) {
		this.defaultTtlMs = config.userSessionCacheTtlMs;
	}

	public async getMe(userId: string): Promise<UserResponse | null> {
		const entry = this.meStore.get(userId);
		if (entry === undefined) {
			return null;
		}
		if (Date.now() > entry.expiresAt) {
			this.meStore.delete(userId);
			return null;
		}
		return entry.value;
	}

	public async setMe(userId: string, value: UserResponse, ttlMs?: number): Promise<void> {
		const parsed = UserResponseSchema.safeParse(value);
		if (!parsed.success) {
			this.logger.warn(`Skipped caching invalid /auth/me payload for user ${userId}`);
			return;
		}
		const ttl = ttlMs ?? this.defaultTtlMs;
		this.meStore.set(userId, { value: parsed.data, expiresAt: Date.now() + ttl });
		this.logger.debug(`Cached /auth/me for user ${userId} (TTL ${String(ttl)}ms)`);
	}

	public async getPermissions(userId: string): Promise<SessionPermissionsResponse | null> {
		const entry = this.permissionsStore.get(userId);
		if (entry === undefined) {
			return null;
		}
		if (Date.now() > entry.expiresAt) {
			this.permissionsStore.delete(userId);
			return null;
		}
		return entry.value;
	}

	public async setPermissions(userId: string, value: SessionPermissionsResponse, ttlMs?: number): Promise<void> {
		const parsed = SessionPermissionsResponseSchema.safeParse(value);
		if (!parsed.success) {
			this.logger.warn(`Skipped caching invalid /auth/permissions payload for user ${userId}`);
			return;
		}
		const ttl = ttlMs ?? this.defaultTtlMs;
		this.permissionsStore.set(userId, { value: parsed.data, expiresAt: Date.now() + ttl });
		this.logger.debug(`Cached /auth/permissions for user ${userId} (TTL ${String(ttl)}ms)`);
	}

	public async invalidate(userId: string): Promise<void> {
		this.meStore.delete(userId);
		this.permissionsStore.delete(userId);
		this.logger.debug(`Invalidated user session cache for ${userId}`);
	}

	public async invalidateUsers(userIds: readonly string[]): Promise<void> {
		for (const userId of userIds) {
			this.meStore.delete(userId);
			this.permissionsStore.delete(userId);
		}
		if (userIds.length > 0) {
			this.logger.debug(`Invalidated user session cache for ${String(userIds.length)} user(s)`);
		}
	}

	public async clear(): Promise<void> {
		const size = this.meStore.size + this.permissionsStore.size;
		this.meStore.clear();
		this.permissionsStore.clear();
		this.logger.debug(`Cleared user session cache (${String(size)} entries)`);
	}
}
