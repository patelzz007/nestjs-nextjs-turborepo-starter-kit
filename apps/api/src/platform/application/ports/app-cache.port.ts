/*
 * The one cache every API cache is declared on (ADR 072). A cache is declared once with `defineCache`
 * next to the context that owns it, and used through `AppCache`. Keys are built only by the cache:
 * a tenant-scoped cache cannot be read or written without a tenant id, so a key without one cannot
 * exist. Values read from Redis are parsed with the declared schema; values holding personal data are
 * encrypted inside Redis.
 */

import { BoundedTtlCache } from "@workspace/shared";
import type { z } from "zod";

/** Who a cached value belongs to. */
export type CacheScope = "tenant" | "user" | "platform";

/** Where a cache keeps its values: this process, Redis, or this process in front of Redis. */
export type CacheTier = "local" | "shared" | "two-tier";

export interface TenantCacheScope {
	readonly scope: "tenant";
	readonly tenantId: string;
}

export interface UserCacheScope {
	readonly scope: "user";
	readonly userId: string;
}

export interface PlatformCacheScope {
	readonly scope: "platform";
}

/** The scope argument a cache of scope `S` requires. */
export type CacheScopeKey<S extends CacheScope> = S extends "tenant" ? TenantCacheScope : S extends "user" ? UserCacheScope : PlatformCacheScope;

export function tenantScope(tenantId: string): TenantCacheScope {
	return { scope: "tenant", tenantId };
}

export function userScope(userId: string): UserCacheScope {
	return { scope: "user", userId };
}

export const PLATFORM_SCOPE: PlatformCacheScope = { scope: "platform" };

/** One stored value with its freshness. Times are epoch milliseconds. */
export interface CacheEnvelope<T> {
	readonly value: T;
	readonly storedAt: number;
	readonly freshUntil: number;
	readonly staleUntil: number;
}

/** What a cache counted in this process since it started. */
export interface CacheCounters {
	hits: number;
	misses: number;
	staleServed: number;
	loads: number;
	loadFailures: number;
	refusedWrites: number;
}

/** The parts of a declared cache the invalidation bus and the admin page reach without its value type. */
export interface CacheNamespaceControl {
	readonly name: string;
	readonly version: number;
	readonly scope: CacheScope;
	readonly tier: CacheTier;
	readonly containsPersonalData: boolean;
	readonly ttlMs: number;
	readonly sharedMaxKeys: number;
	readonly counters: CacheCounters;
	dropLocal(keys: readonly string[]): void;
	clearLocal(): void;
	localSize(): number;
}

export interface CacheDefinitionOptions<T, S extends CacheScope> {
	/** `context.thing`: the key segment, metric label and admin-page name. Unique in the API. */
	readonly name: string;
	/** Bump when the schema changes: entries of other versions are never read. */
	readonly version: number;
	readonly schema: z.ZodType<T>;
	readonly scope: S;
	readonly tier: CacheTier;
	/** How long a value is fresh. A safety net: changes invalidate explicitly (after commit). */
	readonly ttlMs: number;
	/** How long after that a value may be served while one refresh runs, or when the loader fails. */
	readonly staleMs: number;
	/** Encrypted inside Redis; kept in this process only when no cache key ring is configured. */
	readonly containsPersonalData: boolean;
	readonly localMaxEntries: number;
	/** Redis keys this cache may hold; past it, new values are served from the loader and not stored. */
	readonly sharedMaxKeys: number;
	/** For an expensive loader: one instance loads while the others wait up to this long or serve stale. */
	readonly leaseMs?: number;
	/** Tags a value is filed under, for `invalidateTag` (a tenant-scoped value is always filed under `tenant:<id>`). */
	readonly tags?: (value: T) => readonly string[];
}

/** A declared cache. Its local tier and counters live in this process. */
export class CacheDefinition<T, S extends CacheScope> implements CacheNamespaceControl {
	public readonly name: string;
	public readonly version: number;
	public readonly schema: z.ZodType<T>;
	public readonly scope: S;
	public readonly tier: CacheTier;
	public readonly ttlMs: number;
	public readonly staleMs: number;
	public readonly containsPersonalData: boolean;
	public readonly sharedMaxKeys: number;
	public readonly leaseMs: number | null;
	public readonly tagsOf: (value: T) => readonly string[];
	public readonly counters: CacheCounters = { hits: 0, misses: 0, staleServed: 0, loads: 0, loadFailures: 0, refusedWrites: 0 };
	/** Values held in this process, by full key. */
	public readonly local: BoundedTtlCache<string, CacheEnvelope<T>>;
	/** Loads running in this process, by full key (single flight). */
	public readonly inFlight: Map<string, Promise<T>> = new Map<string, Promise<T>>();

