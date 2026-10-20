import { z } from "zod";
import { RewardResponseSchema, type RewardImageResponse, type RewardResponse } from "@workspace/shared";

const FIXTURE_NOW_MS = 1_790_000_000_000;
const FIXTURE_TTL_MS = 30 * 86_400_000;
const FIXTURE_QUANTITY = 50;
/** The cover the fixture carries — a stable, schema-valid https URL a test can assert on. */
export const FIXTURE_COVER_IMAGE_URL = "https://cdn.example.com/rewards/free-coffee/cover.webp";

/** One reward image as the API returns it: its URL, size and renditions (for `srcset`). */
export function rewardImageFixture(fileId: string, url: string): RewardImageResponse {
	return {
		fileId,
		url,
		width: 3840,
		height: 2160,
		sources: [
			{ width: 640, url: url.replace(/\.webp$/u, "-640.webp") },
			{ width: 3840, url },
		],
	};
}

/** The fields a case may override — plain values (the schema parse brands them). */
export type RewardFixtureOverrides = Partial<z.input<typeof RewardResponseSchema>>;

/** A complete, schema-valid consumer reward; `overrides` set only what a case is about. */
export function buildRewardResponse(overrides: RewardFixtureOverrides = {}): RewardResponse {
	return RewardResponseSchema.parse({
		id: "00000000-0000-4000-8000-000000000001",
		tenantId: "00000000-0000-4000-8000-0000000000aa",
		tenantName: "Brew & Bean KL",
		tenantLogoUrl: null,
		tenantLogoSources: [],
		title: "Free coffee",
		description: "One free latte",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "cafe",
		images: [rewardImageFixture("00000000-0000-4000-8000-0000000000c1", FIXTURE_COVER_IMAGE_URL)],
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
