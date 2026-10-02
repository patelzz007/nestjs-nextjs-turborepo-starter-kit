import { RewardResponseSchema, type RewardResponse } from "@workspace/shared";

const FIXTURE_NOW_MS = 1_790_000_000_000;
const FIXTURE_TTL_MS = 30 * 86_400_000;
const FIXTURE_QUANTITY = 50;

/** The fields a case may override — plain values; the schema parse brands them. */
export interface RewardFixtureOverrides {
	readonly title?: string;
	readonly organizationName?: string;
	readonly organizationLogoUrl?: string | null;
	readonly quantityRemaining?: number;
}

/** A complete, schema-valid consumer reward; `overrides` set only what a case is about. */
export function buildRewardResponse(overrides: RewardFixtureOverrides = {}): RewardResponse {
	return RewardResponseSchema.parse({
		id: "00000000-0000-4000-8000-000000000001",
		organizationId: "00000000-0000-4000-8000-0000000000aa",
		organizationName: "Brew & Bean KL",
		organizationLogoUrl: null,
		title: "Free coffee",
		description: "One free latte",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "cafe",
		placeholderImageKey: "cafe",
		quantityTotal: FIXTURE_QUANTITY,
		quantityRemaining: FIXTURE_QUANTITY,
		quantityReserved: 0,
		startDate: null,
		expiryDate: FIXTURE_NOW_MS + FIXTURE_TTL_MS,
		status: "PUBLISHED",
		claimCount: 0,
		redemptionCount: 0,
		referralsEnabled: false,
		referralPoolTotal: null,
		referralPoolRemaining: null,
		referrerRewardId: null,
		rules: null,
		locationScopeType: "ALL_LOCATIONS",
		locationIds: [],
		createdAt: FIXTURE_NOW_MS,
		updatedAt: FIXTURE_NOW_MS,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	});
}