	public constructor(options: CacheDefinitionOptions<T, S>) {
		this.name = options.name;
		this.version = options.version;
		this.schema = options.schema;
		this.scope = options.scope;
		this.tier = options.tier;
		this.ttlMs = options.ttlMs;
		this.staleMs = options.staleMs;
		this.containsPersonalData = options.containsPersonalData;
		this.sharedMaxKeys = options.sharedMaxKeys;
		this.leaseMs = options.leaseMs ?? null;
		this.tagsOf = options.tags ?? ((): readonly string[] => []);
		this.local = new BoundedTtlCache<string, CacheEnvelope<T>>({ maxEntries: options.localMaxEntries, capacityPolicy: "evict-oldest" });
	}

	public dropLocal(keys: readonly string[]): void {
		this.local.deleteMany(keys);
	}

	public clearLocal(): void {
		this.local.clear();
	}

	public localSize(): number {
		return this.local.size;
	}
}

/** Declare a cache. One declaration per cache, next to the context that owns the data. */
export function defineCache<T, S extends CacheScope>(options: CacheDefinitionOptions<T, S>): CacheDefinition<T, S> {
	return new CacheDefinition<T, S>(options);
}

/** One cache's numbers for the admin page. */
export interface CacheNamespaceStats {
	readonly name: string;
	readonly version: number;
	readonly scope: CacheScope;
	readonly tier: CacheTier;
	readonly encrypted: boolean;
	readonly ttlMs: number;
	readonly localEntries: number;
	readonly sharedKeys: number | null;
	readonly sharedMaxKeys: number;
	readonly counters: Readonly<CacheCounters>;
}

/** Redis memory as the cache sees it. `null` without Redis. */
export interface CacheMemoryStats {
	readonly usedBytes: number;
	readonly maxBytes: number | null;
	readonly policy: string;
}

export interface AppCache {
	/** Makes a declared cache known (admin page, flushes) before its first use. */
	register(...caches: readonly CacheNamespaceControl[]): void;
	/** The cached value, or `load()`'s answer (then kept for everyone). Stale values are served while one refresh runs. */
	getOrLoad<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string, load: () => Promise<T>): Promise<T>;
	/** Stores a value the caller already loaded (write-through), as `getOrLoad` would have kept it. */
	set<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string, value: T): Promise<void>;
	/** The cached value, or `null`; never loads. */
	peek<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string): Promise<T | null>;
	/** Drops one value everywhere (Redis and every instance's local copy). Call after the change commits. */
	invalidate<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string): Promise<void>;
	/** Drops every value filed under `tag` everywhere. */
	invalidateTag<T, S extends CacheScope>(cache: CacheDefinition<T, S>, tag: string): Promise<void>;
	/** Drops every value of one cache everywhere (admin action). */
	flushNamespace(name: string): Promise<void>;
	/** Drops every value of one tenant in every tenant-scoped cache everywhere (admin action). */
	flushTenant(tenantId: string): Promise<void>;
	stats(): Promise<readonly CacheNamespaceStats[]>;
	memory(): Promise<CacheMemoryStats | null>;
	/** True while repeated Redis failures keep the shared tier switched off (it reopens by itself). */
	isCircuitOpen(): boolean;
}

export const APP_CACHE = Symbol("APP_CACHE");

const PERCENT = 100;
/** The only Redis policy the cache may run under: queues share the instance and must never lose a key (ADR 072). */
export const REQUIRED_REDIS_MEMORY_POLICY = "noeviction";

/** Whether Redis is past `alertPercent` of its maxmemory (no maxmemory: never). */
export function cacheMemoryOverAlert(memory: CacheMemoryStats, alertPercent: number): boolean {
	return memory.maxBytes !== null && memory.maxBytes > 0 && (memory.usedBytes * PERCENT) / memory.maxBytes >= alertPercent;
}
