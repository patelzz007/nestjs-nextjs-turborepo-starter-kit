import { epochMs, type EpochMs } from "@workspace/shared";

import { CorruptIdentityStateError } from "../errors/identity.errors";

/** Failed sign-in attempts after which the account locks. */
export const MAX_FAILED_SIGN_IN_ATTEMPTS = 5;

/** Milliseconds per minute. */
const MS_PER_MINUTE = 60_000;

/** Minutes a lock lasts once {@link MAX_FAILED_SIGN_IN_ATTEMPTS} is reached. */
const LOCKOUT_DURATION_MINUTES = 15;

/** How long a lock lasts, in milliseconds (15 minutes). */
export const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * MS_PER_MINUTE;

/** What one failed attempt did: the new state, and whether this attempt is the one that locked the account. */
export interface FailedSignInOutcome {
	readonly state: LockoutState;
	readonly lockedNow: boolean;
}

/**
 * Brute-force protection of one account: the failed sign-in counter and the instant the current
 * lock (if any) ends. Immutable.
 *
 * The rule for one failed attempt: count it, and take a lock ending at {@link LockoutState.lockEndsAt}
 * when the new count reaches {@link MAX_FAILED_SIGN_IN_ATTEMPTS} and the account is not already
 * locked. {@link LockoutState.afterFailedAttempt} is that rule in memory. Persistence applies the
 * same rule as ONE conditional `UPDATE` (D19), so concurrent failures never read a stale counter and
 * a burst of failures locks the account exactly once.
 */
export class LockoutState {
	private constructor(
		public readonly failedAttempts: number,
		public readonly lockedUntil: EpochMs | null,
	) {}

	public static of(failedAttempts: number, lockedUntil: EpochMs | null): LockoutState {
		if (!Number.isInteger(failedAttempts) || failedAttempts < 0) {
			throw new CorruptIdentityStateError("lockout", "failed attempts must be a non-negative integer");
		}
		return new LockoutState(failedAttempts, lockedUntil);
	}

	public static clear(): LockoutState {
		return new LockoutState(0, null);
	}

	/** When a lock taken at `now` ends. */
	public static lockEndsAt(now: EpochMs): EpochMs {
		return epochMs(now + LOCKOUT_DURATION_MS);
	}

	/** Locked while `lockedUntil` is strictly in the future. */
	public isLockedAt(now: EpochMs): boolean {
		return this.lockedUntil !== null && this.lockedUntil > now;
	}

	/** Whether there is anything to reset (a counter or a lock, even an expired one). */
	public isDirty(): boolean {
		return this.failedAttempts > 0 || this.lockedUntil !== null;
	}

	/** The state after one more failed attempt at `now` (the in-memory form of the atomic statement). */
	public afterFailedAttempt(now: EpochMs): FailedSignInOutcome {
		const failedAttempts: number = this.failedAttempts + 1;
		const takesLock: boolean = failedAttempts >= MAX_FAILED_SIGN_IN_ATTEMPTS && !this.isLockedAt(now);
		return {
			state: new LockoutState(failedAttempts, takesLock ? LockoutState.lockEndsAt(now) : this.lockedUntil),
			lockedNow: takesLock,
		};
	}

	public equals(other: LockoutState): boolean {
		return this.failedAttempts === other.failedAttempts && this.lockedUntil === other.lockedUntil;
	}
}
