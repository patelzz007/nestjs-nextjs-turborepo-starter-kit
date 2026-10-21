import { epochMs, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { MfaChallengeAlreadyUsedError, MfaChallengeAttemptsExhaustedError, MfaChallengeExpiredError, MfaChallengePurposeMismatchError } from "../errors/identity.errors";
import type { IdentityEvent } from "../events/identity.events";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** Milliseconds per minute. */
const MS_PER_MINUTE = 60_000;

/** Minutes a login challenge (the step between the password and the second factor) stays open. */
const CHALLENGE_TTL_MINUTES = 10;

/** How long a login challenge stays open, in milliseconds. */
export const MFA_CHALLENGE_TTL_MS = CHALLENGE_TTL_MINUTES * MS_PER_MINUTE;

/** Wrong second-factor codes one challenge accepts before it is consumed (the `maxAttempts` column default). */
export const MFA_CHALLENGE_MAX_ATTEMPTS = 5;

/** What a challenge is for: completing a login, or proving the factor before a rotation. */
export type MfaChallengePurpose = "LOGIN" | "ROTATE";

export interface TwoFactorLoginChallengeState {
	readonly id: string;
	readonly userId: string;
	readonly purpose: MfaChallengePurpose;
	readonly clientType: string | null;
	readonly deviceInfo: string | null;
	readonly ipAddress: string | null;
	readonly attemptCount: number;
	readonly maxAttempts: number;
	readonly consumedAt: EpochMs | null;
	readonly expiresAt: EpochMs;
}

/**
 * The open step between a correct password and the second factor of one login.
 *
 * Consuming it is a compare-and-set on `consumed_at IS NULL`; a completion that loses that race is
 * refused with {@link MfaChallengeAlreadyUsedError} and issues no session (D13). Counting a wrong
 * code is one conditional increment bounded by `maxAttempts`.
 */
export class TwoFactorLoginChallenge extends AggregateRoot<IdentityEvent> {
	private consumedNow = false;

	private constructor(private state: TwoFactorLoginChallengeState) {
		super();
	}

	public static open(
		input: {
			readonly id: string;
			readonly userId: string;
			readonly purpose: MfaChallengePurpose;
			readonly clientType: string | null;
			readonly deviceInfo: string | null;
			readonly ipAddress: string | null;
		},
		now: EpochMs,
	): TwoFactorLoginChallenge {
		return new TwoFactorLoginChallenge({
			...input,
			attemptCount: 0,
			maxAttempts: MFA_CHALLENGE_MAX_ATTEMPTS,
			consumedAt: null,
			expiresAt: epochMs(now + MFA_CHALLENGE_TTL_MS),
		});
	}

	public static rehydrate(state: TwoFactorLoginChallengeState): TwoFactorLoginChallenge {
		if (state.attemptCount < 0 || state.maxAttempts < 1) {
			throw new CorruptAggregateStateError("two_factor_login_challenge", null, `challenge ${state.id} has invalid attempt counters`);
		}
		return new TwoFactorLoginChallenge(state);
	}

	public get id(): string {
		return this.state.id;
	}

	public get userId(): string {
		return this.state.userId;
	}

	public get snapshot(): TwoFactorLoginChallengeState {
		return this.state;
	}

	/** Whether {@link TwoFactorLoginChallenge.consume} ran in this unit of work (the repository writes it conditionally). */
	public get wasConsumed(): boolean {
		return this.consumedNow;
	}

	/** Refuses a challenge that is used, expired, or out of attempts at `now`. */
	public assertActiveAt(now: EpochMs): void {
		if (this.state.consumedAt !== null) {
			throw new MfaChallengeAlreadyUsedError();
		}
		if (this.state.expiresAt < now) {
			throw new MfaChallengeExpiredError();
		}
		if (this.state.attemptCount >= this.state.maxAttempts) {
			throw new MfaChallengeAttemptsExhaustedError();
		}
	}

	public assertPurpose(purpose: MfaChallengePurpose): void {
		if (this.state.purpose !== purpose) {
			throw new MfaChallengePurposeMismatchError();
		}
	}

	/** The challenge is spent: by a passed second factor, or by its last allowed failure. */
	public consume(now: EpochMs): void {
		this.assertActiveOrLastAttempt(now);
		this.state = { ...this.state, consumedAt: now };
		this.consumedNow = true;
	}

	/** Whether a counted failure (the new `attemptCount`) used the last attempt. */
	public isExhaustedBy(attemptCount: number): boolean {
		return attemptCount >= this.state.maxAttempts;
	}

	private assertActiveOrLastAttempt(now: EpochMs): void {
		if (this.state.consumedAt !== null) {
			throw new MfaChallengeAlreadyUsedError();
		}
		if (this.state.expiresAt < now) {
			throw new MfaChallengeExpiredError();
		}
	}
}
