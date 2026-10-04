import { QueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { RewardResponseSchema, type Envelope, type RewardResponse } from "@workspace/shared";
import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { upsertMerchantRewardInListCache } from "@/lib/rewards/query-cache";

const ORG = "acme-coffee";
const NOW = 1_790_812_800_000;

function reward(title: string): RewardResponse {
	return RewardResponseSchema.parse({
		id: "0b6e2c1a-3d4f-4a5b-8c9d-1e2f3a4b5c6d",
		organizationId: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
		organizationName: "Acme Coffee",
		organizationLogoUrl: null,
		title,
		description: "One free latte",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "cafe",
		placeholderImageKey: "cafe",
		quantityTotal: 100,
		quantityRemaining: 80,
		quantityReserved: 0,
		startDate: null,
		expiryDate: NOW + 1,
		status: "DRAFT",
		claimCount: 20,
		redemptionCount: 10,
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
	});
}

describe("upsertMerchantRewardInListCache", () => {
	it("replaces the reward in a loaded list and keeps the server's meta", () => {
		const client = new QueryClient();
		const key = apiRouter.organizations.rewards.list.queryKey({ orgSlug: ORG, locationId: undefined });
		const loaded: Envelope<RewardResponse[]> = { success: true, data: [reward("Old")], meta: { correlationId: "c-1", timestamp: epochMs(NOW) } };
		client.setQueryData(key, loaded);

		upsertMerchantRewardInListCache(client, ORG, reward("New"));

		const next = client.getQueryData<Envelope<RewardResponse[]>>(key);
		expect(next?.data.map((row) => row.title)).toEqual(["New"]);
		expect(next?.meta).toEqual(loaded.meta);
	});

	it("never fabricates a list (and its meta) for a query that has not loaded", () => {
		const client = new QueryClient();
		const key = apiRouter.organizations.rewards.list.queryKey({ orgSlug: ORG, locationId: undefined });
		client.getQueryCache().build(client, { queryKey: key });

		upsertMerchantRewardInListCache(client, ORG, reward("New"));

		expect(client.getQueryData(key)).toBeUndefined();
	});
});
