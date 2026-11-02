// ============================================
// platform/infrastructure/cache/tiered-app-cache.ts — the one cache implementation (ADR 072)
// ============================================
// Local (this process), shared (Redis) or two-tier (local in front of Redis), per declared cache:
//
// - Single flight: concurrent misses for one key in this process share one load.
// - Lease: for a cache declaring `leaseMs`, one instance loads while the others wait for its value.
// - Stale-while-revalidate: a value past its freshness but inside `staleMs` is answered at once while
//   one refresh runs; when the loader fails, a stale value stands in for it.
// - Invalidation is explicit and broadcast: Redis entries go first, then every instance drops its local
//   copy. A load that began before an invalidation is answered but not kept.
// - Redis is a trust boundary: every value is parsed with its schema (and decrypted when it holds
//   personal data); a failure is a miss, never a crash.
// - One Redis serves queues and cache (`noeviction`): every entry has an expiry, each cache a key
//   budget, and a refused write only means "not cached".
// - A failing Redis opens a short circuit: `two-tier` answers from this process, `shared` from the loader.

import { randomUUID } from "node:crypto";

import type { Logger } from "@nestjs/common";
import { z } from "zod";

import type {
	AppCache,
	CacheDefinition,
	CacheEnvelope,
	CacheMemoryStats,
	CacheNamespaceControl,
	CacheNamespaceStats,
	CacheScope,
	CacheScopeKey,
} from "../../application/ports/app-cache.port";
import type { RedisNamespace } from "../redis/redis-namespace";
import type { CacheCipher } from "./cache-cipher";
import { cacheIndexKey, cacheInvalidationChannel, cacheLeaseKey, cacheTagKey, cacheValueKey, tenantTag, type CacheKeyParts } from "./cache-keys";
import type { CacheStoreClient } from "./redis-cache-client";

/** Consecutive Redis failures that open the circuit, and how long it stays open. */
export const CACHE_CIRCUIT_FAILURE_THRESHOLD = 3;
export const CACHE_CIRCUIT_OPEN_MS = 5_000;
/** How often a caller waiting on another instance's lease looks for the value. */
export const CACHE_LEASE_POLL_MS = 50;
/** Local tag index entries kept per cache before it is pruned of keys no longer held. */
const TAG_INDEX_PRUNE_FACTOR = 2;

/** One invalidation, broadcast to every instance. */
export const CacheInvalidationMessageSchema = z.object({
	origin: z.string(),
	name: z.string(),
	keys: z.array(z.string()).optional(),
	tag: z.string().optional(),
	all: z.boolean().optional(),
});
export type CacheInvalidationMessage = z.output<typeof CacheInvalidationMessageSchema>;

/** Lets the cache hear other instances' invalidations. */
export interface CacheInvalidationSource {
	onMessage(handler: (message: CacheInvalidationMessage) => void): void;
}

export interface TieredAppCacheOptions {
	readonly namespace: RedisNamespace;
	readonly client: CacheStoreClient | null;
	readonly cipher: CacheCipher | null;
	readonly logger: Logger;
	readonly now?: () => number;
	readonly sleep?: (milliseconds: number) => Promise<void>;
}

function defaultSleep(milliseconds: number): Promise<void> {
	return new Promise<void>((resolve): void => {
		setTimeout(resolve, milliseconds);
	});
}

export class TieredAppCache implements AppCache {
	public readonly instanceId: string = randomUUID();
	private readonly registry: Map<string, CacheNamespaceControl> = new Map<string, CacheNamespaceControl>();
	/** Local keys per cache and tag, so a tag can be dropped from this process too. */
	private readonly localTags: Map<string, Map<string, Set<string>>> = new Map<string, Map<string, Set<string>>>();
	/** Bumped by every invalidation of a cache: a load that began before one is not kept. */
	private readonly epochs: Map<string, number> = new Map<string, number>();
	private readonly namespace: RedisNamespace;
	private readonly client: CacheStoreClient | null;
	private readonly cipher: CacheCipher | null;
	private readonly logger: Logger;
	private readonly now: () => number;
	private readonly sleep: (milliseconds: number) => Promise<void>;
	private consecutiveFailures = 0;
	private circuitOpenUntil = 0;

