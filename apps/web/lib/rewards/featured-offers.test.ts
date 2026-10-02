import { RewardResponseSchema, type RewardResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FEATURED_OFFER_LIMIT, selectFeaturedOffers, selectMerchantNames } from "@/lib/rewards/featured-offers";

const NOW = 1_790_000_000_000;
const DAY_MS = 86_400_000;

let sequence = 0;

/** The fields a case is about — plain values; the schema parse brands them. */
interface RewardOverrides {
	readonly title?: string;
	readonly quantityRemaining?: number;
	readonly expiryDate?: number;
	readonly organizationName?: string;
}

/** A complete, schema-valid reward; `overrides` set only what a case is about. */
function reward(overrides: RewardOverrides = {}): RewardResponse {
	sequence += 1;
	return RewardResponseSchema.parse({
		id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
		organizationId: "00000000-0000-4000-8000-0000000000aa",
		organizationName: "Brew & Bean KL",
		organizationLogoUrl: null,
		title: `Offer ${String(sequence)}`,
		description: "A reward",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "cafe",
		placeholderImageKey: "cafe",
		quantityTotal: 50,
		quantityRemaining: 20,
		quantityReserved: 0,
		startDate: null,
		expiryDate: NOW + DAY_MS,
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
		createdAt: NOW,
		updatedAt: NOW,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	});
}

describe("selectFeaturedOffers", () => {
	it("features claimable offers, soonest-ending first, mapped to display data", () => {
		const later = reward({ title: "Later", expiryDate: NOW + 3 * DAY_MS });
		const soonest = reward({ title: "Soonest", expiryDate: NOW + DAY_MS });

		const featured = selectFeaturedOffers([later, soonest], NOW);

		expect(featured.map((offer) => offer.title)).toEqual(["Soonest", "Later"]);
		expect(featured[0]).toEqual({
			id: soonest.id,
			title: "Soonest",
			merchantName: "Brew & Bean KL",
			category: "cafe",
			remaining: 20,
			total: 50,
			expiryDate: NOW + DAY_MS,
		});
	});

	it("skips sold-out and expired offers", () => {
		const featured = selectFeaturedOffers(
			[reward({ title: "Sold out", quantityRemaining: 0 }), reward({ title: "Expired", expiryDate: NOW - 1 }), reward({ title: "Live" })],
			NOW,
		);

		expect(featured.map((offer) => offer.title)).toEqual(["Live"]);
	});

	it("caps the selection and never mutates the input", () => {
		const rewards = Array.from({ length: FEATURED_OFFER_LIMIT + 2 }, (_, index: number) => reward({ expiryDate: NOW + (10 - index) * DAY_MS }));
		const before = rewards.map((item) => item.id);

		expect(selectFeaturedOffers(rewards, NOW)).toHaveLength(FEATURED_OFFER_LIMIT);
		expect(rewards.map((item) => item.id)).toEqual(before);
	});

	it("returns nothing when there are no rewards", () => {
		expect(selectFeaturedOffers([], NOW)).toEqual([]);
	});
});

describe("selectMerchantNames", () => {
	it("names each merchant once, in first-seen order, skipping blank names", () => {
		const rewards = [
			reward({ organizationName: "Brew & Bean KL" }),
			reward({ organizationName: "Jonker Street Kitchen" }),
			reward({ organizationName: "Brew & Bean KL" }),
			reward({ organizationName: "  " }),
		];

		expect(selectMerchantNames(rewards)).toEqual(["Brew & Bean KL", "Jonker Street Kitchen"]);
	});

	it("caps the list", () => {
		const rewards = ["A", "B", "C"].map((name: string) => reward({ organizationName: name }));

		expect(selectMerchantNames(rewards, 2)).toEqual(["A", "B"]);
	});
});
