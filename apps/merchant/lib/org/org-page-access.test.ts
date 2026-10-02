import type { OrganizationMembershipRole, OrganizationRewardMembershipResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { decideOrgPageAccess, resolveUrlOrganizationMembership } from "@/lib/org/org-page-access";
import { membershipFixture, TEST_ORG_SLUG } from "@/test/authorization";

const OTHER_ORG: OrganizationRewardMembershipResponse = {
	organizationId: "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f",
	organizationSlug: "other-cafe",
	displayName: "Other Cafe",
	role: "OWNER",
	kybStatus: "APPROVED",
	lifecycleState: "ACTIVE",
};

function membershipsAs(role: OrganizationMembershipRole): readonly OrganizationRewardMembershipResponse[] {
	return [OTHER_ORG, membershipFixture(role)];
}

describe("decideOrgPageAccess", () => {
	it.each([
		["OWNER", true, true],
		["ADMIN", true, false],
		["CASHIER", false, false],
		["POLICY_ADMIN", false, false],
		["MEMBER", false, false],
	] satisfies [OrganizationMembershipRole, boolean, boolean][])("%s → team %s, verification %s (same roles the API allows)", (role, team, verification) => {
		expect(decideOrgPageAccess(membershipsAs(role), TEST_ORG_SLUG, "/settings/team").allowed).toBe(team);
		expect(decideOrgPageAccess(membershipsAs(role), TEST_ORG_SLUG, "/settings/verification").allowed).toBe(verification);
		expect(decideOrgPageAccess(membershipsAs(role), TEST_ORG_SLUG, "/settings/locations").allowed).toBe(true);
	});

	it("returns the page's denial copy", () => {
		expect(decideOrgPageAccess(membershipsAs("ADMIN"), TEST_ORG_SLUG, "/settings/verification")).toMatchObject({
			allowed: false,
			denial: { title: "Owner access required" },
		});
	});

	it("uses the role in the URL's organization, never another membership's (OWNER elsewhere, CASHIER here)", () => {
		expect(decideOrgPageAccess(membershipsAs("CASHIER"), TEST_ORG_SLUG, "/api-keys").allowed).toBe(false);
		expect(decideOrgPageAccess(membershipsAs("CASHIER"), OTHER_ORG.organizationSlug, "/api-keys").allowed).toBe(true);
	});

	it("resolves the organization from its id segment too", () => {
		const cashier = membershipFixture("CASHIER");

		expect(resolveUrlOrganizationMembership([OTHER_ORG, cashier], cashier.organizationId)?.role).toBe("CASHIER");
	});

	it("denies gated pages for an organization the user does not belong to", () => {
		expect(decideOrgPageAccess([OTHER_ORG], TEST_ORG_SLUG, "/dashboard").allowed).toBe(false);
		expect(decideOrgPageAccess([], TEST_ORG_SLUG, "/settings/locations").allowed).toBe(false);
	});

	it("allows open pages without any membership", () => {
		expect(decideOrgPageAccess([], TEST_ORG_SLUG, "/account").allowed).toBe(true);
		expect(decideOrgPageAccess([], TEST_ORG_SLUG, "/").allowed).toBe(true);
	});
});
