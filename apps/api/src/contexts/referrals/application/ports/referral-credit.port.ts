import type { EpochMs } from "@workspace/shared";

import type { ReferrerBonus } from "../../domain/aggregates/reward-referral.aggregate";

export type { ReferrerBonus };

/**
 * The referred reward's bonus stock, owned by rewards and bound to the same transaction (pos wires
 * rewards' `RewardInventoryPort.creditReferral` in). `null` when there is nothing left to credit
 * with; nothing changed then.
 */
export interface ReferralBonusStockPort {
	creditReferral(rewardId: string, now: EpochMs): Promise<ReferrerBonus | null>;
}

/**
 * `ReferralCreditPort` (plan §6.3), bound to the checkout's transaction: a redemption credits the
 * referrer whose invite led to it, and a referee's first redemption makes their signup referral
 * successful. Both commit or roll back with the sale; their follow-ups are domain events.
 */
export interface ReferralCreditPort {
	/**
	 * Credits the referral behind the referee's claim of `rewardId`, if one is PENDING and the reward
	 * still has a bonus to give (`ReferrerCredited`). Returns the credited referral's id, or null.
	 */
	creditReferrer(rewardId: string, refereeUserId: string, now: EpochMs): Promise<string | null>;

	/** Stamps the referee's signup referral successful on their first redemption (`SignupReferralSucceeded`). Returns its id, or null. */
	markSignupReferralSuccessful(refereeUserId: string, paidAt: EpochMs): Promise<string | null>;
}
