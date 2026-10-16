import { describe, expect, it } from "vitest";

import { apiContract } from "../../../contracts";
import { ORGANIZATION_MEMBER_DISPLAY_NAME_MAX_LENGTH, OrganizationOwnMembershipUpdateSchema } from "./organization";

describe("OrganizationOwnMembershipUpdateSchema", () => {
	it("trims the display name", () => {
		expect(OrganizationOwnMembershipUpdateSchema.parse({ displayName: "  Aisyah (Bukit Bintang)  " })).toEqual({ displayName: "Aisyah (Bukit Bintang)" });
	});

	it("accepts null to clear the display name", () => {
		expect(OrganizationOwnMembershipUpdateSchema.parse({ displayName: null })).toEqual({ displayName: null });
	});

	it("rejects a blank name instead of storing an empty string", () => {
		expect(OrganizationOwnMembershipUpdateSchema.safeParse({ displayName: "   " }).success).toBe(false);
	});

	it("accepts exactly the maximum length and rejects one character more", () => {
		expect(OrganizationOwnMembershipUpdateSchema.safeParse({ displayName: "a".repeat(ORGANIZATION_MEMBER_DISPLAY_NAME_MAX_LENGTH) }).success).toBe(true);
		expect(OrganizationOwnMembershipUpdateSchema.safeParse({ displayName: "a".repeat(ORGANIZATION_MEMBER_DISPLAY_NAME_MAX_LENGTH + 1) }).success).toBe(false);
	});

	it("requires the field and rejects fields a member may not set on their own membership", () => {
		expect(OrganizationOwnMembershipUpdateSchema.safeParse({}).success).toBe(false);
		expect(OrganizationOwnMembershipUpdateSchema.safeParse({ displayName: "Aisyah", role: "OWNER" }).success).toBe(false);
	});

	it("is the input of the PATCH /orgs/:orgSlug/members/me contract", () => {
		const contract = apiContract.organizations.updateOwnMembership;

		expect([contract.method, contract.path]).toEqual(["PATCH", "/orgs/:orgSlug/members/me"]);
		expect(contract.input.parse({ orgSlug: "brew-bean-kl", displayName: " Barista Aisyah " })).toEqual({ orgSlug: "brew-bean-kl", displayName: "Barista Aisyah" });
	});
});
