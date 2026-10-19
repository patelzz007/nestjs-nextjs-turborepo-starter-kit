import type { EpochMs } from "@workspace/shared";

import type { TwoFactorEnrollment } from "../aggregates/two-factor-enrollment.aggregate";
import type { TwoFactorLoginChallenge } from "../aggregates/two-factor-login-challenge.aggregate";

/** Second factors, bound to one unit-of-work transaction. */
export interface TwoFactorEnrollmentRepository {
	/** The account's enrollment (secret, pending setup, unused live backup codes), or `null` when the account is gone. */
	findByUserId(userId: string): Promise<TwoFactorEnrollment | null>;

	/**
	 * Applies the pending changes in order, each conditionally: enabling requires `two_factor_enabled
	 * = false` and the loaded token version; clearing requires the loaded token version; a consumed
	 * backup code requires `used_at IS NULL` (`BackupCodeRejectedError` otherwise, D17); an accepted
	 * login code requires `last_totp_step IS NULL OR < step` (`InvalidTwoFactorCodeError`, D13).
	 */
	save(enrollment: TwoFactorEnrollment): Promise<void>;
}

/** The new attempt count after one failed code, or `null` when the challenge was no longer open. */
export type FailedChallengeAttempt = { readonly attemptCount: number } | null;

/** Login challenges, bound to one unit-of-work transaction. */
export interface TwoFactorLoginChallengeRepository {
	findById(id: string): Promise<TwoFactorLoginChallenge | null>;

	add(challenge: TwoFactorLoginChallenge): Promise<void>;

	/** Writes a consumed challenge: compare-and-set on `consumed_at IS NULL`. Zero rows throws `MfaChallengeAlreadyUsedError` (D13). */
	saveConsumed(challenge: TwoFactorLoginChallenge): Promise<void>;

	/**
	 * Counts one wrong code in one conditional statement, only while the challenge is open
	 * (`consumed_at IS NULL`, not expired, `attempt_count < max_attempts`).
	 */
	recordFailedAttempt(challengeId: string, now: EpochMs): Promise<FailedChallengeAttempt>;
}
