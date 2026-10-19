import { MERCHANT_CAPABILITY, MERCHANT_ROLE_CAPABILITIES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";

describe("resolveMerchantCapabilities", () => {
	it("grants the capabilities of the membership's role — the table the API enforces", () => {
		expect(resolveMerchantCapabilities({ role: "OWNER" })).toEqual(MERCHANT_ROLE_CAPABILITIES.OWNER);
		expect(resolveMerchantCapabilities({ role: "CASHIER" })).not.toContain(MERCHANT_CAPABILITY.manageTeam);
	});

	it("grants nothing without a membership (fails closed)", () => {
		expect(resolveMerchantCapabilities(undefined)).toEqual([]);
	});
});
