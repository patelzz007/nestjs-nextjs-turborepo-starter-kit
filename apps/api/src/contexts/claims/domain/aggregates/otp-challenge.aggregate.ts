import { epochMs, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import type { DomainEvent } from "../../../../platform/domain/domain-event";
import { OtpAttemptsExhaustedError, OtpMissingError } from "../errors/claims.errors";
import { MAX_OTP_ATTEMPTS, OTP_TTL_MS } from "../value-objects/claim-rules.value-object";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

export interface OtpChallengeState {
	readonly id: string;
	readonly userId: string;
	readonly phone: string;
	readonly rewardId: string;
	readonly codeHash: string;
	readonly expiresAt: EpochMs;
	readonly attempts: number;
	readonly failedAttempts: number;
	readonly consumedAt: EpochMs | null;
}

/**
 * A one-time code proving the customer holds a phone, for one reward. At most
 * {@link MAX_OTP_ATTEMPTS} attempts, valid {@link OTP_TTL_MS}, single use. Each attempt is
 * persisted with a compare-and-set on the attempt counter (D09), so concurrent guesses can never
 * exceed the limit.
 */
export class OtpChallenge extends AggregateRoot<DomainEvent> {
	private attempts: number;
	private failedAttempts: number;
	private consumedAt: EpochMs | null;

	private constructor(private readonly state: OtpChallengeState) {
		super();
		this.attempts = state.attempts;
		this.failedAttempts = state.failedAttempts;
		this.consumedAt = state.consumedAt;
	}

	public static issue(id: string, userId: string, phone: string, rewardId: string, codeHash: string, now: EpochMs): OtpChallenge {
		return new OtpChallenge({ id, userId, phone, rewardId, codeHash, expiresAt: epochMs(now + OTP_TTL_MS), attempts: 0, failedAttempts: 0, consumedAt: null });
	}

	public static rehydrate(state: OtpChallengeState): OtpChallenge {
		const counters = [state.attempts, state.failedAttempts];
		if (!counters.every((value) => Number.isSafeInteger(value) && value >= 0) || state.failedAttempts > state.attempts) {
			throw new CorruptAggregateStateError("claim", state.id);
		}
		return new OtpChallenge(state);
	}

	public get id(): string {
		return this.state.id;
	}

	/** Whether the last {@link verify} matched (the save consumes the challenge). */
	public get isConsumed(): boolean {
		return this.consumedAt !== null;
	}

	/**
	 * Spends one attempt on `candidateHash`. Answers whether it matched; a match consumes the
	 * challenge. A spent, expired or exhausted challenge is refused before any attempt is counted.
	 */
	public verify(candidateHash: string, now: EpochMs): boolean {
		if (this.consumedAt !== null || this.state.expiresAt < now) {
			throw new OtpMissingError();
		}
		if (this.attempts >= MAX_OTP_ATTEMPTS) {
			throw new OtpAttemptsExhaustedError();
		}
		this.attempts += 1;
		const valid = candidateHash === this.state.codeHash;
		if (valid) {
			this.consumedAt = now;
		} else {
			this.failedAttempts += 1;
		}
		return valid;
	}

	public snapshot(): OtpChallengeState {
		return { ...this.state, attempts: this.attempts, failedAttempts: this.failedAttempts, consumedAt: this.consumedAt };
	}
}
