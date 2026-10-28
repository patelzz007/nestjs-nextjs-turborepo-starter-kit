// ============================================
// platform/infrastructure/throttling/load-test-traffic-keys.ts — a load test's own rate-limit bucket
// ============================================
// A load test (ADR 068) drives hundreds of requests per second from one runner address: the per-IP
// throttlers would stop it in its first second. Each run is issued a random traffic key, valid for
// the run's length; the runner sends it on every request (`X-Load-Test-Key`), and the throttler
// guards let a request carrying a live key through. The run's own request rate — capped by the
// load-test caps, enforced by the runner — is its bucket. A key is a secret: it lives only in the
// run's job and in this store, and expires with the run.

import { Inject, Injectable } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../redis/redis.tokens";

/** The header a load runner sends its run's key in. */
export const LOAD_TEST_KEY_HEADER = "x-load-test-key";

/** What the keys need of Redis. */
export interface LoadTestKeyClient {
	set(key: string, value: string, mode: "PX", milliseconds: number): Promise<string | null>;
	exists(key: string): Promise<number>;
}

/** How long a positive answer is reused, so a load test costs one Redis read per second, not per request. */
const LIVE_KEY_CACHE_MS = 1_000;

@Injectable()
export class LoadTestTrafficKeys {
	private readonly memory = new Map<string, number>();
	private readonly confirmed = new Map<string, number>();

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(REDIS_PUBLISHER) private readonly redis: LoadTestKeyClient | null,
	) {}

	/** Makes `key` live for `ttlMs`. */
	public async issue(key: string, ttlMs: number): Promise<void> {
		if (this.redis === null) {
			this.memory.set(key, Date.now() + ttlMs);
			return;
		}
		await this.redis.set(this.storageKey(key), "1", "PX", ttlMs);
	}

	/** Whether `key` is a live load-test key. */
	public async isLive(key: string): Promise<boolean> {
		const now: number = Date.now();
		if ((this.confirmed.get(key) ?? 0) > now) {
			return true;
		}
		const live: boolean = this.redis === null ? (this.memory.get(key) ?? 0) > now : (await this.redis.exists(this.storageKey(key))) === 1;
		if (live) {
			this.confirmed.set(key, now + LIVE_KEY_CACHE_MS);
		}
		return live;
	}

	private storageKey(key: string): string {
		return this.config.redisNamespace.key(`load-test:traffic:${key}`);
	}
}
