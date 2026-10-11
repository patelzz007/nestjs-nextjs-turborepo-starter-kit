// ============================================
// github-response.cache.ts - Fresh, single-flight, stale-on-failure answers
// ============================================
// Every signed-in person sees the same repositories, so one GitHub read can
// answer everyone for `freshMs`. Three rules:
//
// 1. Fresh: an answer younger than `freshMs` is served without asking GitHub.
// 2. Single flight: concurrent misses for one key share ONE GitHub request.
// 3. Stale on failure: when GitHub is down, slow or rate-limiting, an answer
//    up to `staleFallbackMs` past its freshness is served instead of an error.
//
// Per API instance, in memory (`BoundedTtlCache`): the data is public-repository
// metadata, a lost cache only costs one GitHub read, and each instance is
// bounded to one read per key per `freshMs` — far below GitHub's 5,000/hour.

import type { Logger } from "@nestjs/common";
import { BoundedTtlCache } from "@workspace/shared";

import { isGithubTransientFailure } from "./github.errors";

/** The source of "now" — a port, so tests pin it. */
export interface GithubClock {
	nowEpochMs(): number;
}

export interface GithubResponseCacheOptions {
	/** How long an answer is served without asking GitHub. */
	readonly freshMs: number;
	/** How long after that it may still stand in for a failed read. */
	readonly staleFallbackMs: number;
	readonly maxEntries: number;
}

/** What a load produced: an answer to keep for everyone, or one only worth returning this once. */
export type GithubLoadResult<V> = { readonly kind: "cacheable"; readonly value: V } | { readonly kind: "transient"; readonly value: V };

interface CachedAnswer<V> {
	readonly value: V;
	readonly storedAtEpochMs: number;
}

export class GithubResponseCache<V> {
	private readonly answers: BoundedTtlCache<string, CachedAnswer<V>>;
	private readonly inFlight: Map<string, Promise<V>> = new Map<string, Promise<V>>();

	public constructor(
		private readonly options: GithubResponseCacheOptions,
		private readonly clock: GithubClock,
		private readonly logger: Logger,
	) {
		this.answers = new BoundedTtlCache<string, CachedAnswer<V>>({ maxEntries: options.maxEntries, capacityPolicy: "evict-oldest" });
	}

	/**
	 * The answer for `key`: fresh from memory, or from `load`. A `transient`
	 * result (GitHub still computing) is returned but not kept — and when a
	 * previous `cacheable` answer exists, that one is returned instead.
	 */
	public async read(key: string, load: () => Promise<GithubLoadResult<V>>): Promise<V> {
		const now = this.clock.nowEpochMs();
		const cached = this.answers.get(key, now);
		if (cached !== null && now - cached.storedAtEpochMs < this.options.freshMs) {
			return cached.value;
		}
		const pending = this.inFlight.get(key);
		if (pending !== undefined) {
			return pending;
		}
		const request = this.refresh(key, cached, load).finally((): void => {
			this.inFlight.delete(key);
		});
		this.inFlight.set(key, request);
		return request;
	}

	private async refresh(key: string, cached: CachedAnswer<V> | null, load: () => Promise<GithubLoadResult<V>>): Promise<V> {
		let result: GithubLoadResult<V>;
		try {
			result = await load();
		} catch (error: unknown) {
			if (cached !== null && error instanceof Error && isGithubTransientFailure(error)) {
				this.logger.warn(`Serving the cached GitHub answer for ${key} (stored ${String(this.clock.nowEpochMs() - cached.storedAtEpochMs)} ms ago): ${error.message}`);
				return cached.value;
			}
			throw error;
		}
		if (result.kind === "transient") {
			return cached?.value ?? result.value;
		}
		const now = this.clock.nowEpochMs();
		this.answers.set(key, { value: result.value, storedAtEpochMs: now }, this.options.freshMs + this.options.staleFallbackMs, now);
		return result.value;
	}
}
