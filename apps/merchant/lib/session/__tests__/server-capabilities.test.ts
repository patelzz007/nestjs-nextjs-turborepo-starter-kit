import { MERCHANT_CAPABILITY, MerchantCapabilitySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";

describe("resolveMerchantCapabilities", () => {
	it("falls back to what the role's template gives when the membership carries no answer from the API", () => {
		expect(resolveMerchantCapabilities({ role: "OWNER" })).toEqual(MerchantCapabilitySchema.options);
		expect(resolveMerchantCapabilities({ role: "CASHIER" })).not.toContain(MERCHANT_CAPABILITY.manageTeam);
		expect(resolveMerchantCapabilities({ role: "CASHIER" })).not.toContain(MERCHANT_CAPABILITY.viewAnalytics);
	});

	it("uses the API's answer — role plus live grants — when the membership carries it", () => {
		expect(resolveMerchantCapabilities({ role: "CASHIER", capabilities: [MERCHANT_CAPABILITY.viewAnalytics] })).toEqual([MERCHANT_CAPABILITY.viewAnalytics]);
	});

	it("grants nothing without a membership (fails closed)", () => {
		expect(resolveMerchantCapabilities(undefined)).toEqual([]);
	});
});
