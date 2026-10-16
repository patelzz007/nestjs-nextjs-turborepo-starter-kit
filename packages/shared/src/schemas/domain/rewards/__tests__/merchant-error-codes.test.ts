import { describe, expect, it } from "vitest";

import { ApiErrorCodeSchema } from "../../api/api-error";
import { MerchantErrorCodeSchema, MerchantErrorCodes } from "./merchant-error-codes";

describe("MerchantErrorCodeSchema", () => {
	it("holds only well-formed API error codes", () => {
		for (const code of MerchantErrorCodeSchema.options) {
			expect(ApiErrorCodeSchema.safeParse(code).success).toBe(true);
		}
	});

	it("exposes each code by name", () => {
		expect(MerchantErrorCodes.TERMINAL_ID_TAKEN).toBe("TERMINAL_ID_TAKEN");
		expect(MerchantErrorCodeSchema.safeParse("SOMETHING_ELSE").success).toBe(false);
	});
});
