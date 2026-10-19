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
// Per API instance, in memory (`BoundedTtlCache`): a lost cache only costs one
// GitHub read, and each instance is bounded to one read per key per `freshMs` —
// far below GitHub's 5,000/hour. Answers that change (pull requests) are
// dropped with `invalidate` when a write or a webhook says they did.

import type { Logger } from "@nestjs/common";
import { BoundedTtlCache } from "@workspace/shared";

import type { GithubClock } from "../../application/ports/github-clock.port";
import { isGithubTransientFailure } from "../../application/errors/github.errors";

export interface GithubResponseCacheOptions {
	/** How long an answer is served without asking GitHub. */
	readonly freshMs: number;
	/** How long after that it may still stand in for a failed read. */
	readonly staleFallbackMs: number;
	readonly maxEntries: number;
}

interface CachedAnswer<V> {
	readonly value: V;
	readonly storedAtEpochMs: number;
}

export class GithubResponseCache<V> {
	private readonly answers: BoundedTtlCache<string, CachedAnswer<V>>;
	private readonly inFlight: Map<string, Promise<V>> = new Map<string, Promise<V>>();
	/** Bumped by every {@link invalidate}: a read that began before one is answered but not kept. */
	private invalidationEpoch = 0;

	public constructor(
		private readonly options: GithubResponseCacheOptions,
		private readonly clock: GithubClock,
		private readonly logger: Logger,
	) {
		this.answers = new BoundedTtlCache<string, CachedAnswer<V>>({ maxEntries: options.maxEntries, capacityPolicy: "evict-oldest" });
	}

	/** The answer for `key`: fresh from memory, or from `load` (and then kept for everyone). */
	public async read(key: string, load: () => Promise<V>): Promise<V> {
		const now = this.clock.nowEpochMs();
		const cached = this.answers.get(key, now);
		if (cached !== null && now - cached.storedAtEpochMs < this.options.freshMs) {
			return cached.value;
		}
		const pending = this.inFlight.get(key);
		if (pending !== undefined) {
			return pending;
		}
		const request: Promise<V> = this.refresh(key, cached, load).finally((): void => {
			// An invalidation may have replaced this read with a newer one — leave that one in place.
			if (this.inFlight.get(key) === request) {
				this.inFlight.delete(key);
			}
		});
		this.inFlight.set(key, request);
		return request;
	}

	/**
	 * Drops every answer whose key matches `matches` — the next read asks GitHub
	 * again. A read already on its way to GitHub still answers its caller but is
	 * not kept (it may predate the change), and the next caller starts a new one.
	 */
	public invalidate(matches: (key: string) => boolean): void {
		this.invalidationEpoch += 1;
		this.answers.deleteWhere(matches);
		for (const key of [...this.inFlight.keys()].filter(matches)) {
			this.inFlight.delete(key);
		}
	}

	private async refresh(key: string, cached: CachedAnswer<V> | null, load: () => Promise<V>): Promise<V> {
		const epochAtStart = this.invalidationEpoch;
		let value: V;
		try {
			value = await load();
		} catch (error: unknown) {
			if (cached !== null && error instanceof Error && isGithubTransientFailure(error)) {
				this.logger.warn(`Serving the cached GitHub answer for ${key} (stored ${String(this.clock.nowEpochMs() - cached.storedAtEpochMs)} ms ago): ${error.message}`);
				return cached.value;
			}
			throw error;
		}
		if (epochAtStart === this.invalidationEpoch) {
			const now = this.clock.nowEpochMs();
			this.answers.set(key, { value, storedAtEpochMs: now }, this.options.freshMs + this.options.staleFallbackMs, now);
		}
		return value;
	}
}
