import type { EpochMs } from "@workspace/shared";

import type { RewardReferral } from "../aggregates/reward-referral.aggregate";

/** Persistence port of {@link RewardReferral}, bound to one transaction. */
export interface RewardReferralRepository {
	/**
	 * The referee's PENDING referral of the reward, row-locked `FOR UPDATE` until commit so one
	 * referral is credited once even when two checkouts redeem the same reward for the same referee.
	 */
	lockPendingFor(rewardId: string, refereeUserId: string): Promise<RewardReferral | null>;

	/** Writes PENDING → CREDITED (compare-and-set on PENDING; a referral that moved on throws). */
	save(referral: RewardReferral): Promise<void>;
}

/** The signup referral a referee's first redemption makes successful (ADR 035, "Success"). */
export interface SignupReferralSuccessRepository {
	/**
	 * Stamps the referee's unstamped signup referral successful. The conditional update (`successfulAt`
	 * still null) is the race guard: of two concurrent checkouts only one matches and the other
	 * continues the sale without a stamp. Returns the stamped referral's id, or null.
	 */
	markSuccessful(refereeUserId: string, paidAt: EpochMs): Promise<string | null>;
}
