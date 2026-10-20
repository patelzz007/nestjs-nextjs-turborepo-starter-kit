import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { isMerchantInvitingOffered } from "@/lib/server/merchant-invite-availability";

const META = { correlationId: "corr-1", timestamp: epochMs(1_790_812_800_000) };

describe("isMerchantInvitingOffered", () => {
	it("follows the API's answer", () => {
		expect(isMerchantInvitingOffered({ status: "ok", data: { success: true, data: { available: true }, meta: META } })).toBe(true);
		expect(isMerchantInvitingOffered({ status: "ok", data: { success: true, data: { available: false }, meta: META } })).toBe(false);
	});

	it("keeps the page when the API did not answer: the menu's permission rule and the API itself still decide", () => {
		expect(isMerchantInvitingOffered({ status: "forbidden" })).toBe(true);
		expect(isMerchantInvitingOffered({ status: "unauthenticated" })).toBe(true);
	});
});
