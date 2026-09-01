import { Injectable, Logger } from "@nestjs/common";
import { nowEpochMs, epochMs } from "@workspace/shared";

/**
 * In-memory authorization cache backed by a `Map`.
 *
 * Each entry stores the effective authorization state (roles + flattened
 * permissions) for a single user.  The cache is keyed by user ID and
 * entries expire after a configurable TTL (default 5 minutes).
 *
 * ## Redis migration path
 *
 * Replace the internal `Map` with a Redis client that exposes the same
 * `get / set / invalidate / invalidateRole` contract.  The NestJS module
 * wiring stays identical — swap the provider at the module level.
 */

// ── Public types ────────────────────────────────────────────────────────────

/** A single flattened permission entry used for fast in-memory checks. */
export interface CachedPermission {
	readonly action: string;
	readonly resource: string;
}

/** The full authorization state cached per user. */
export interface CachedAuthorization {
	readonly roles: readonly string[];
	readonly permissions: readonly CachedPermission[];
	readonly cachedAt: number;
}

interface CacheEntry {
	readonly value: CachedAuthorization;
	readonly expiresAt: number;
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AuthorizationCacheService {
	private readonly logger: Logger = new Logger(AuthorizationCacheService.name);

	private readonly store: Map<string, CacheEntry> = new Map<string, CacheEntry>();

	/** Default TTL: 5 minutes in milliseconds. */
	private readonly defaultTtlMs: number = 5 * 60 * 1000;

	/** Cached role hierarchy graph: roleId → parentRoleId. */
	private readonly roleHierarchy: Map<string, string | null> = new Map<string, string | null>();
	private hierarchyLoadedAt = 0;
	private readonly hierarchyTtlMs: number = 15 * 60 * 1000;

	/**
	 * Retrieve the cached authorization state for a user.
	 *
	 * @returns The cached state, or `null` on miss / expiry.
	 */
	public get(userId: string): CachedAuthorization | null {
		const entry: CacheEntry | undefined = this.store.get(userId);
		if (entry === undefined) {
			return null;
		}
		if (nowEpochMs() > entry.expiresAt) {
			this.store.delete(userId);
			return null;
		}
		return entry.value;
	}

	/**
	 * Store the authorization state for a user.
	 *
	 * @param userId - The user ID to cache against.
	 * @param auth   - The resolved authorization state.
	 * @param ttlMs  - Optional custom TTL in milliseconds.
	 */
	public set(userId: string, auth: CachedAuthorization, ttlMs?: number): void {
		const ttl: number = ttlMs ?? this.defaultTtlMs;
		const entry: CacheEntry = {
			value: auth,
			expiresAt: epochMs(Date.now() + ttl),
		};
		this.store.set(userId, entry);
		this.logger.debug(`Cached authorization for user ${userId} (TTL ${String(ttl)}ms)`);
	}

	/**
	 * Invalidate the cached authorization for a single user.
	 *
	 * Call this after:
	 * - Role assignment / removal
	 * - Direct permission grant / revoke
	 * - User deletion
	 */
	public invalidate(userId: string): void {
		this.store.delete(userId);
		this.logger.debug(`Invalidated authorization cache for user ${userId}`);
	}

	/**
	 * Invalidate cached authorization for every user that holds a specific
	 * role.  This is the expensive operation — it scans the full cache.
	 *
	 * Call this after role-permission changes so all affected users re-resolve
	 * on their next request.
	 *
	 * @param affectedUserIds - The user IDs whose authorization changed.
	 */
	public invalidateUsers(affectedUserIds: readonly string[]): void {
		for (const userId of affectedUserIds) {
			this.store.delete(userId);
		}
		this.logger.debug(`Invalidated authorization cache for ${String(affectedUserIds.length)} user(s)`);
	}

	/** Drop every cached entry.  Useful for testing and full invalidation. */
	public clear(): void {
		const size: number = this.store.size;
		this.store.clear();
		this.logger.debug(`Cleared authorization cache (${String(size)} entries)`);
	}

	/** Current number of entries (including possibly-expired ones). */
	public get size(): number {
		return this.store.size;
	}

	// ── Role hierarchy cache ────────────────────────────────────────────

	/**
	 * Get the cached role hierarchy. Returns `null` if expired or not loaded.
	 */
	public getHierarchy(): Map<string, string | null> | null {
		if (nowEpochMs() > this.hierarchyLoadedAt + this.hierarchyTtlMs) {
			return null;
		}
		return this.roleHierarchy;
	}

	/**
	 * Store the role hierarchy graph.
	 */
	public setHierarchy(hierarchy: Map<string, string | null>): void {
		this.roleHierarchy.clear();
		for (const [key, value] of hierarchy) {
			this.roleHierarchy.set(key, value);
		}
		this.hierarchyLoadedAt = nowEpochMs();
	}

	/** Invalidate the cached role hierarchy (call after role parent changes). */
	public invalidateHierarchy(): void {
		this.roleHierarchy.clear();
		this.hierarchyLoadedAt = 0;
	}

	/** Approximate memory footprint for diagnostics. */
	public getMemoryEstimate(): { entries: number; estimatedBytes: number } {
		const entries: number = this.store.size;
		// Rough estimate: each entry ≈ 200 bytes (roles + permissions arrays)
		const estimatedBytes: number = entries * 200;
		return { entries, estimatedBytes };
	}
}