	public constructor(options: TieredAppCacheOptions) {
		this.namespace = options.namespace;
		this.client = options.client;
		this.cipher = options.cipher;
		this.logger = options.logger;
		this.now = options.now ?? Date.now;
		this.sleep = options.sleep ?? defaultSleep;
	}

	/** Applies other instances' invalidations to this process. */
	public listen(source: CacheInvalidationSource): void {
		source.onMessage((message: CacheInvalidationMessage): void => {
			if (message.origin !== this.instanceId) {
				this.applyLocally(message);
			}
		});
	}

	/** Whether Redis is currently skipped after repeated failures (health shows it as degraded). */
	public isCircuitOpen(): boolean {
		return this.now() < this.circuitOpenUntil;
	}

	public register(...caches: readonly CacheNamespaceControl[]): void {
		for (const cache of caches) {
			const known = this.registry.get(cache.name);
			if (known !== undefined && known !== cache) {
				throw new Error(`Two caches are declared with the name "${cache.name}"`);
			}
			this.registry.set(cache.name, cache);
		}
	}

	public async getOrLoad<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string, load: () => Promise<T>): Promise<T> {
		this.register(cache);
		const key = this.valueKey(cache, scope, id);
		const envelope = await this.read(cache, key);
		const now = this.now();
		if (envelope !== null && now < envelope.freshUntil) {
			cache.counters.hits += 1;
			return envelope.value;
		}
		if (envelope !== null && now < envelope.staleUntil) {
			cache.counters.staleServed += 1;
			if (!cache.inFlight.has(key)) {
				this.loadAndKeep(cache, scope, key, load, envelope).catch((error: unknown): void => {
					this.logger.warn(`cache.refresh_failed cache=${cache.name}`, error);
				});
			}
			return envelope.value;
		}
		cache.counters.misses += 1;
		return this.loadAndKeep(cache, scope, key, load, null);
	}

	public async set<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string, value: T): Promise<void> {
		this.register(cache);
		await this.keep(cache, scope, this.valueKey(cache, scope, id), value);
	}

	public async peek<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string): Promise<T | null> {
		this.register(cache);
		const envelope = await this.read(cache, this.valueKey(cache, scope, id));
		return envelope !== null && this.now() < envelope.staleUntil ? envelope.value : null;
	}

	public async invalidate<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string): Promise<void> {
		this.register(cache);
		const key = this.valueKey(cache, scope, id);
		this.bumpEpoch(cache.name);
		cache.dropLocal([key]);
		if (this.usesShared(cache) && this.client !== null) {
			const client = this.client;
			await this.guarded(async (): Promise<void> => client.drop(cacheIndexKey(this.namespace, this.parts(cache)), [key]), undefined);
		}
		await this.broadcast({ origin: this.instanceId, name: cache.name, keys: [key] });
	}

	public async invalidateTag<T, S extends CacheScope>(cache: CacheDefinition<T, S>, tag: string): Promise<void> {
		this.register(cache);
		await this.dropTag(cache, tag);
	}

	public async flushNamespace(name: string): Promise<void> {
		const cache = this.registry.get(name);
		if (cache === undefined) {
			throw new Error(`No cache is declared with the name "${name}"`);
		}
		this.bumpEpoch(name);
		cache.clearLocal();
		this.localTags.delete(name);
		if (this.usesShared(cache) && this.client !== null) {
			const client = this.client;
			await this.guarded(async (): Promise<readonly string[]> => client.dropAll(cacheIndexKey(this.namespace, this.parts(cache))), []);
		}
		await this.broadcast({ origin: this.instanceId, name, all: true });
	}

	public async flushTenant(tenantId: string): Promise<void> {
		for (const cache of this.registry.values()) {
			if (cache.scope === "tenant") {
				await this.dropTag(cache, tenantTag(tenantId));
			}
		}
	}

	public async stats(): Promise<readonly CacheNamespaceStats[]> {
		const stats: CacheNamespaceStats[] = [];
		for (const cache of [...this.registry.values()].sort((left, right): number => left.name.localeCompare(right.name))) {
			let sharedKeys: number | null = null;
			if (this.usesShared(cache) && this.client !== null) {
				const client = this.client;
				sharedKeys = await this.guarded(async (): Promise<number | null> => client.count(cacheIndexKey(this.namespace, this.parts(cache))), null);
			}
			stats.push({
				name: cache.name,
				version: cache.version,
				scope: cache.scope,
				tier: cache.tier,
				encrypted: cache.containsPersonalData && this.cipher !== null,
				ttlMs: cache.ttlMs,
				localEntries: cache.localSize(),
				sharedKeys,
				sharedMaxKeys: cache.sharedMaxKeys,
				counters: { ...cache.counters },
			});
		}
		return stats;
	}

	public async memory(): Promise<CacheMemoryStats | null> {
		if (this.client === null) {
			return null;
		}
		const client = this.client;
		return this.guarded(async (): Promise<CacheMemoryStats | null> => client.memory(), null);
	}

	/** Applies an invalidation that another instance broadcast. */
	public applyLocally(message: CacheInvalidationMessage): void {
		const cache = this.registry.get(message.name);
		if (cache === undefined) {
			return;
		}
		this.bumpEpoch(message.name);
		if (message.all === true) {
			cache.clearLocal();
			this.localTags.delete(message.name);
		}
		if (message.keys !== undefined) {
			cache.dropLocal(message.keys);
		}
		if (message.tag !== undefined) {
			cache.dropLocal(this.takeLocalTag(message.name, message.tag));
		}
	}

	private async dropTag(cache: CacheNamespaceControl, tag: string): Promise<void> {
		this.bumpEpoch(cache.name);
		cache.dropLocal(this.takeLocalTag(cache.name, tag));
		if (this.usesShared(cache) && this.client !== null) {
			const client = this.client;
			const parts = this.parts(cache);
			await this.guarded(async (): Promise<readonly string[]> => client.dropTag(cacheTagKey(this.namespace, parts, tag), cacheIndexKey(this.namespace, parts)), []);
		}
		await this.broadcast({ origin: this.instanceId, name: cache.name, tag });
	}

	private async loadAndKeep<T, S extends CacheScope>(
		cache: CacheDefinition<T, S>,
		scope: CacheScopeKey<S>,
		key: string,
		load: () => Promise<T>,
		stale: CacheEnvelope<T> | null,
	): Promise<T> {
		const running = cache.inFlight.get(key);
		if (running !== undefined) {
			return running;
		}
		const loading = this.loadOnce(cache, scope, key, load, stale).finally((): void => {
			cache.inFlight.delete(key);
		});
		cache.inFlight.set(key, loading);
		return loading;
	}

	private async loadOnce<T, S extends CacheScope>(
		cache: CacheDefinition<T, S>,
		scope: CacheScopeKey<S>,
		key: string,
		load: () => Promise<T>,
		stale: CacheEnvelope<T> | null,
	): Promise<T> {
		const epoch = this.epochOf(cache.name);
		const leaseKey = cacheLeaseKey(key);
		const holdsLease = await this.takeLeaseOrWait(cache, key, leaseKey);
		if (holdsLease === "value-arrived") {
			const arrived = await this.read(cache, key);
			if (arrived !== null) {
				return arrived.value;
			}
		}
		cache.counters.loads += 1;
		let value: T;
		try {
			value = await load();
		} catch (error) {
			cache.counters.loadFailures += 1;
			if (stale !== null) {
				this.logger.warn(`cache.load_failed_serving_stale cache=${cache.name}`, error);
				return stale.value;
			}
			throw error;
		} finally {
			if (holdsLease === "held" && this.client !== null) {
				const client = this.client;
				await this.guarded(async (): Promise<void> => client.releaseLease(leaseKey), undefined);
			}
		}
		if (this.epochOf(cache.name) === epoch) {
			await this.keep(cache, scope, key, value);
		}
		return value;
	}

	/** `held`: this caller loads; `value-arrived`: another instance stored it meanwhile; `none`: no lease used. */
	private async takeLeaseOrWait<T, S extends CacheScope>(cache: CacheDefinition<T, S>, key: string, leaseKey: string): Promise<"held" | "value-arrived" | "none"> {
		if (cache.leaseMs === null || !this.usesShared(cache) || this.client === null) {
			return "none";
		}
		const client = this.client;
		const leaseMs = cache.leaseMs;
		const taken = await this.guarded(async (): Promise<boolean> => client.takeLease(leaseKey, leaseMs), true);
		if (taken) {
			return "held";
		}
		const deadline = this.now() + leaseMs;
		while (this.now() < deadline) {
			await this.sleep(CACHE_LEASE_POLL_MS);
			const raw = await this.guarded(async (): Promise<string | null> => client.get(key), null);
			if (raw !== null) {
				return "value-arrived";
			}
		}
		return "none";
	}

	private async keep<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, key: string, value: T): Promise<void> {
		const now = this.now();
		const lifetimeMs = cache.ttlMs + cache.staleMs;
		const envelope: CacheEnvelope<T> = { value, storedAt: now, freshUntil: now + cache.ttlMs, staleUntil: now + lifetimeMs };
		const tags = [...cache.tagsOf(value), ...(scope.scope === "tenant" ? [tenantTag(scope.tenantId)] : [])];
		if (cache.tier !== "shared") {
			cache.local.set(key, envelope, lifetimeMs, now);
			this.rememberLocalTags(cache, key, tags);
		}
		if (!this.usesShared(cache) || this.client === null) {
			return;
		}
		const client = this.client;
		const parts = this.parts(cache);
		const json = JSON.stringify(envelope);
		const payload = cache.containsPersonalData && this.cipher !== null ? this.cipher.encrypt(json, key) : json;
		const stored = await this.guarded(
			async (): Promise<boolean> =>
				client.write(
					key,
					cacheIndexKey(this.namespace, parts),
					tags.map((tag: string): string => cacheTagKey(this.namespace, parts, tag)),
					payload,
					lifetimeMs,
					cache.sharedMaxKeys,
				),
			false,
		);
		if (!stored) {
			cache.counters.refusedWrites += 1;
		}
	}

	private async read<T, S extends CacheScope>(cache: CacheDefinition<T, S>, key: string): Promise<CacheEnvelope<T> | null> {
		const now = this.now();
		if (cache.tier !== "shared") {
			const local = cache.local.get(key, now);
			if (local !== null && now < local.freshUntil) {
				return local;
			}
			if (!this.usesShared(cache)) {
				return local;
			}
		}
		if (!this.usesShared(cache) || this.client === null) {
			return null;
		}
		const client = this.client;
		const raw = await this.guarded(async (): Promise<string | null> => client.get(key), null);
		if (raw === null) {
			return cache.tier === "two-tier" ? cache.local.get(key, now) : null;
		}
		const envelope = this.decode(cache, key, raw);
		if (envelope !== null && cache.tier === "two-tier") {
			cache.local.set(key, envelope, Math.max(1, envelope.staleUntil - now), now);
		}
		return envelope;
	}

	private decode<T, S extends CacheScope>(cache: CacheDefinition<T, S>, key: string, raw: string): CacheEnvelope<T> | null {
		const schema = z.object({ value: cache.schema, storedAt: z.number(), freshUntil: z.number(), staleUntil: z.number() });
		try {
			const json = cache.containsPersonalData && this.cipher !== null ? this.cipher.decrypt(raw, key) : raw;
			const parsed = schema.safeParse(JSON.parse(json));
			if (parsed.success) {
				return parsed.data;
			}
			this.logger.warn(`cache.invalid_entry cache=${cache.name}: the stored value does not match its schema; treated as a miss`);
		} catch (error) {
			this.logger.warn(`cache.unreadable_entry cache=${cache.name}: treated as a miss`, error);
		}
		return null;
	}

	/** Runs one Redis call behind the circuit breaker; `fallback` when the circuit is open or the call fails. */
	private async guarded<R>(call: () => Promise<R>, fallback: R): Promise<R> {
		if (this.isCircuitOpen()) {
			return fallback;
		}
		try {
			const result = await call();
			this.consecutiveFailures = 0;
			return result;
		} catch (error) {
			this.consecutiveFailures += 1;
			if (this.consecutiveFailures >= CACHE_CIRCUIT_FAILURE_THRESHOLD) {
				this.circuitOpenUntil = this.now() + CACHE_CIRCUIT_OPEN_MS;
				this.consecutiveFailures = 0;
				this.logger.warn(
					`cache.circuit_open: Redis failed ${String(CACHE_CIRCUIT_FAILURE_THRESHOLD)} times in a row; skipping it for ${String(CACHE_CIRCUIT_OPEN_MS)} ms`,
					error,
				);
			} else {
				this.logger.warn("cache.redis_call_failed", error);
			}
			return fallback;
		}
	}

	private async broadcast(message: CacheInvalidationMessage): Promise<void> {
		if (this.client === null) {
			return;
		}
		const client = this.client;
		await this.guarded(async (): Promise<void> => client.publish(cacheInvalidationChannel(this.namespace), JSON.stringify(message)), undefined);
	}

	private usesShared(cache: CacheNamespaceControl): boolean {
		return cache.tier !== "local" && this.client !== null && !(cache.containsPersonalData && this.cipher === null);
	}

	private parts(cache: CacheNamespaceControl): CacheKeyParts {
		return { name: cache.name, version: cache.version, keyVersion: cache.containsPersonalData && this.cipher !== null ? this.cipher.keyVersion : null };
	}

	private valueKey<T, S extends CacheScope>(cache: CacheDefinition<T, S>, scope: CacheScopeKey<S>, id: string): string {
		return cacheValueKey(this.namespace, this.parts(cache), scope, id);
	}

	private epochOf(name: string): number {
		return this.epochs.get(name) ?? 0;
	}

	private bumpEpoch(name: string): void {
		this.epochs.set(name, this.epochOf(name) + 1);
	}

	private rememberLocalTags<T, S extends CacheScope>(cache: CacheDefinition<T, S>, key: string, tags: readonly string[]): void {
		if (tags.length === 0) {
			return;
		}
		const byTag = this.localTags.get(cache.name) ?? new Map<string, Set<string>>();
		for (const tag of tags) {
			const keys = byTag.get(tag) ?? new Set<string>();
			keys.add(key);
			byTag.set(tag, keys);
		}
		this.localTags.set(cache.name, byTag);
		this.pruneLocalTags(cache, byTag);
	}

	/** Forgets keys this process no longer holds, once the index has grown well past the local cache. */
	private pruneLocalTags<T, S extends CacheScope>(cache: CacheDefinition<T, S>, byTag: Map<string, Set<string>>): void {
		const indexed = [...byTag.values()].reduce((total: number, keys: Set<string>): number => total + keys.size, 0);
		if (indexed <= Math.max(1, cache.localSize()) * TAG_INDEX_PRUNE_FACTOR) {
			return;
		}
		for (const [tag, keys] of byTag) {
			for (const key of keys) {
				if (!cache.local.has(key)) {
					keys.delete(key);
				}
			}
			if (keys.size === 0) {
				byTag.delete(tag);
			}
		}
	}

	private takeLocalTag(name: string, tag: string): string[] {
		const byTag = this.localTags.get(name);
		const keys = byTag?.get(tag);
		if (byTag === undefined || keys === undefined) {
			return [];
		}
		byTag.delete(tag);
		return [...keys];
	}
}
