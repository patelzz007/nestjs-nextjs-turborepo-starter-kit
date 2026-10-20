import type { EpochMs, RedemptionCode } from "@workspace/shared";

import type { RewardRedemptionFacts } from "../../../rewards/public-api";
import type { RewardClaimStatus } from "../../domain/value-objects/claim-rules.value-object";

/** The claim behind a presented code, and the reward it is for. */
export interface ClaimRedemptionLookup {
	readonly claim: {
		readonly id: string;
		readonly userId: string;
		readonly rewardId: string;
		readonly status: RewardClaimStatus;
		readonly claimExpiresAt: EpochMs;
	};
	readonly reward: RewardRedemptionFacts;
}

/**
 * `ClaimRedemptionPort` (plan §6.3), bound to the checkout's transaction: pos finds the merchant's
 * claims behind presented codes and redeems them in the same transaction as the sale.
 */
export interface ClaimRedemptionPort {
	/**
	 * The claim behind one code, if it is a claim on one of `tenantId`'s rewards. `null` for an
	 * unknown code AND for another merchant's code — answered alike (no cross-merchant oracle).
	 */
	findMerchantClaim(code: RedemptionCode, tenantId: string): Promise<ClaimRedemptionLookup | null>;

	/**
	 * PENDING → REDEEMED for every claim, in a stable (claim id) order so overlapping checkouts
	 * cannot deadlock; throws `ClaimNoLongerRedeemableError` naming the first claim a concurrent
	 * redemption or expiry took first (the caller's transaction then rolls back).
	 */
	redeem(claimIds: readonly string[], paidAt: EpochMs): Promise<void>;

	/** The reward each claim is for, one query for all (a recorded sale names what it redeemed). */
	rewardIdsOf(claimIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
