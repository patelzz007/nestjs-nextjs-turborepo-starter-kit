import type { OrganizationMembershipRole } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { decideOrgPageAccess } from "@/contexts/organizations/lib/org/org-page-access";

describe("decideOrgPageAccess", () => {
	it.each([
		["OWNER", true, true],
		["ADMIN", true, false],
		["CASHIER", false, false],
		["POLICY_ADMIN", false, false],
		["MEMBER", false, false],
	] satisfies [OrganizationMembershipRole, boolean, boolean][])("%s → team %s, verification %s (same roles the API allows)", (role, team, verification) => {
		expect(decideOrgPageAccess({ role }, "/settings/team").allowed).toBe(team);
		expect(decideOrgPageAccess({ role }, "/settings/verification").allowed).toBe(verification);
		expect(decideOrgPageAccess({ role }, "/settings/locations").allowed).toBe(true);
		expect(decideOrgPageAccess({ role }, "/settings/branding").allowed).toBe(true);
	});

	it("returns the page's denial copy", () => {
		expect(decideOrgPageAccess({ role: "ADMIN" }, "/settings/verification")).toMatchObject({ allowed: false, denial: { title: "Owner access required" } });
	});

	it("denies gated pages without a membership in the URL's organization", () => {
		expect(decideOrgPageAccess(undefined, "/dashboard").allowed).toBe(false);
		expect(decideOrgPageAccess(undefined, "/settings/locations").allowed).toBe(false);
	});

	it("allows open pages without any membership — the stores page included", () => {
		expect(decideOrgPageAccess(undefined, "/account").allowed).toBe(true);
		expect(decideOrgPageAccess(undefined, "/").allowed).toBe(true);
		expect(decideOrgPageAccess(undefined, "/stores").allowed).toBe(true);
	});
});
