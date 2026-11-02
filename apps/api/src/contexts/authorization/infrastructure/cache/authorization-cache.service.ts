import { Inject, Injectable, Logger } from "@nestjs/common";
import { nowEpochMs, type BoundedTtlCache } from "@workspace/shared";
import { z } from "zod";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { APP_CACHE, defineCache, type AppCache, type CacheDefinition, type CacheEnvelope } from "../../../../platform/application/ports/app-cache.port";

/**
 * In-memory authorization cache backed by a bounded TTL store.
 *
 * Each entry stores the effective authorization state (roles + flattened
 * permissions) for a single user.  The cache is keyed by user ID and
 * entries expire after a configurable TTL (default 5 minutes).
 *
 * ## Multi-instance invalidation
 *
 * This store is per process. Never invalidate it directly after an RBAC
 * change: go through `AuthorizationInvalidationService`, which applies the
 * invalidation here and broadcasts it to every other API instance over Redis
 * pub/sub (when the Redis authorization backend is configured).
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
	readonly capabilities: readonly string[];
	readonly cachedAt: number;
}

// ── Service ─────────────────────────────────────────────────────────────────

/** Authorization state is never served stale: a role change must take effect on the next check. */
const NO_STALE_MS = 0;

const CachedAuthorizationSchema = z.object({
	roles: z.array(z.string()),
	permissions: z.array(z.object({ action: z.string(), resource: z.string() })),
	capabilities: z.array(z.string()),
	cachedAt: z.number(),
});

@Injectable()
export class AuthorizationCacheService {
	private readonly logger: Logger = new Logger(AuthorizationCacheService.name);

	/**
	 * Declared on the cache of ADR 072 (`local`: read synchronously on every authorization check), so
	 * the admin Cache page shows it and can flush it on every instance.
	 */
	public readonly definition: CacheDefinition<CachedAuthorization, "user">;
	private readonly defaultTtlMs: number;

	public constructor(config: TypedConfigService, @Inject(APP_CACHE) cache: AppCache) {
		this.defaultTtlMs = config.caches.authorizationTtlMs;
		this.definition = defineCache<CachedAuthorization, "user">({
			name: "authorization.state",
			version: 1,
			schema: CachedAuthorizationSchema,
			scope: "user",
			tier: "local",
			ttlMs: this.defaultTtlMs,
			staleMs: NO_STALE_MS,
			containsPersonalData: false,
			localMaxEntries: config.caches.authorizationMaxEntries,
			sharedMaxKeys: config.caches.authorizationMaxEntries,
		});
		cache.register(this.definition);
	}

	private get store(): BoundedTtlCache<string, CacheEnvelope<CachedAuthorization>> {
		return this.definition.local;
	}

	/**
	 * Retrieve the cached authorization state for a user.
	 *
	 * @returns The cached state, or `null` on miss / expiry.
	 */
	public get(userId: string): CachedAuthorization | null {
		const envelope = this.store.get(userId, nowEpochMs());
		if (envelope === null) {
			this.definition.counters.misses += 1;
			return null;
		}
		this.definition.counters.hits += 1;
		return envelope.value;
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
		const now = nowEpochMs();
		const stored = this.store.set(userId, { value: auth, storedAt: now, freshUntil: now + ttl, staleUntil: now + ttl }, ttl, now);
		if (stored) {
			this.logger.debug(`Cached authorization for user ${userId} (TTL ${String(ttl)}ms)`);
		}
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
	 *
	 * Not logged here: `AuthorizationInvalidationService` (the only caller)
	 * logs which users, the trigger and the originating instance.
	 */
	public invalidateUsers(affectedUserIds: readonly string[]): void {
		this.store.deleteMany(affectedUserIds);
	}

	/** Drop every cached entry (logged, with its origin, by `AuthorizationInvalidationService`). */
	public clear(): void {
		this.store.clear();
	}

	/** Current number of entries (including possibly-expired ones). */
	public get size(): number {
		return this.store.size;
	}

	public get maxEntries(): number {
		return this.store.getDiagnostics().maxEntries;
	}

	/** Approximate memory footprint for diagnostics. */
	public getMemoryEstimate(): { entries: number; estimatedBytes: number } {
		const entries: number = this.store.size;
		// Rough estimate: each entry ≈ 200 bytes (roles + permissions arrays)
		const estimatedBytes: number = entries * 200;
		return { entries, estimatedBytes };
	}
}
