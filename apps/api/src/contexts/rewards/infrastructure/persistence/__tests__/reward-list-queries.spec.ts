import { describe, expect, it } from "vitest";

import type { MerchantAccessGrant } from "../../../../organizations/public-api";
import { buildOrganizationRewardListOrder, buildOrganizationRewardListWhere, organizationRewardWhere, rewardAvailabilityWhere } from "../reward-list-queries";

const ORGANIZATION_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";
const STORE_ID = "9c4f5d85-2d61-4a6b-8d88-3a4b5c6d7e8f";
const OTHER_STORE_ID = "ad506e96-3e72-4b7c-9e99-4b5c6d7e8f90";

const WHOLE_ORGANIZATION: MerchantAccessGrant = { organizationId: ORGANIZATION_ID, locationScope: "ALL_LOCATIONS", locationIds: [] };
const TWO_STORES: MerchantAccessGrant = { organizationId: ORGANIZATION_ID, locationScope: "SELECTED", locationIds: [STORE_ID, OTHER_STORE_ID] };

describe("rewardAvailabilityWhere", () => {
	it("adds no store filter for a member who may act at every store", () => {
		expect(rewardAvailabilityWhere(WHOLE_ORGANIZATION)).toEqual({});
	});

	it("keeps organization-wide rewards plus those offered at one of a store-limited member's stores", () => {
		expect(rewardAvailabilityWhere(TWO_STORES)).toEqual({
			OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [STORE_ID, OTHER_STORE_ID] } } } }],
		});
	});
});

describe("organizationRewardWhere", () => {
	it("lists only the organization's live consumer rewards (never a referrer child or a deleted row)", () => {
		expect(organizationRewardWhere(WHOLE_ORGANIZATION)).toEqual({ AND: [{ organizationId: ORGANIZATION_ID, isDeleted: false, rewardKind: "CONSUMER" }, {}] });
	});

	it("narrows a store-limited member to the rewards offered at their stores (organization-wide ones included)", () => {
		expect(organizationRewardWhere(TWO_STORES)).toEqual({
			AND: [
				{ organizationId: ORGANIZATION_ID, isDeleted: false, rewardKind: "CONSUMER" },
				{ OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [STORE_ID, OTHER_STORE_ID] } } } }] },
			],
		});
	});
});

describe("organization reward list query → Prisma", () => {
	it("keeps the grant's scope and adds the status filter of a catalog tab", () => {
		expect(buildOrganizationRewardListWhere(WHOLE_ORGANIZATION, { page: 1, limit: 20 })).toEqual({ AND: [organizationRewardWhere(WHOLE_ORGANIZATION)] });
		expect(buildOrganizationRewardListWhere(WHOLE_ORGANIZATION, { page: 1, limit: 20, filter: { status: { in: ["DRAFT", "PENDING_REVIEW"] } } })).toEqual({
			AND: [organizationRewardWhere(WHOLE_ORGANIZATION), { status: { in: ["DRAFT", "PENDING_REVIEW"] } }],
		});
	});

	it("orders newest first by default, always with the id tie-breaker", () => {
		expect(buildOrganizationRewardListOrder({ page: 1, limit: 20 })).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], isDefault: true });
		expect(buildOrganizationRewardListOrder({ page: 1, limit: 20, sort: "title" })).toMatchObject({ orderBy: [{ title: "asc" }, { id: "asc" }], isDefault: false });
	});
});
