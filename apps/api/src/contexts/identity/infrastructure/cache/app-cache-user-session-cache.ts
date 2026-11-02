import { Inject, Injectable } from "@nestjs/common";
import { SessionPermissionsResponseSchema, UserResponseSchema, type SessionPermissionsResponse, type UserResponse } from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { APP_CACHE, defineCache, userScope, type AppCache, type CacheDefinition } from "../../../../platform/application/ports/app-cache.port";
import type { UserSessionCachePort } from "../../application/ports/user-session-cache.port";

/** The one id each user's entry is stored under (a user has one `/auth/me` and one permission set). */
const SESSION_ENTRY_ID = "current";

/** Values are never served stale: a session payload is replaced or dropped on every change. */
const NO_STALE_MS = 0;

/**
 * `/auth/me` and `/auth/permissions`, shared by web, admin and merchant (all three sign in to one
 * API), on the cache of ADR 072. `/auth/me` holds personal data, so it is encrypted inside Redis;
 * without a cache key ring it stays in each process. Both are dropped on every instance after a
 * profile or authorization change commits.
 */
@Injectable()
export class AppCacheUserSessionCache implements UserSessionCachePort {
	public readonly me: CacheDefinition<UserResponse, "user">;
	public readonly permissions: CacheDefinition<SessionPermissionsResponse, "user">;

	public constructor(
		config: TypedConfigService,
		@Inject(APP_CACHE) private readonly cache: AppCache,
	) {
		this.me = defineCache({
			name: "identity.me",
			version: 1,
			schema: UserResponseSchema,
			scope: "user",
			tier: "shared",
			ttlMs: config.caches.userSessionTtlMs,
			staleMs: NO_STALE_MS,
			containsPersonalData: true,
			localMaxEntries: config.caches.userSessionMaxEntries,
			sharedMaxKeys: config.caches.userSessionMaxEntries,
		});
		this.permissions = defineCache({
			name: "identity.session-permissions",
			version: 1,
			schema: SessionPermissionsResponseSchema,
			scope: "user",
			tier: "shared",
			ttlMs: config.caches.userSessionTtlMs,
			staleMs: NO_STALE_MS,
			containsPersonalData: false,
			localMaxEntries: config.caches.userSessionMaxEntries,
			sharedMaxKeys: config.caches.userSessionMaxEntries,
		});
		this.cache.register(this.me, this.permissions);
	}

	public getMe(userId: string): Promise<UserResponse | null> {
		return this.cache.peek(this.me, userScope(userId), SESSION_ENTRY_ID);
	}

	public setMe(userId: string, value: UserResponse): Promise<void> {
		return this.cache.set(this.me, userScope(userId), SESSION_ENTRY_ID, value);
	}

	public getPermissions(userId: string): Promise<SessionPermissionsResponse | null> {
		return this.cache.peek(this.permissions, userScope(userId), SESSION_ENTRY_ID);
	}

	public setPermissions(userId: string, value: SessionPermissionsResponse): Promise<void> {
		return this.cache.set(this.permissions, userScope(userId), SESSION_ENTRY_ID, value);
	}

	public async invalidate(userId: string): Promise<void> {
		await this.cache.invalidate(this.me, userScope(userId), SESSION_ENTRY_ID);
		await this.cache.invalidate(this.permissions, userScope(userId), SESSION_ENTRY_ID);
	}

	public async invalidateUsers(userIds: readonly string[]): Promise<void> {
		for (const userId of new Set<string>(userIds)) {
			await this.invalidate(userId);
		}
	}
}
