// ============================================
// platform/infrastructure/cache/cache-keys.ts — the only place cache keys are built (ADR 072)
// ============================================
// `<REDIS_NAMESPACE>:cache:<name>:v<version>[:k<key version>]:<scope>:<id>`. The scope segment comes
// from the typed scope argument, so a tenant-scoped key always carries its tenant; the key version of
// an encrypted cache is part of the key, so after a key rotation old entries are simply never read.

import type { CacheScope, CacheScopeKey } from "../../application/ports/app-cache.port";
import type { RedisNamespace } from "../redis/redis-namespace";

export interface CacheKeyParts {
	readonly name: string;
	readonly version: number;
	/** The encryption key version, or `null` for a cache stored in clear. */
	readonly keyVersion: number | null;
}

/** The tag every tenant-scoped value is filed under, so one tenant can be flushed in every cache. */
export function tenantTag(tenantId: string): string {
	return `tenant:${tenantId}`;
}

function scopeSegment<S extends CacheScope>(scope: CacheScopeKey<S>): string {
	switch (scope.scope) {
		case "tenant":
			return `t:${scope.tenantId}`;
		case "user":
			return `u:${scope.userId}`;
		case "platform":
			return "p";
	}
}

/** The prefix every key of one cache version shares. */
export function cachePrefix(namespace: RedisNamespace, parts: CacheKeyParts): string {
	const keySegment = parts.keyVersion === null ? "" : `:k${String(parts.keyVersion)}`;
	return namespace.key(`cache:${parts.name}:v${String(parts.version)}${keySegment}`);
}

export function cacheValueKey<S extends CacheScope>(namespace: RedisNamespace, parts: CacheKeyParts, scope: CacheScopeKey<S>, id: string): string {
	return `${cachePrefix(namespace, parts)}:${scopeSegment(scope)}:${id}`;
}

/** The sorted set of one cache version's live keys (score: expiry), for its key budget, stats and flush. */
export function cacheIndexKey(namespace: RedisNamespace, parts: CacheKeyParts): string {
	return `${cachePrefix(namespace, parts)}:#index`;
}

export function cacheTagKey(namespace: RedisNamespace, parts: CacheKeyParts, tag: string): string {
	return `${cachePrefix(namespace, parts)}:#tag:${tag}`;
}

export function cacheLeaseKey(valueKey: string): string {
	return `${valueKey}:#lease`;
}

/** The pub/sub channel every instance hears invalidations on. */
export function cacheInvalidationChannel(namespace: RedisNamespace): string {
	return namespace.channel("cache:invalidate");
}
