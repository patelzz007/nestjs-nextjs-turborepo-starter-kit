// Page-level parsing: the server page parses its `searchParams` with these
// codecs (redemptions prefetch) and the views read the same declarations from
// `useSearchParams()`. These tests pin the URL ⇄ state ⇄ API-input mapping.

import {
	TenantMemberInviteListQuerySchema,
	TenantMemberListQuerySchema,
	TenantSlugParamSchema,
	OwnMembershipListQuerySchema,
	TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT,
	TenantCustomerBanListQuerySchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { TEST_ORG_SLUG } from "@/testing/authorization";

import { BANNED_CUSTOMERS_URL_STATE, toBannedCustomersQuery } from "../banned-customers";
import { STORES_PAGE_SIZE, STORES_URL_STATE, toStoresQuery } from "../stores";
import { TEAM_INVITES_URL_STATE, TEAM_LIST_PAGE_SIZE, TEAM_MEMBERS_URL_STATE, toTeamInvitesQuery, toTeamMembersQuery } from "../team";

describe("BANNED_CUSTOMERS_URL_STATE", () => {
	const BannedCustomersRequestSchema = z.intersection(TenantSlugParamSchema, TenantCustomerBanListQuerySchema);

	it("maps a page URL to the input the contract accepts", () => {
		const input = toBannedCustomersQuery(TEST_ORG_SLUG, BANNED_CUSTOMERS_URL_STATE.parse({ page: "2", cursor: "abc" }));

		expect(input).toEqual({ tenantSlug: TEST_ORG_SLUG, page: 2, limit: TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT, cursor: "abc" });
		expect(BannedCustomersRequestSchema.safeParse(input).success).toBe(true);
	});

	it("requests the newest page from an empty or hostile URL", () => {
		const input = toBannedCustomersQuery(TEST_ORG_SLUG, BANNED_CUSTOMERS_URL_STATE.parse({ page: "-1", limit: "500", sort: "reason" }));

		expect(input).toEqual({ tenantSlug: TEST_ORG_SLUG, page: 1, limit: TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT });
		expect(BannedCustomersRequestSchema.safeParse(input).success).toBe(true);
	});
});

describe("TEAM_MEMBERS_URL_STATE / TEAM_INVITES_URL_STATE", () => {
	const MembersRequestSchema = z.intersection(TenantSlugParamSchema, TenantMemberListQuerySchema);
	const InvitesRequestSchema = z.intersection(TenantSlugParamSchema, TenantMemberInviteListQuerySchema);

	it("reads each list's page from its own keys, so paging one never moves the other", () => {
		const url = new URLSearchParams("membersPage=2&membersCursor=abc&invitesPage=3");

		expect(toTeamMembersQuery(TEST_ORG_SLUG, TEAM_MEMBERS_URL_STATE.parse(url))).toEqual({ tenantSlug: TEST_ORG_SLUG, page: 2, limit: TEAM_LIST_PAGE_SIZE, cursor: "abc" });
		expect(toTeamInvitesQuery(TEST_ORG_SLUG, TEAM_INVITES_URL_STATE.parse(url))).toEqual({ tenantSlug: TEST_ORG_SLUG, page: 3, limit: TEAM_LIST_PAGE_SIZE });
		expect(TEAM_INVITES_URL_STATE.serialize({ ...TEAM_INVITES_URL_STATE.parse(url), page: 4 }, url)).toBe("membersPage=2&membersCursor=abc&invitesPage=4");
	});

	it("builds inputs the contracts accept, and omits the defaults from the URL", () => {
		expect(MembersRequestSchema.safeParse(toTeamMembersQuery(TEST_ORG_SLUG, TEAM_MEMBERS_URL_STATE.parse({}))).success).toBe(true);
		expect(InvitesRequestSchema.safeParse(toTeamInvitesQuery(TEST_ORG_SLUG, TEAM_INVITES_URL_STATE.parse({ invitesSort: "expiresAt" }))).success).toBe(true);
		expect(TEAM_MEMBERS_URL_STATE.serialize(TEAM_MEMBERS_URL_STATE.parse({}))).toBe("");
	});
});

describe("STORES_URL_STATE", () => {
	it("maps the search and the page to the input GET /t/memberships accepts, and keeps defaults out of the URL", () => {
		const input = toStoresQuery(STORES_URL_STATE.parse({ search: "  bean ", page: "2" }));

		expect(input).toEqual({ page: 2, limit: STORES_PAGE_SIZE, search: "bean" });
		expect(OwnMembershipListQuerySchema.safeParse(input).success).toBe(true);
		expect(STORES_URL_STATE.serialize(STORES_URL_STATE.parse({}))).toBe("");
	});
});
