import { ApiError } from "@workspace/client/lib/api/api-request";
import { BRAND_NAME } from "@workspace/tokens";
import { describe, expect, it } from "vitest";

import { formatClaimApiError } from "../claim-errors";

function apiError(code: string): ApiError {
	return new ApiError({ message: "API said no", error: code, statusCode: 409 });
}

describe("formatClaimApiError", () => {
	it.each([
		["REWARD_OUT_OF_STOCK", "This reward just sold out. Browse other offers."],
		["REWARD_EXPIRED", "This reward has expired."],
		["OTP_INVALID", "Invalid or expired OTP. Request a new code."],
		["OTP_RATE_LIMITED", "Too many OTP attempts. Request a new code and try again."],
		["OTP_REQUIRED", "Verify your phone with an OTP before claiming."],
		["CLAIM_CUSTOMER_BANNED", "This business no longer offers you its rewards."],
		["LEGAL_ACCEPTANCE_REQUIRED", `Accept the ${BRAND_NAME} terms before claiming.`],
	])("words %s for the customer", (code, message) => {
		expect(formatClaimApiError(apiError(code))).toBe(message);
	});

	it("keeps the message of any other failure", () => {
		expect(formatClaimApiError(apiError("SOMETHING_ELSE"))).toBe("API said no");
		expect(formatClaimApiError(new Error("Network down"))).toBe("Network down");
	});
});
