import { Injectable } from "@nestjs/common";

import { nowEpochMs, type TelescopeCacheOp, type TelescopeJsonValue } from "@workspace/shared";

import { RequestSpanContext } from "./request-span-context";

/**
 * Feature 5 — cache inspection.
 *
 * A dependency-free instrumented cache: `get`/`set`/`delete` record a
 * `TelescopeCacheOp` (operation, key, hit, duration) into the CURRENT
 * request's capture state, so the request detail page shows exactly which
 * cache reads hit or missed during that request.
 *
 * The cache itself is a bounded Map (LRU-ish eviction at cap). To instrument
 * a real cache (Redis, etc.), keep the same method signatures and append ops
 * to `RequestSpanContext.getStore()?.cacheOps` — the store shape is the seam.
 */
interface CacheEntry {
	readonly value: TelescopeJsonValue;
	readonly expiresAt: number;
}

@Injectable()
export class TelescopeCacheTracer {
	/**
	 * Cap for the in-memory entry map (LRU-ish: evicts the first inserted key
	 * when full). Kept as a class constant rather than a constructor parameter
	 * so Nest's DI never tries to resolve a primitive token (`Number`) that no
	 * provider satisfies.
	 */
	private readonly maxEntries = 200;

	private readonly entries = new Map<string, CacheEntry>();

	/** Reads a key; records a `get` op with the hit/miss outcome. */
	public get(key: string): TelescopeJsonValue | undefined {
		const start: number = performance.now();
		const entry: CacheEntry | undefined = this.entries.get(key);
		const expired: boolean = entry !== undefined && entry.expiresAt < Date.now();
		if (expired) {
			this.entries.delete(key);
		}
		this.record({
			operation: "get",
			key: this.truncateKey(key),
			hit: entry !== undefined && !expired,
			durationMs: Math.round(performance.now() - start),
		});
		return entry !== undefined && !expired ? entry.value : undefined;
	}

	/** Writes a key; records a `set` op (ttlMs in milliseconds). */
	public set(key: string, value: TelescopeJsonValue, ttlMs = 60_000): void {
		const start: number = performance.now();
		this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
		if (this.entries.size > this.maxEntries) {
			const oldest: string | undefined = this.entries.keys().next().value;
			if (oldest !== undefined) {
				this.entries.delete(oldest);
			}
		}
		this.record({
			operation: "set",
			key: this.truncateKey(key),
			hit: null,
			durationMs: Math.round(performance.now() - start),
		});
	}

	/** Removes a key; records a `delete` op. */
	public delete(key: string): boolean {
		const start: number = performance.now();
		const existed: boolean = this.entries.delete(key);
		this.record({
			operation: "delete",
			key: this.truncateKey(key),
			hit: null,
			durationMs: Math.round(performance.now() - start),
		});
		return existed;
	}

	private record(op: Omit<TelescopeCacheOp, "at">): void {
		const spanStore = RequestSpanContext.getStore();
		if (spanStore?.captured !== true) {
			return;
		}
		spanStore.cacheOps.push({ ...op, at: nowEpochMs() });
	}

	/** Cache keys can be long — keep the stored key readable. */
	private truncateKey(key: string): string {
		return key.length > 80 ? `${key.slice(0, 77)}…` : key;
	}
}
