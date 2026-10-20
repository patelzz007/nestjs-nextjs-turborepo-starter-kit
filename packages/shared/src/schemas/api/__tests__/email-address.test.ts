import { describe, expect, it } from "vitest";

import { LoginSchema, SignupSchema } from "../../../contexts/identity/schemas/auth";
import { AdminCreateTenantInviteSchema, TenantMemberInviteSchema } from "../../../contexts/tenancy/schemas/tenant";
import { MerchantCreateMemberSchema } from "../../../contexts/tenancy/schemas/merchant-kyb";
import { AdminCreateMerchantInviteSchema } from "../../../contexts/tenancy/schemas/merchant";
import { CanonicalEmailSchema, EMAIL_ADDRESS_MAX_LENGTH } from "../email-address";

describe("CanonicalEmailSchema", () => {
	it("canonicalises an address to lower case", () => {
		expect(CanonicalEmailSchema.parse("Alice@Example.COM")).toBe("alice@example.com");
	});

	it("rejects invalid, padded and over-long addresses", () => {
		expect(CanonicalEmailSchema.safeParse("not-an-email").success).toBe(false);
		expect(CanonicalEmailSchema.safeParse(" alice@example.com").success).toBe(false);
		expect(CanonicalEmailSchema.safeParse(`${"a".repeat(EMAIL_ADDRESS_MAX_LENGTH)}@example.com`).success).toBe(false);
	});

	it("is the email rule of every account / invitee input — case variants collapse to one value", () => {
		const variants = ["Alice@Example.com", "alice@example.com", "ALICE@EXAMPLE.COM"];
		const canonical = "alice@example.com";
		for (const email of variants) {
			expect(LoginSchema.parse({ email, password: "x" }).email).toBe(canonical);
			expect(SignupSchema.parse({ email, password: "Str0ng!Passw0rd", fullName: "Alice" }).email).toBe(canonical);
			expect(TenantMemberInviteSchema.parse({ email, role: "CASHIER", locationScopeType: "ALL_LOCATIONS", locationIds: [] }).email).toBe(canonical);
			expect(AdminCreateTenantInviteSchema.parse({ email, displayName: "Brew", slug: "brew-bean", city: "KUALA_LUMPUR", category: "cafe" }).email).toBe(canonical);
			expect(AdminCreateMerchantInviteSchema.parse({ email, businessName: "Brew", city: "KUALA_LUMPUR" }).email).toBe(canonical);
			expect(MerchantCreateMemberSchema.parse({ email, password: "Str0ng!Passw0rd", fullName: "Alice", role: "CASHIER" }).email).toBe(canonical);
		}
	});
});
