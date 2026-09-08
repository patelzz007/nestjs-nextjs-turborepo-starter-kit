import { Injectable, Logger } from "@nestjs/common";
import { BoundedTtlCache, SessionPermissionsResponseSchema, UserResponseSchema, type SessionPermissionsResponse, type UserResponse } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";

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

	private readonly meStore: BoundedTtlCache<string, UserResponse>;
	private readonly permissionsStore: BoundedTtlCache<string, SessionPermissionsResponse>;

	public constructor(protected readonly config: TypedConfigService) {
		this.defaultTtlMs = config.userSessionCacheTtlMs;
		this.meStore = new BoundedTtlCache<string, UserResponse>({
			maxEntries: config.userSessionCacheMaxEntries,
			defaultTtlMs: this.defaultTtlMs,
			capacityPolicy: "evict-oldest",
		});
		this.permissionsStore = new BoundedTtlCache<string, SessionPermissionsResponse>({
			maxEntries: config.userSessionCacheMaxEntries,
			defaultTtlMs: this.defaultTtlMs,
			capacityPolicy: "evict-oldest",
		});
	}

	public getMe(userId: string): Promise<UserResponse | null> {
		return Promise.resolve(this.meStore.get(userId));
	}

	public setMe(userId: string, value: UserResponse, ttlMs?: number): Promise<void> {
		const parsed = UserResponseSchema.safeParse(value);
		if (!parsed.success) {
			this.logger.warn(`Skipped caching invalid /auth/me payload for user ${userId}`);
			return Promise.resolve();
		}
		const ttl = ttlMs ?? this.defaultTtlMs;
		this.meStore.set(userId, parsed.data, ttl);
		this.logger.debug(`Cached /auth/me for user ${userId} (TTL ${String(ttl)}ms)`);
		return Promise.resolve();
	}

	public getPermissions(userId: string): Promise<SessionPermissionsResponse | null> {
		return Promise.resolve(this.permissionsStore.get(userId));
	}

	public setPermissions(userId: string, value: SessionPermissionsResponse, ttlMs?: number): Promise<void> {
		const parsed = SessionPermissionsResponseSchema.safeParse(value);
		if (!parsed.success) {
			this.logger.warn(`Skipped caching invalid /auth/permissions payload for user ${userId}`);
			return Promise.resolve();
		}
		const ttl = ttlMs ?? this.defaultTtlMs;
		this.permissionsStore.set(userId, parsed.data, ttl);
		this.logger.debug(`Cached /auth/permissions for user ${userId} (TTL ${String(ttl)}ms)`);
		return Promise.resolve();
	}

	public invalidate(userId: string): Promise<void> {
		this.meStore.delete(userId);
		this.permissionsStore.delete(userId);
		this.logger.debug(`Invalidated user session cache for ${userId}`);
		return Promise.resolve();
	}

	public invalidateUsers(userIds: readonly string[]): Promise<void> {
		this.meStore.deleteMany(userIds);
		this.permissionsStore.deleteMany(userIds);
		if (userIds.length > 0) {
			this.logger.debug(`Invalidated user session cache for ${String(userIds.length)} user(s)`);
		}
		return Promise.resolve();
	}

	public clear(): Promise<void> {
		const size = this.meStore.size + this.permissionsStore.size;
		this.meStore.clear();
		this.permissionsStore.clear();
		this.logger.debug(`Cleared user session cache (${String(size)} entries)`);
		return Promise.resolve();
	}

	public get maxEntries(): number {
		return this.meStore.getDiagnostics().maxEntries;
	}
}
