import { describe, expect, it } from "vitest";

import type { MerchantAccessGrant } from "../../../../../platform/application/ports/authorization.port";
import { buildTenantRewardListOrder, buildTenantRewardListWhere, tenantRewardWhere, rewardAvailabilityWhere } from "../reward-list-queries";

const TENANT_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";
const STORE_ID = "9c4f5d85-2d61-4a6b-8d88-3a4b5c6d7e8f";
const OTHER_STORE_ID = "ad506e96-3e72-4b7c-9e99-4b5c6d7e8f90";

const WHOLE_TENANT: MerchantAccessGrant = { tenantId: TENANT_ID, locationScope: "ALL_LOCATIONS", locationIds: [] };
const TWO_STORES: MerchantAccessGrant = { tenantId: TENANT_ID, locationScope: "SELECTED", locationIds: [STORE_ID, OTHER_STORE_ID] };

describe("rewardAvailabilityWhere", () => {
	it("adds no store filter for a member who may act at every store", () => {
		expect(rewardAvailabilityWhere(WHOLE_TENANT)).toEqual({});
	});

	it("keeps tenant-wide rewards plus those offered at one of a store-limited member's stores", () => {
		expect(rewardAvailabilityWhere(TWO_STORES)).toEqual({
			OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [STORE_ID, OTHER_STORE_ID] } } } }],
		});
	});
});

describe("tenantRewardWhere", () => {
	it("lists only the tenant's live consumer rewards (never a referrer child or a deleted row)", () => {
		expect(tenantRewardWhere(WHOLE_TENANT)).toEqual({ AND: [{ tenantId: TENANT_ID, isDeleted: false, rewardKind: "CONSUMER" }, {}] });
	});

	it("narrows a store-limited member to the rewards offered at their stores (tenant-wide ones included)", () => {
		expect(tenantRewardWhere(TWO_STORES)).toEqual({
			AND: [
				{ tenantId: TENANT_ID, isDeleted: false, rewardKind: "CONSUMER" },
				{ OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [STORE_ID, OTHER_STORE_ID] } } } }] },
			],
		});
	});
});

describe("tenant reward list query → Prisma", () => {
	it("keeps the grant's scope and adds the status filter of a catalog tab", () => {
		expect(buildTenantRewardListWhere(WHOLE_TENANT, { page: 1, limit: 20 })).toEqual({ AND: [tenantRewardWhere(WHOLE_TENANT)] });
		expect(buildTenantRewardListWhere(WHOLE_TENANT, { page: 1, limit: 20, filter: { status: { in: ["DRAFT", "PENDING_REVIEW"] } } })).toEqual({
			AND: [tenantRewardWhere(WHOLE_TENANT), { status: { in: ["DRAFT", "PENDING_REVIEW"] } }],
		});
	});

	it("orders newest first by default, always with the id tie-breaker", () => {
		expect(buildTenantRewardListOrder({ page: 1, limit: 20 })).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], isDefault: true });
		expect(buildTenantRewardListOrder({ page: 1, limit: 20, sort: "title" })).toMatchObject({ orderBy: [{ title: "asc" }, { id: "asc" }], isDefault: false });
	});
});
