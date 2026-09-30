import { describe, expect, it } from "vitest";

import { membershipRoleAllows } from "@/lib/org/membership-roles";

describe("membershipRoleAllows", () => {
	it("mirrors the API's OWNER/ADMIN team and location rules", () => {
		expect(membershipRoleAllows("OWNER", "manageTeam")).toBe(true);
		expect(membershipRoleAllows("ADMIN", "manageTeam")).toBe(true);
		expect(membershipRoleAllows("CASHIER", "manageTeam")).toBe(false);
		expect(membershipRoleAllows("POLICY_ADMIN", "manageLocations")).toBe(false);
		expect(membershipRoleAllows("ADMIN", "manageLocations")).toBe(true);
	});

	it("limits KYB submission to owners", () => {
		expect(membershipRoleAllows("OWNER", "submitKyb")).toBe(true);
		expect(membershipRoleAllows("ADMIN", "submitKyb")).toBe(false);
	});

	it("fails closed without a membership", () => {
		expect(membershipRoleAllows(undefined, "manageTeam")).toBe(false);
	});
});
