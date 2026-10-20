import { QueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { RewardResponseSchema, type Envelope, type RewardResponse } from "@workspace/shared";
import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { applyMerchantRewardChange } from "@/contexts/rewards/lib/query-cache";

const ORG = "acme-coffee";
const NOW = 1_790_812_800_000;

function reward(title: string): RewardResponse {
	return RewardResponseSchema.parse({
		id: "0b6e2c1a-3d4f-4a5b-8c9d-1e2f3a4b5c6d",
		organizationId: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
		organizationName: "Acme Coffee",
		organizationLogoUrl: null,
		organizationLogoSources: [],
		title,
		description: "One free latte",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "cafe",
		images: [
			{
				fileId: "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b",
				url: "https://cdn.example.com/stores/acme-coffee/reward-images/cover.webp",
				width: 3840,
				height: 2160,
				sources: [{ width: 640, url: "https://cdn.example.com/stores/acme-coffee/reward-images/cover/thumbnail.webp" }],
			},
		],
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

const META = { correlationId: "c-1", timestamp: epochMs(NOW) };

describe("applyMerchantRewardChange", () => {
	it("stores the API's answer as the reward's own entry and marks every catalog page and the figures stale", async () => {
		const client = new QueryClient();
		const pageKey = apiRouter.organizations.rewards.list.queryKey({ orgSlug: ORG, page: 2, limit: 12, locationId: undefined });
		const summaryKey = apiRouter.organizations.rewards.summary.queryKey({ orgSlug: ORG, locationId: undefined });
		const otherOrgKey = apiRouter.organizations.rewards.list.queryKey({ orgSlug: "other-org", page: 1, limit: 12, locationId: undefined });
		client.setQueryData(pageKey, { success: true, data: [reward("Old")], meta: META });
		client.setQueryData(summaryKey, { success: true, data: { countsByStatus: {}, unitsRemaining: 0 }, meta: META });
		client.setQueryData(otherOrgKey, { success: true, data: [], meta: META });
		const answer: Envelope<RewardResponse> = { success: true, data: reward("New"), meta: META };

		await applyMerchantRewardChange(client, ORG, answer);

		expect(client.getQueryData(apiRouter.organizations.rewards.get.queryKey({ orgSlug: ORG, rewardId: answer.data.id }))).toEqual(answer);
		expect(client.getQueryState(pageKey)?.isInvalidated).toBe(true);
		expect(client.getQueryState(summaryKey)?.isInvalidated).toBe(true);
		expect(client.getQueryState(otherOrgKey)?.isInvalidated).toBe(false);
	});
});
