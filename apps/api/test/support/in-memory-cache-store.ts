import type { CacheStoreClient, RedisMemoryInfo } from "../../src/platform/infrastructure/cache/redis-cache-client";

interface StoredValue {
	readonly payload: string;
	readonly expiresAt: number;
}

/** Bytes the fake reports as Redis' memory limit. */
const FAKE_MAX_MEMORY_BYTES = 1_000_000;

/**
 * A Redis stand-in with the cache scripts' semantics (expiry on every key, the index, key budgets, tag
 * sets, `SET NX` leases and pub/sub), shared by several `TieredAppCache` instances in one test so they
 * behave like API instances on one Redis. The scripts themselves run against a real Redis in
 * `test/app-cache-redis.e2e-spec.ts`.
 */
export class InMemoryCacheStore {
	public readonly values: Map<string, StoredValue> = new Map<string, StoredValue>();
	public readonly published: { readonly channel: string; readonly message: string }[] = [];
	public failing = false;
	public calls = 0;
	private readonly indexes: Map<string, Map<string, number>> = new Map<string, Map<string, number>>();
	private readonly tags: Map<string, Set<string>> = new Map<string, Set<string>>();
	private readonly leases: Map<string, number> = new Map<string, number>();
	private readonly subscribers: ((channel: string, message: string) => void)[] = [];

	public constructor(private readonly now: () => number) {}

	/** Another instance's connection to this store. */
	public client(): CacheStoreClient {
		const guard = (): void => {
			this.calls += 1;
			if (this.failing) {
				throw new Error("connect ECONNREFUSED 127.0.0.1:6379");
			}
		};
		return {
			get: (key: string): Promise<string | null> => {
				guard();
				return Promise.resolve(this.live(key));
			},
			write: (valueKey, indexKey, tagKeys, payload, ttlMs, budget): Promise<boolean> => {
				guard();
				const index = this.index(indexKey);
				if (!index.has(valueKey) && index.size >= budget) {
					return Promise.resolve(false);
				}
				this.values.set(valueKey, { payload, expiresAt: this.now() + ttlMs });
				index.set(valueKey, this.now() + ttlMs);
				for (const tagKey of tagKeys) {
					const members = this.tags.get(tagKey) ?? new Set<string>();
					members.add(valueKey);
					this.tags.set(tagKey, members);
				}
				return Promise.resolve(true);
			},
			drop: (indexKey, valueKeys): Promise<void> => {
				guard();
				for (const key of valueKeys) {
					this.values.delete(key);
					this.index(indexKey).delete(key);
				}
				return Promise.resolve();
			},
			dropTag: (tagKey, indexKey): Promise<readonly string[]> => {
				guard();
				const members = [...(this.tags.get(tagKey) ?? new Set<string>())];
				for (const key of members) {
					this.values.delete(key);
					this.index(indexKey).delete(key);
				}
				this.tags.delete(tagKey);
				return Promise.resolve(members);
			},
			dropAll: (indexKey): Promise<readonly string[]> => {
				guard();
				const members = [...this.index(indexKey).keys()];
				for (const key of members) {
					this.values.delete(key);
				}
				this.indexes.delete(indexKey);
				return Promise.resolve(members);
			},
			count: (indexKey): Promise<number> => {
				guard();
				return Promise.resolve(this.index(indexKey).size);
			},
			takeLease: (leaseKey, ttlMs): Promise<boolean> => {
				guard();
				if ((this.leases.get(leaseKey) ?? 0) > this.now()) {
					return Promise.resolve(false);
				}
				this.leases.set(leaseKey, this.now() + ttlMs);
				return Promise.resolve(true);
			},
			releaseLease: (leaseKey): Promise<void> => {
				guard();
				this.leases.delete(leaseKey);
				return Promise.resolve();
			},
			publish: (channel, message): Promise<void> => {
				guard();
				this.published.push({ channel, message });
				for (const subscriber of this.subscribers) {
					subscriber(channel, message);
				}
				return Promise.resolve();
			},
			memory: (): Promise<RedisMemoryInfo> => {
				guard();
				return Promise.resolve({ usedBytes: this.values.size, maxBytes: FAKE_MAX_MEMORY_BYTES, policy: "noeviction" });
			},
		};
	}

	/** Hears every message published on this store (as `REDIS_SUBSCRIBER` would). */
	public subscribe(listener: (channel: string, message: string) => void): void {
		this.subscribers.push(listener);
	}

	private live(key: string): string | null {
		const stored = this.values.get(key);
		if (stored === undefined || stored.expiresAt <= this.now()) {
			this.values.delete(key);
			return null;
		}
		return stored.payload;
	}

	private index(indexKey: string): Map<string, number> {
		const index = this.indexes.get(indexKey) ?? new Map<string, number>();
		for (const [key, expiresAt] of index) {
			if (expiresAt <= this.now()) {
				index.delete(key);
			}
		}
		this.indexes.set(indexKey, index);
		return index;
	}
}
