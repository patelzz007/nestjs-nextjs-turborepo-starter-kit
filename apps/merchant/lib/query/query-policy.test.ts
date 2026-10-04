import { ApiError } from "@workspace/client/lib/api/use-api";
import { describe, expect, it } from "vitest";

import { isTransientQueryFailure, MAX_TRANSIENT_RETRIES, retryTransientFailures, userSafeErrorMessage } from "@/lib/query/query-policy";

function apiError(statusCode: number, message = "Nope"): ApiError {
	return new ApiError({ message, statusCode });
}

describe("retryTransientFailures", () => {
	it("retries network failures and 5xx, at most once", () => {
		expect(isTransientQueryFailure(new TypeError("Failed to fetch"))).toBe(true);
		expect(isTransientQueryFailure(apiError(503))).toBe(true);
		expect(retryTransientFailures(0, apiError(503))).toBe(true);
		expect(retryTransientFailures(MAX_TRANSIENT_RETRIES, apiError(503))).toBe(false);
	});

	it("never retries a 4xx — a 429 rate limit least of all", () => {
		expect(retryTransientFailures(0, apiError(429))).toBe(false);
		expect(retryTransientFailures(0, apiError(403))).toBe(false);
		expect(retryTransientFailures(0, apiError(404))).toBe(false);
	});
});

describe("userSafeErrorMessage", () => {
	it("shows the API's answer for a client error", () => {
		expect(userSafeErrorMessage(apiError(409, "This reward was changed by someone else."), "fallback")).toBe("This reward was changed by someone else.");
	});

	it("hides transport and server error text behind the fallback", () => {
		expect(userSafeErrorMessage(new TypeError("fetch failed: getaddrinfo ENOTFOUND api.internal"), "fallback")).toBe("fallback");
		expect(userSafeErrorMessage(apiError(500, "PrismaClientKnownRequestError at db-01"), "fallback")).toBe("fallback");
	});
});
