import type { MembershipRole } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { decideTenantPageAccess } from "@/contexts/tenancy/lib/tenant/tenant-page-access";

describe("decideTenantPageAccess", () => {
	it.each([
		["OWNER", true, true],
		["ADMIN", true, false],
		["CASHIER", false, false],
		["POLICY_ADMIN", false, false],
		["MEMBER", false, false],
	] satisfies [MembershipRole, boolean, boolean][])("%s → team %s, verification %s (same roles the API allows)", (role, team, verification) => {
		expect(decideTenantPageAccess({ role }, "/settings/team").allowed).toBe(team);
		expect(decideTenantPageAccess({ role }, "/settings/verification").allowed).toBe(verification);
		expect(decideTenantPageAccess({ role }, "/settings/locations").allowed).toBe(true);
		expect(decideTenantPageAccess({ role }, "/settings/branding").allowed).toBe(true);
	});

	it("returns the page's denial copy", () => {
		expect(decideTenantPageAccess({ role: "ADMIN" }, "/settings/verification")).toMatchObject({ allowed: false, denial: { title: "Owner access required" } });
	});

	it("denies gated pages without a membership in the URL's tenant", () => {
		expect(decideTenantPageAccess(undefined, "/dashboard").allowed).toBe(false);
		expect(decideTenantPageAccess(undefined, "/settings/locations").allowed).toBe(false);
	});

	it("allows open pages without any membership — the stores page included", () => {
		expect(decideTenantPageAccess(undefined, "/account").allowed).toBe(true);
		expect(decideTenantPageAccess(undefined, "/").allowed).toBe(true);
		expect(decideTenantPageAccess(undefined, "/stores").allowed).toBe(true);
	});
});
