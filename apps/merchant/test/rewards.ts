import { RewardResponseSchema, epochMs, type RewardResponse } from "@workspace/shared";

/** The cover every reward fixture shows (a READY, published `REWARD_IMAGE` file with its renditions). */
export const REWARD_FIXTURE_COVER_FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
export const REWARD_FIXTURE_COVER_URL = `https://cdn.example.com/stores/jonker-street-kitchen/reward-images/${REWARD_FIXTURE_COVER_FILE_ID}.webp`;

/** The fixture's one image, as the API returns it. */
export const REWARD_FIXTURE_IMAGE = {
	fileId: REWARD_FIXTURE_COVER_FILE_ID,
	url: REWARD_FIXTURE_COVER_URL,
	width: 3840,
	height: 2160,
	sources: [
		{ width: 640, url: `https://cdn.example.com/stores/jonker-street-kitchen/reward-images/${REWARD_FIXTURE_COVER_FILE_ID}/thumbnail.webp` },
		{ width: 3840, url: `https://cdn.example.com/stores/jonker-street-kitchen/reward-images/${REWARD_FIXTURE_COVER_FILE_ID}/uhd.webp` },
	],
};

/** A fixed instant for reward fixtures (14 Nov 2026, 00:00 UTC). */
export const REWARD_FIXTURE_EXPIRY_MS = 1_794_614_400_000;

/** A live, single-store free-item reward of "Jonker Street Kitchen" — override what the test is about. */
export function rewardFixture(overrides: Partial<RewardResponse> = {}): RewardResponse {
	return RewardResponseSchema.parse({
		id: "0b6e2c1a-3d4f-4a5b-8c9d-1e2f3a4b5c6d",
		organizationId: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
		organizationName: "Jonker Street Kitchen",
		organizationLogoUrl: null,
		organizationLogoSources: [],
		title: "Nyonya kuih sampler",
		description: "Three-piece kuih platter.",
		rewardType: "FREE_ITEM",
		rewardValue: 1,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "food",
		images: [REWARD_FIXTURE_IMAGE],
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
