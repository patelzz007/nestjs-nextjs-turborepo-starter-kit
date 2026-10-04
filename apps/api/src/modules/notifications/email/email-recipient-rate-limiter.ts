import { createHash } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { BoundedTtlCache } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../../../infrastructure/redis/redis.tokens";

/** Length of the per-recipient counting window. */
export const EMAIL_RATE_WINDOW_MS = 60_000;

/** One in-memory counting window. */
interface MemoryWindow {
	readonly hits: number;
	readonly endsAt: number;
}

/** Redis key prefix — the recipient itself is never part of a key (only its SHA-256). */
const RATE_KEY_PREFIX = "email:rate:";

/**
 * Per-recipient send limit (`EMAIL_RATE_LIMIT_PER_MINUTE`, 0 = off): a fixed
 * one-minute window per recipient.
 *
 * - With Redis (every multi-instance deployment — production requires
 *   `REDIS_URL`) the counter is ONE shared `INCR` + `PEXPIRE` key per
 *   recipient, so the limit holds across API instances and the key expires
 *   by itself: nothing accumulates in process memory.
 * - Without Redis (single-process development) a bounded TTL cache counts
 *   instead; at capacity it refuses NEW recipients (fails closed) rather than
 *   growing.
 *
 * Keys are a SHA-256 of the normalized address, so no raw email address is
 * written to Redis.
 */
@Injectable()
export class EmailRecipientRateLimiter {
	private readonly logger: Logger = new Logger(EmailRecipientRateLimiter.name);
	private readonly memory: BoundedTtlCache<string, MemoryWindow>;

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(REDIS_PUBLISHER) private readonly redis: Redis | null,
	) {
		this.memory = new BoundedTtlCache<string, MemoryWindow>({ maxEntries: config.securityCounterMaxKeys, capacityPolicy: "reject-new" });
	}

	/** Count one send to `recipient`; false when it would exceed the limit. */
	public async tryAcquire(recipient: string): Promise<boolean> {
		const limit: number = this.config.emailRateLimitPerMinute;
		if (limit <= 0) {
			return true;
		}
		const key: string = this.config.redisNamespace.key(`${RATE_KEY_PREFIX}${createHash("sha256").update(recipient.trim().toLowerCase()).digest("hex")}`);
		if (this.redis !== null) {
			const hits: number = await this.redis.incr(key);
			if (hits === 1) {
				await this.redis.pexpire(key, EMAIL_RATE_WINDOW_MS);
			}
			return hits <= limit;
		}
		return this.tryAcquireInMemory(key, limit);
	}

	private tryAcquireInMemory(key: string, limit: number): boolean {
		const now: number = Date.now();
		const current: MemoryWindow | null = this.memory.get(key, now);
		if (current === null) {
			const stored: boolean = this.memory.set(key, { hits: 1, endsAt: now + EMAIL_RATE_WINDOW_MS }, EMAIL_RATE_WINDOW_MS, now);
			if (!stored) {
				this.logger.warn("Email rate-limit memory store at capacity — refusing a send to a new recipient");
			}
			return stored;
		}
		if (current.hits >= limit) {
			return false;
		}
		// Keep the window's original end — a fixed window, like the Redis key's PEXPIRE.
		return this.memory.set(key, { hits: current.hits + 1, endsAt: current.endsAt }, Math.max(current.endsAt - now, 1), now);
	}
}
