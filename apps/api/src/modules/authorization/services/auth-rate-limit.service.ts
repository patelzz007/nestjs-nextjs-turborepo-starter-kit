import { Injectable, Logger } from "@nestjs/common";
import { BoundedTtlCache, nowEpochMs } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";

/** Sliding window length. */
export const AUTH_CHECK_RATE_WINDOW_MS = 15 * 60 * 1000;

/** Max authorization checks per user per window. */
export const AUTH_CHECK_RATE_MAX_CHECKS = 1000;

/**
 * In-memory sliding-window rate limiter for authorization checks.
 *
 * Authorization checks are DB/cache work; a caller hammering them could
 * exhaust connections. This limiter is defense in depth: at most
 * {@link AUTH_CHECK_RATE_MAX_CHECKS} checks per user within any
 * {@link AUTH_CHECK_RATE_WINDOW_MS} window.
 *
 * Memory is bounded: one entry per tracked user in a {@link BoundedTtlCache}
 * capped at `SECURITY_COUNTER_MAX_KEYS`, each entry expiring one window after
 * its last check. At capacity, **new** users are rejected (fail closed) rather
 * than evicting someone else's window — eviction would let an attacker reset
 * limits by flooding keys.
 */
@Injectable()
export class AuthRateLimitService {
	private readonly logger: Logger = new Logger(AuthRateLimitService.name);

	/** userId → timestamps (epoch ms) of checks inside the current window, oldest first. */
	private readonly windows: BoundedTtlCache<string, readonly number[]>;

	public constructor(config: TypedConfigService) {
		this.windows = new BoundedTtlCache<string, readonly number[]>({
			maxEntries: config.securityCounterMaxKeys,
			defaultTtlMs: AUTH_CHECK_RATE_WINDOW_MS,
			capacityPolicy: "reject-new",
		});
	}

	/**
	 * Record a check for `userId` if it is within the limit.
	 *
	 * @returns `true` if the check is allowed, `false` if rate-limited (or the tracker is full).
	 */
	public isAllowed(userId: string): boolean {
		const now: number = nowEpochMs();
		const active: readonly number[] = this.activeTimestamps(userId, now);

		if (active.length >= AUTH_CHECK_RATE_MAX_CHECKS) {
			this.logger.warn(`Rate limit exceeded for user ${userId}: ${String(active.length)} checks in ${String(AUTH_CHECK_RATE_WINDOW_MS / 1000)}s window`);
			return false;
		}

		if (!this.windows.set(userId, [...active, now], AUTH_CHECK_RATE_WINDOW_MS, now)) {
			this.logger.warn(`Authorization rate-limit tracker at capacity — rejecting new key ${userId}`);
			return false;
		}
		return true;
	}

	/** Checks `userId` may still make in the current window. */
	public remaining(userId: string): number {
		return Math.max(0, AUTH_CHECK_RATE_MAX_CHECKS - this.activeTimestamps(userId, nowEpochMs()).length);
	}

	/** Clear all rate limit data. */
	public clear(): void {
		this.windows.clear();
	}

	/** Timestamps strictly inside the window ending at `now`. */
	private activeTimestamps(userId: string, now: number): readonly number[] {
		const cutoff: number = now - AUTH_CHECK_RATE_WINDOW_MS;
		return (this.windows.get(userId, now) ?? []).filter((timestamp: number): boolean => timestamp > cutoff);
	}
}
