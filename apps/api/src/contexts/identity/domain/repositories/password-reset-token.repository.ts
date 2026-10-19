import type { EpochMs } from "@workspace/shared";

import type { PasswordResetToken } from "../entities/password-reset-token.entity";

/** Password reset links, bound to one unit-of-work transaction. */
export interface PasswordResetTokenRepository {
	/** The live, unused, unexpired token with this digest at `now`, or `null`. */
	findUsableByDigest(tokenDigest: string, now: EpochMs): Promise<PasswordResetToken | null>;

	/** Expires every unused, unexpired token of the account at `now` (a new link replaces the old ones). */
	expireOpenTokensOf(userId: string, now: EpochMs): Promise<void>;

	add(token: PasswordResetToken): Promise<void>;

	/**
	 * Writes a consumed token: a compare-and-set on `used_at IS NULL` (and still live). Zero rows —
	 * a concurrent reset used it first — throws `PasswordResetTokenInvalidError` (D12).
	 */
	saveConsumed(token: PasswordResetToken): Promise<void>;

	/** Soft-deletes used tokens older than the retention and expired tokens past the grace (set-based). Returns how many. */
	retireStale(now: EpochMs, usedRetentionMs: number, expiredGraceMs: number): Promise<number>;
}
