import { RewardResponseSchema, epochMs, type RewardResponse } from "@workspace/shared";

/** The cover every reward fixture shows (a READY, published `REWARD_COVER` file). */
export const REWARD_FIXTURE_COVER_FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
export const REWARD_FIXTURE_COVER_URL = `https://cdn.example.com/stores/jonker-street-kitchen/reward-covers/${REWARD_FIXTURE_COVER_FILE_ID}.webp`;

/** A fixed instant for reward fixtures (14 Nov 2026, 00:00 UTC). */
export const REWARD_FIXTURE_EXPIRY_MS = 1_794_614_400_000;

/** A live, single-store free-item reward of "Jonker Street Kitchen" — override what the test is about. */
export function rewardFixture(overrides: Partial<RewardResponse> = {}): RewardResponse {
	return RewardResponseSchema.parse({
		id: "0b6e2c1a-3d4f-4a5b-8c9d-1e2f3a4b5c6d",
		organizationId: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
		organizationName: "Jonker Street Kitchen",
		organizationLogoUrl: null,
		title: "Nyonya kuih sampler",
		description: "Three-piece kuih platter.",
		rewardType: "FREE_ITEM",
		rewardValue: 1,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "food",
		coverFileId: REWARD_FIXTURE_COVER_FILE_ID,
		coverImageUrl: REWARD_FIXTURE_COVER_URL,
		quantityTotal: 35,
		quantityRemaining: 28,
		quantityReserved: 0,
		startDate: null,
		expiryDate: epochMs(REWARD_FIXTURE_EXPIRY_MS),
		status: "PUBLISHED",
		claimCount: 7,
		redemptionCount: 3,
		referralsEnabled: false,
		referralPoolTotal: null,
		referralPoolRemaining: null,
		referrerRewardId: null,
		rules: null,
		locationScopeType: "SELECTED",
		locationIds: ["5d2f6a1b-0c3e-4f7a-9b8c-2d1e0f3a4b5c"],
		locationNames: ["Jonker Street Kitchen — Bukit Katil"],
		createdAt: REWARD_FIXTURE_EXPIRY_MS,
		updatedAt: REWARD_FIXTURE_EXPIRY_MS,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	});
}
