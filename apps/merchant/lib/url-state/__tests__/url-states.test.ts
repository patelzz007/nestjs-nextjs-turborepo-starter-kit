// Page-level parsing: the server page parses its `searchParams` with these
// codecs (redemptions prefetch) and the views read the same declarations from
// `useSearchParams()`. These tests pin the URL ⇄ state ⇄ API-input mapping.

import {
	MerchantRedemptionListQuerySchema,
	MerchantRewardListQuerySchema,
	OrganizationMemberInviteListQuerySchema,
	OrganizationMemberListQuerySchema,
	OrganizationSlugParamSchema,
	OwnMembershipListQuerySchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { MERCHANT_REDEMPTIONS_PAGE_SIZE } from "@/contexts/pos/lib/redemptions/redemptions-page";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { STORE_A } from "@/test/terminals";

import { API_KEYS_URL_STATE } from "../../../contexts/pos/url-state/api-keys";
import { REDEMPTIONS_URL_STATE, toRedemptionsQuery } from "../../../contexts/pos/url-state/redemptions";
import { STORES_PAGE_SIZE, STORES_URL_STATE, toStoresQuery } from "../../../contexts/organizations/url-state/stores";
import { REWARD_CATALOG_PAGE_SIZE, REWARDS_URL_STATE, rewardsTabPatch, toRewardsQuery } from "../../../contexts/rewards/url-state/rewards";
import { TEAM_INVITES_URL_STATE, TEAM_LIST_PAGE_SIZE, TEAM_MEMBERS_URL_STATE, toTeamInvitesQuery, toTeamMembersQuery } from "../../../contexts/organizations/url-state/team";

/** The contract input of `GET /orgs/:orgSlug/redemptions`. */
const RedemptionsRequestSchema = z.intersection(OrganizationSlugParamSchema, MerchantRedemptionListQuerySchema);

describe("API_KEYS_URL_STATE", () => {
	it("opens on active keys and keeps that default out of the URL", () => {
		expect(API_KEYS_URL_STATE.parse({})).toEqual({ status: "active" });
		expect(API_KEYS_URL_STATE.serialize({ status: "active" })).toBe("");
	});

	it("reads and writes the revoked and all views", () => {
		expect(API_KEYS_URL_STATE.parse({ status: "revoked" })).toEqual({ status: "revoked" });
		expect(API_KEYS_URL_STATE.serialize({ status: "all" })).toBe("status=all");
	});

	it("falls back to active keys for an unknown value", () => {
		expect(API_KEYS_URL_STATE.parse({ status: "deleted" })).toEqual({ status: "active" });
	});
});

describe("REDEMPTIONS_URL_STATE", () => {
	it("maps a page URL and the store scope to the input the contract accepts", () => {
		const input = toRedemptionsQuery(TEST_ORG_SLUG, STORE_A.id, REDEMPTIONS_URL_STATE.parse({ page: "2", cursor: "abc" }));

		expect(input).toEqual({ orgSlug: TEST_ORG_SLUG, page: 2, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, cursor: "abc", locationId: STORE_A.id });
		expect(RedemptionsRequestSchema.safeParse(input).success).toBe(true);
	});

	it("requests the newest page for every store from an empty or hostile URL", () => {
		const input = toRedemptionsQuery(TEST_ORG_SLUG, undefined, REDEMPTIONS_URL_STATE.parse({ page: "-1", limit: "500", sort: "terminalId" }));

		expect(input).toEqual({ orgSlug: TEST_ORG_SLUG, page: 1, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, locationId: undefined });
		expect(RedemptionsRequestSchema.safeParse(input).success).toBe(true);
	});

	it("drops the keyset cursor under a custom sort (oldest first)", () => {
		const input = toRedemptionsQuery(TEST_ORG_SLUG, undefined, REDEMPTIONS_URL_STATE.parse({ page: "2", cursor: "abc", sort: "redeemedAt" }));

		expect(input).toEqual({ orgSlug: TEST_ORG_SLUG, page: 2, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, sort: "redeemedAt", locationId: undefined });
	});
});

describe("REWARDS_URL_STATE", () => {
	const RewardsRequestSchema = z.intersection(OrganizationSlugParamSchema, MerchantRewardListQuerySchema);

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
			orgSlug: TEST_ORG_SLUG,
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

describe("TEAM_MEMBERS_URL_STATE / TEAM_INVITES_URL_STATE", () => {
	const MembersRequestSchema = z.intersection(OrganizationSlugParamSchema, OrganizationMemberListQuerySchema);
	const InvitesRequestSchema = z.intersection(OrganizationSlugParamSchema, OrganizationMemberInviteListQuerySchema);

	it("reads each list's page from its own keys, so paging one never moves the other", () => {
		const url = new URLSearchParams("membersPage=2&membersCursor=abc&invitesPage=3");

		expect(toTeamMembersQuery(TEST_ORG_SLUG, TEAM_MEMBERS_URL_STATE.parse(url))).toEqual({ orgSlug: TEST_ORG_SLUG, page: 2, limit: TEAM_LIST_PAGE_SIZE, cursor: "abc" });
		expect(toTeamInvitesQuery(TEST_ORG_SLUG, TEAM_INVITES_URL_STATE.parse(url))).toEqual({ orgSlug: TEST_ORG_SLUG, page: 3, limit: TEAM_LIST_PAGE_SIZE });
		expect(TEAM_INVITES_URL_STATE.serialize({ ...TEAM_INVITES_URL_STATE.parse(url), page: 4 }, url)).toBe("membersPage=2&membersCursor=abc&invitesPage=4");
	});

	it("builds inputs the contracts accept, and omits the defaults from the URL", () => {
		expect(MembersRequestSchema.safeParse(toTeamMembersQuery(TEST_ORG_SLUG, TEAM_MEMBERS_URL_STATE.parse({}))).success).toBe(true);
		expect(InvitesRequestSchema.safeParse(toTeamInvitesQuery(TEST_ORG_SLUG, TEAM_INVITES_URL_STATE.parse({ invitesSort: "expiresAt" }))).success).toBe(true);
		expect(TEAM_MEMBERS_URL_STATE.serialize(TEAM_MEMBERS_URL_STATE.parse({}))).toBe("");
	});
});

describe("STORES_URL_STATE", () => {
	it("maps the search and the page to the input GET /orgs/memberships accepts, and keeps defaults out of the URL", () => {
		const input = toStoresQuery(STORES_URL_STATE.parse({ search: "  bean ", page: "2" }));

		expect(input).toEqual({ page: 2, limit: STORES_PAGE_SIZE, search: "bean" });
		expect(OwnMembershipListQuerySchema.safeParse(input).success).toBe(true);
		expect(STORES_URL_STATE.serialize(STORES_URL_STATE.parse({}))).toBe("");
	});
});
