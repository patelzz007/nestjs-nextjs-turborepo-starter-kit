import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveActiveOrganizationMembership, resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { membershipFixture, TEST_ORG_SLUG } from "@/test/authorization";

const OTHER_ORG_OWNER: OrganizationRewardMembershipResponse = {
	...membershipFixture("OWNER"),
	organizationId: "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f",
	organizationSlug: "other-cafe",
};

describe("resolveActiveOrganizationMembership", () => {
	it("returns the membership of the organization in the URL", () => {
		const cashier = membershipFixture("CASHIER");

		expect(resolveActiveOrganizationMembership([OTHER_ORG_OWNER, cashier], TEST_ORG_SLUG)).toBe(cashier);
	});

	it("never borrows another organization's role (fails closed)", () => {
		expect(resolveActiveOrganizationMembership([OTHER_ORG_OWNER], TEST_ORG_SLUG)).toBeUndefined();
		expect(resolveMerchantCapabilities(resolveActiveOrganizationMembership([OTHER_ORG_OWNER], TEST_ORG_SLUG))).toEqual([]);
	});

	it("has no membership outside org routes", () => {
		expect(resolveActiveOrganizationMembership([OTHER_ORG_OWNER], undefined)).toBeUndefined();
	});
});
