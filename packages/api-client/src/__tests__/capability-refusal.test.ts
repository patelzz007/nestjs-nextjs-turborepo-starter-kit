import { describe, expect, it } from "vitest";

import { isCapabilityRefusal } from "../capability-refusal";
import { ApiError } from "../errors";

function apiError(statusCode: number, error: string): ApiError {
	return new ApiError({ message: "refused", error, statusCode });
}

describe("isCapabilityRefusal", () => {
	it("recognises the platform and merchant capability refusals", () => {
		expect(isCapabilityRefusal(apiError(403, "PERMISSION_DENIED"))).toBe(true);
		expect(isCapabilityRefusal(apiError(403, "TENANT_ROLE_CAPABILITY_REQUIRED"))).toBe(true);
	});

	it("leaves every other error alone: another 403, the code on another status, a plain error", () => {
		expect(isCapabilityRefusal(apiError(403, "TENANT_LOCATION_FORBIDDEN"))).toBe(false);
		expect(isCapabilityRefusal(apiError(401, "PERMISSION_DENIED"))).toBe(false);
		expect(isCapabilityRefusal(new Error("network"))).toBe(false);
	});
});
