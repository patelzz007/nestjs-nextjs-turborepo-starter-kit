/** How the cache behaves when it is at capacity and no expired entries can be removed. */
export type BoundedTtlCapacityPolicy = "evict-oldest" | "reject-new";

export interface BoundedTtlCacheOptions {
	/** Maximum number of live entries before capacity policy applies. */
	readonly maxEntries: number;
	/** Default TTL in milliseconds when `set` is called without an explicit TTL. */
	readonly defaultTtlMs?: number;
	/**
	 * `evict-oldest` — drop the least-recently-written entry (ordinary derived data).
	 * `reject-new` — refuse inserts for new keys (security-sensitive counters).
	 */
	readonly capacityPolicy?: BoundedTtlCapacityPolicy;
}

interface CacheEntry<V> {
	value: V;
	expiresAt: number;
}

export interface BoundedTtlCacheDiagnostics {
	readonly entries: number;
	readonly expiredEntries: number;
	readonly maxEntries: number;
	readonly capacityPolicy: BoundedTtlCapacityPolicy;
}

/**
 * Strongly-held cache with per-entry TTL, deterministic oldest-entry eviction,
 * and optional fail-closed capacity for security-sensitive workloads.
 */
export class BoundedTtlCache<K, V> {
	private readonly maxEntries: number;
	private readonly defaultTtlMs: number | undefined;
	private readonly capacityPolicy: BoundedTtlCapacityPolicy;
	private readonly store = new Map<K, CacheEntry<V>>();
	/** Oldest key first — updated on every successful `set`. */
	private readonly insertionOrder: K[] = [];

	public constructor(options: BoundedTtlCacheOptions) {
		this.maxEntries = options.maxEntries;
		this.defaultTtlMs = options.defaultTtlMs;
		this.capacityPolicy = options.capacityPolicy ?? "evict-oldest";
	}

	public get(key: K, now: number = Date.now()): V | null {
		const entry = this.store.get(key);
		if (entry === undefined) {
			return null;
		}
		if (now > entry.expiresAt) {
			this.delete(key);
			return null;
		}
		return entry.value;
	}

	/**
	 * Store a value with an optional per-entry TTL.
	 *
	 * @returns `false` when `capacityPolicy` is `reject-new` and the cache is full.
	 */
	public set(key: K, value: V, ttlMs?: number, now: number = Date.now()): boolean {
		const resolvedTtl: number | undefined = ttlMs ?? this.defaultTtlMs;
		if (resolvedTtl === undefined || resolvedTtl <= 0) {
			return false;
		}

		const expiresAt: number = now + resolvedTtl;
		const existing = this.store.get(key);
		if (existing !== undefined) {
			this.store.set(key, { value, expiresAt });
			this.touchKey(key);
			return true;
		}

		this.sweepExpired(now);

		if (this.store.size >= this.maxEntries) {
			if (this.capacityPolicy === "reject-new") {
				return false;
			}
			this.evictOldest();
		}

		this.store.set(key, { value, expiresAt });
		this.touchKey(key);
		return true;
	}

	public has(key: K, now: number = Date.now()): boolean {
		return this.get(key, now) !== null;
	}

	public delete(key: K): boolean {
		const removed = this.store.delete(key);
		if (removed) {
			this.removeFromOrder(key);
		}
		return removed;
	}

	public deleteMany(keys: readonly K[]): number {
		let removed = 0;
		for (const key of keys) {
			if (this.delete(key)) {
				removed += 1;
			}
		}
		return removed;
	}

	public clear(): void {
		this.store.clear();
		this.insertionOrder.length = 0;
	}

	/** Remove every expired entry. Returns the number of entries removed. */
	public sweepExpired(now: number = Date.now()): number {
		let removed = 0;
		for (const [key, entry] of this.store) {
			if (now > entry.expiresAt) {
				this.delete(key);
				removed += 1;
			}
		}
		return removed;
	}

	public get size(): number {
		return this.store.size;
	}

	public getDiagnostics(now: number = Date.now()): BoundedTtlCacheDiagnostics {
		let expiredEntries = 0;
		for (const entry of this.store.values()) {
			if (now > entry.expiresAt) {
				expiredEntries += 1;
			}
		}
		return {
			entries: this.store.size,
			expiredEntries,
			maxEntries: this.maxEntries,
			capacityPolicy: this.capacityPolicy,
		};
	}

	private touchKey(key: K): void {
		this.removeFromOrder(key);
		this.insertionOrder.push(key);
	}

	private removeFromOrder(key: K): void {
		const index = this.insertionOrder.indexOf(key);
		if (index >= 0) {
			this.insertionOrder.splice(index, 1);
		}
	}

	private evictOldest(): void {
		while (this.insertionOrder.length > 0 && this.store.size >= this.maxEntries) {
			const oldest = this.insertionOrder.shift();
			if (oldest !== undefined) {
				this.store.delete(oldest);
			}
		}
	}
}
