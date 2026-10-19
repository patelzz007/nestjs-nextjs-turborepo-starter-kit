import { epochMs, type EpochMs } from "@workspace/shared";

import type { NewRewardDefinition, RewardRowState, RewardState } from "../aggregates/reward.state";
import { RewardLocationScope } from "../value-objects/reward-location-scope.value-object";
import { RewardRulesValue } from "../value-objects/reward-rules.value-object";

/** A fixed instant every domain test measures from. */
export const NOW: EpochMs = epochMs(1_792_195_200_000);

export const REWARD_ID = "7a2b3c4d-5e6f-4a1b-8c9d-0e1f2a3b4c5d";
export const REFERRER_ID = "11111111-1111-4111-8111-111111111111";
export const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
export const REVIEWER_ID = "33333333-3333-4333-8333-333333333333";
export const STORE_A = "44444444-4444-4444-8444-444444444444";
export const STORE_B = "55555555-5555-4555-8555-555555555555";

/** One week, the expiry tests give a reward unless they say otherwise. */
export const WEEK_MS = 604_800_000;

/** Stored updatedAt of every fixture row, one hour before {@link NOW}. */
export const LOADED_UPDATED_AT: EpochMs = epochMs(NOW - 3_600_000);

export function referrerRow(status: string, patch: Partial<RewardRowState> = {}): RewardRowState {
	return {
		id: REFERRER_ID,
		kind: "REFERRER",
		status,
		title: "Free coffee — Referrer bonus",
		description: "Referrer reward for Free coffee",
		offer: { rewardType: "FREE_ITEM", rewardValue: 0, termsConditions: null, category: "cafe" },
		startDate: null,
		expiryDate: epochMs(NOW + WEEK_MS),
		inventory: { quantityTotal: 3, quantityRemaining: 3, quantityReserved: 0, claimCount: 0, redemptionCount: 0 },
		submittedForReviewAt: null,
		autoPublishAt: status === "PENDING_REVIEW" ? NOW : null,
		reviewedAt: null,
		reviewedByUserId: null,
		updatedAt: LOADED_UPDATED_AT,
		...patch,
	};
}

export function rewardState(status: string, patch: Partial<RewardState> = {}): RewardState {
	return {
		id: REWARD_ID,
		kind: "CONSUMER",
		organizationId: ORGANIZATION_ID,
		status,
		title: "Free coffee",
		description: "One free coffee",
		offer: { rewardType: "FREE_ITEM", rewardValue: 0, termsConditions: null, category: "cafe" },
		rules: RewardRulesValue.none(),
		startDate: null,
		expiryDate: epochMs(NOW + WEEK_MS),
		inventory: { quantityTotal: 5, quantityRemaining: 5, quantityReserved: 0, claimCount: 0, redemptionCount: 0 },
		submittedForReviewAt: null,
		autoPublishAt: status === "PENDING_REVIEW" ? NOW : null,
		reviewedAt: null,
		reviewedByUserId: null,
		rejectionReason: null,
		referralsEnabled: false,
		referralPoolTotal: null,
		referralPoolRemaining: null,
		locationScope: RewardLocationScope.allLocations(),
		imageFileIds: ["66666666-6666-4666-8666-666666666666"],
		availableAtActiveStore: true,
		updatedAt: LOADED_UPDATED_AT,
		referrer: null,
		...patch,
	};
}

export function newReward(patch: Partial<NewRewardDefinition> = {}): NewRewardDefinition {
	return {
		id: REWARD_ID,
		referrerId: REFERRER_ID,
		organizationId: ORGANIZATION_ID,
		title: "Free coffee",
		description: "One free coffee",
		offer: { rewardType: "FREE_ITEM", rewardValue: 0, termsConditions: null, category: "cafe" },
		rules: RewardRulesValue.none(),
		quantityTotal: 5,
		startDate: null,
		expiryDate: epochMs(NOW + WEEK_MS),
		referralsEnabled: false,
		referralPoolTotal: null,
		referrerRewardTitle: null,
		saveAsDraft: true,
		locationScope: RewardLocationScope.allLocations(),
		imageFileIds: ["66666666-6666-4666-8666-666666666666"],
		...patch,
	};
}
