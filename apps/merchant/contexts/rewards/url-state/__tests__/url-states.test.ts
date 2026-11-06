// Page-level parsing: the server page parses its `searchParams` with these
// codecs (redemptions prefetch) and the views read the same declarations from
// `useSearchParams()`. These tests pin the URL ⇄ state ⇄ API-input mapping.

import { MerchantRewardListQuerySchema, TenantSlugParamSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { TEST_ORG_SLUG } from "@/testing/authorization";
import { STORE_A } from "@/testing/terminals";

import { REWARD_CATALOG_PAGE_SIZE, REWARDS_URL_STATE, rewardsTabPatch, toRewardsQuery } from "../rewards";

describe("REWARDS_URL_STATE", () => {
	const RewardsRequestSchema = z.intersection(TenantSlugParamSchema, MerchantRewardListQuerySchema);

	it("leaves the tab to the catalog when the URL names none, and keeps the URL clean", () => {
		expect(REWARDS_URL_STATE.parse({})).toMatchObject({ status: undefined, page: 1, limit: REWARD_CATALOG_PAGE_SIZE });
		expect(REWARDS_URL_STATE.serialize(REWARDS_URL_STATE.parse({}))).toBe("");
	});

	it("reads and writes every status tab with its page", () => {
		expect(REWARDS_URL_STATE.parse({ status: "review", page: "3" })).toMatchObject({ status: "review", page: 3 });
		expect(REWARDS_URL_STATE.serialize({ ...REWARDS_URL_STATE.parse({}), status: "ended", page: 2 })).toBe("status=ended&page=2");
	});

	it("ignores a status that is not a tab — the API's status names included", () => {
		expect(REWARDS_URL_STATE.parse({ status: "PUBLISHED" })).toMatchObject({ status: undefined });
		expect(REWARDS_URL_STATE.parse({ status: ["drafts", "live"] })).toMatchObject({ status: "drafts" });
	});

	it("asks the API for the open tab's statuses in the store scope, an input the contract accepts", () => {
		const input = toRewardsQuery(TEST_ORG_SLUG, STORE_A.id, REWARDS_URL_STATE.parse({ page: "2", cursor: "abc" }), "ended");

		expect(input).toEqual({
			tenantSlug: TEST_ORG_SLUG,
			page: 2,
			limit: REWARD_CATALOG_PAGE_SIZE,
			cursor: "abc",
			locationId: STORE_A.id,
			filter: { status: { in: ["EXPIRED", "DISABLED"] } },
		});
		expect(RewardsRequestSchema.safeParse(input).success).toBe(true);
	});

	it("opens another tab on its first page", () => {
		expect(rewardsTabPatch("drafts")).toEqual({ status: "drafts", page: 1, cursor: undefined });
	});
});
