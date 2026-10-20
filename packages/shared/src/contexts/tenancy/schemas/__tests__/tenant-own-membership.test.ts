import { describe, expect, it } from "vitest";

import { apiContract } from "../../../../contracts";
import { TENANT_MEMBER_DISPLAY_NAME_MAX_LENGTH, TenantOwnMembershipUpdateSchema } from "../tenant";

describe("TenantOwnMembershipUpdateSchema", () => {
	it("trims the display name", () => {
		expect(TenantOwnMembershipUpdateSchema.parse({ displayName: "  Aisyah (Bukit Bintang)  " })).toEqual({ displayName: "Aisyah (Bukit Bintang)" });
	});

	it("accepts null to clear the display name", () => {
		expect(TenantOwnMembershipUpdateSchema.parse({ displayName: null })).toEqual({ displayName: null });
	});

	it("rejects a blank name instead of storing an empty string", () => {
		expect(TenantOwnMembershipUpdateSchema.safeParse({ displayName: "   " }).success).toBe(false);
	});

	it("accepts exactly the maximum length and rejects one character more", () => {
		expect(TenantOwnMembershipUpdateSchema.safeParse({ displayName: "a".repeat(TENANT_MEMBER_DISPLAY_NAME_MAX_LENGTH) }).success).toBe(true);
		expect(TenantOwnMembershipUpdateSchema.safeParse({ displayName: "a".repeat(TENANT_MEMBER_DISPLAY_NAME_MAX_LENGTH + 1) }).success).toBe(false);
	});

	it("requires the field and rejects fields a member may not set on their own membership", () => {
		expect(TenantOwnMembershipUpdateSchema.safeParse({}).success).toBe(false);
		expect(TenantOwnMembershipUpdateSchema.safeParse({ displayName: "Aisyah", role: "OWNER" }).success).toBe(false);
	});

	it("is the input of the PATCH /tenants/:tenantSlug/members/me contract", () => {
		const contract = apiContract.tenants.updateOwnMembership;

		expect([contract.method, contract.path]).toEqual(["PATCH", "/tenants/:tenantSlug/members/me"]);
		expect(contract.input.parse({ tenantSlug: "brew-bean-kl", displayName: " Barista Aisyah " })).toEqual({ tenantSlug: "brew-bean-kl", displayName: "Barista Aisyah" });
	});
});
