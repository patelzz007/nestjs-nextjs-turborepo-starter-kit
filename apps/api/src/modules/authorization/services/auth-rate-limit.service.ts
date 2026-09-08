import { Injectable, Logger } from "@nestjs/common";
import { nowEpochMs, SecurityKeyStore } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";

/**
 * In-memory rate limiter for authorization checks.
 *
 * Prevents abuse by limiting how many permission checks a single user can
 * perform within a sliding window.
 *
 * ## Why this matters
 *
 * Authorization checks are async DB/cache queries. A malicious user could
 * trigger thousands of permission checks via rapid API calls, exhausting
 * DB connections or cache bandwidth. This limiter provides defense in depth.
 *
 * ## Configuration
 *
 * - Default: 1000 checks per 15-minute window per user.
 * - Super-admins bypass the limit.
 */
@Injectable()
export class AuthRateLimitService {
	private readonly logger: Logger = new Logger(AuthRateLimitService.name);

	/** Sliding window: 15 minutes. */
	private readonly windowMs: number = 15 * 60 * 1000;

	/** Max checks per window per user. */
	private readonly maxChecks: number = 1000;

	/** Per-user sliding windows. userId → array of timestamps. */
	private readonly windows = new Map<string, number[]>();
	private readonly keyStore: SecurityKeyStore<string>;

	public constructor(config: TypedConfigService) {
		this.keyStore = new SecurityKeyStore<string>({ maxKeys: config.securityCounterMaxKeys });
	}

	/**
	 * Check if a user has exceeded the rate limit.
	 *
	 * @returns `true` if the check is allowed, `false` if rate-limited.
	 */
	public isAllowed(userId: string): boolean {
		const now = nowEpochMs();
		const cutoff: number = now - this.windowMs;
		const keyExpiresAt: number = now + this.windowMs;

		if (!this.keyStore.has(userId, now) && !this.keyStore.reserveKey(userId, keyExpiresAt, now)) {
			this.logger.warn(`Authorization rate-limit key store at capacity — rejecting new key ${userId}`);
			return false;
		}

		let timestamps: number[] | undefined = this.windows.get(userId);
		if (timestamps === undefined) {
			timestamps = [];
			this.windows.set(userId, timestamps);
			this.keyStore.touchKey(userId, keyExpiresAt);
		}

		while (timestamps.length > 0 && timestamps[0] < cutoff) {
			timestamps.shift();
		}

		if (timestamps.length === 0) {
			this.keyStore.delete(userId);
			if (!this.keyStore.reserveKey(userId, keyExpiresAt, now)) {
				this.logger.warn(`Authorization rate-limit key store at capacity — rejecting key ${userId}`);
				return false;
			}
		}

		if (timestamps.length >= this.maxChecks) {
			this.logger.warn(`Rate limit exceeded for user ${userId}: ${String(timestamps.length)} checks in ${String(this.windowMs / 1000)}s window`);
			return false;
		}

		timestamps.push(now);
		this.keyStore.touchKey(userId, keyExpiresAt);
		return true;
	}

	/**
	 * Get the remaining allowance for a user.
	 */
	public remaining(userId: string): number {
		const now = nowEpochMs();
		const cutoff: number = now - this.windowMs;

		const timestamps: number[] = this.windows.get(userId) ?? [];
		const active: number = timestamps.filter((t) => t >= cutoff).length;
		return Math.max(0, this.maxChecks - active);
	}

	/**
	 * Clear all rate limit data.
	 */
	public clear(): void {
		this.windows.clear();
		this.keyStore.clear();
	}
}
