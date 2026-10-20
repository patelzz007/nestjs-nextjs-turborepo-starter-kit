import type { EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { ReferrerCredited, type ReferralDomainEvent } from "../events/referral.events";
import { creditClaimExpiresAt, REFERRER_CLAIM_TTL_DAYS } from "../policies/referrer-credit.policy";

/** A PENDING reward referral: the referrer's invite led the referee to claim the reward. */
export interface PendingRewardReferralState {
	readonly id: string;
	readonly rewardId: string;
	readonly referrerUserId: string;
	readonly refereeUserId: string;
}

/** The referrer bonus the referral's reward handed out for this credit (from rewards' stock). */
export interface ReferrerBonus {
	readonly referrerRewardId: string;
	readonly title: string;
	readonly expiryDate: EpochMs;
}

/**
 * A reward referral (decision #40: created elsewhere; this context credits it). `PENDING → CREDITED`
 * once, when the referee redeems the referred reward and the reward still has a bonus to give.
 * `BLOCKED` is not modelled.
 */
export class RewardReferral extends AggregateRoot<ReferralDomainEvent> {
	private creditedAt: EpochMs | null = null;

	private constructor(private readonly state: PendingRewardReferralState) {
		super();
	}

	public static pending(state: PendingRewardReferralState): RewardReferral {
		return new RewardReferral(state);
	}

	public get id(): string {
		return this.state.id;
	}

	public get rewardId(): string {
		return this.state.rewardId;
	}

	/** When it was credited in this unit of work; null while PENDING. */
	public get creditedAtTime(): EpochMs | null {
		return this.creditedAt;
	}

	/** PENDING → CREDITED with the bonus the reward handed out; the referrer's credit claim follows in the same transaction. */
	public credit(bonus: ReferrerBonus, now: EpochMs): void {
		if (this.creditedAt !== null) {
			return;
		}
		this.creditedAt = now;
		this.record(
			new ReferrerCredited(
				now,
				this.state.id,
				this.state.referrerUserId,
				bonus.referrerRewardId,
				bonus.title,
				creditClaimExpiresAt(now, bonus.expiryDate),
				REFERRER_CLAIM_TTL_DAYS,
			),
		);
	}
}
