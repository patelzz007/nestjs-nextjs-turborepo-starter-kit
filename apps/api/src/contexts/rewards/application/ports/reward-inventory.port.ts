import type { EpochMs } from "@workspace/shared";

import type { ClaimableRewardFacts, ReferrerCreditFacts } from "../../domain/aggregates/reward.state";

export type { ClaimableRewardFacts, ReferrerCreditFacts };

/**
 * Stock of a reward, for claims and checkout (plan §6.3). Bound to the CALLER's transaction: a
 * claim's reservation, an expiry's release and a checkout's redemption commit or roll back with
 * the claim rows they belong to. Each call loads the Reward aggregate under a row lock, calls one
 * stock method, and saves it.
 */
export interface RewardInventoryPort {
	/** Whether a consumer may start a claim; throws `RewardNotFoundError` / `RewardExpiredError` / `RewardSoldOutError`. */
	assertClaimable(rewardId: string, now: EpochMs): Promise<ClaimableRewardFacts>;

	/** Takes one unit for a new claim; throws `RewardJustSoldOutError` when it cannot. */
	reserve(rewardId: string, now: EpochMs): Promise<ClaimableRewardFacts>;

	/** Gives an expired claim's unit back. */
	release(rewardId: string, now: EpochMs): Promise<void>;

	/**
	 * Locks every live reward of a checkout AND the referrer child of each, `FOR UPDATE`, in ONE pass
	 * ordered by id, before any of them is written. Two overlapping checkouts then always lock in the
	 * same order (a later `recordRedemption` / `creditReferral` re-locks rows it already holds), so they
	 * cannot deadlock. Call it after the claims are redeemed: claims are always locked before rewards.
	 */
	lockForCheckout(rewardIds: readonly string[]): Promise<void>;

	/** A claim of this reward was redeemed at checkout. */
	recordRedemption(rewardId: string, now: EpochMs): Promise<void>;

	/**
	 * A referee's redemption of `rewardId` credits its referrer: spends one unit of the referral pool
	 * and holds one unit of the referrer child for the credit claim. `null` (nothing changed) when
	 * there is nothing left to credit with.
	 */
	creditReferral(rewardId: string, now: EpochMs): Promise<ReferrerCreditFacts | null>;
}
