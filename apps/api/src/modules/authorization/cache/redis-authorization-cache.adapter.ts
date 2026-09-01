import type { CachedAuthorization } from "./authorization-cache.service";

/**
 * Interface for the authorization cache backend.
 *
 * Implementations:
 * - `AuthorizationCacheService` — in-memory Map (single instance)
 * - `RedisAuthorizationCacheAdapter` — Redis-backed (multi-instance)
 *
 * Swap at the module level by providing a different implementation.
 */
export interface AuthorizationCacheAdapter {
	get(userId: string): CachedAuthorization | null;
	set(userId: string, auth: CachedAuthorization, ttlMs?: number): void;
	invalidate(userId: string): void;
	invalidateUsers(userIds: readonly string[]): void;
	clear(): void;
	readonly size: number;
}
