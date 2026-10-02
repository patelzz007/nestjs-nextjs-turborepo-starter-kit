import { describe, expect, it } from "vitest";
import { CapabilitySlugSchema, MERCHANT_CAPABILITY, MerchantCapabilitySchema } from "@workspace/shared";

import { MERCHANT_CAPABILITY_CATALOG } from "./merchant-capability-catalog";

describe("MERCHANT_CAPABILITY_CATALOG (seeded capability_definitions rows)", () => {
	it("has exactly one row per shared merchant capability, in vocabulary order", () => {
		expect(MERCHANT_CAPABILITY_CATALOG.map((entry) => entry.slug)).toEqual(MerchantCapabilitySchema.options);
	});

	it("seeds the organization-management capabilities that gate Team, Locations and Verification", () => {
		const slugs = MERCHANT_CAPABILITY_CATALOG.map((entry) => entry.slug);

		expect(slugs).toEqual(
			expect.arrayContaining([MERCHANT_CAPABILITY.manageTeam, MERCHANT_CAPABILITY.viewLocations, MERCHANT_CAPABILITY.manageLocations, MERCHANT_CAPABILITY.manageVerification]),
		);
	});

	it("uses valid capability slugs and unique sort orders", () => {
		expect(MERCHANT_CAPABILITY_CATALOG.filter((entry) => !CapabilitySlugSchema.safeParse(entry.slug).success)).toEqual([]);
		const sortOrders = MERCHANT_CAPABILITY_CATALOG.map((entry) => entry.sortOrder);
		expect(new Set(sortOrders).size).toBe(sortOrders.length);
	});

	it("gives every row a label, a description and a group", () => {
		expect(MERCHANT_CAPABILITY_CATALOG.filter((entry) => entry.label.length === 0 || entry.description.length === 0 || entry.groupName.length === 0)).toEqual([]);
	});
});
