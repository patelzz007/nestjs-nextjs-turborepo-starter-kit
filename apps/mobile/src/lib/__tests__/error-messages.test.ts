import { ApiError, SessionRefreshUnavailableError } from "@workspace/api-client";

import { errorMessageOf, GENERIC_ERROR_MESSAGE, OFFLINE_ERROR_MESSAGE } from "../error-messages";

describe("errorMessageOf", () => {
	it("maps the API's auth codes to friendly copy", () => {
		expect(errorMessageOf(new ApiError({ message: "Invalid credentials", error: "INVALID_CREDENTIALS", statusCode: 401 }))).toBe(
			"Incorrect email or password. Please try again.",
		);
		expect(errorMessageOf(new ApiError({ message: "x", error: "SESSION_REVOKED", statusCode: 401 }))).toBe("This device was signed out. Please sign in again.");
	});

	it("says how long to wait after a 429, from the API's retryAfterSeconds (ADR 071)", () => {
		expect(errorMessageOf(new ApiError({ message: "Too many attempts", error: "RATE_LIMITED", statusCode: 429 }, { details: { retryAfterSeconds: 30 } }))).toBe(
			"Too many requests. Try again in 30 seconds.",
		);
		expect(errorMessageOf(new ApiError({ message: "", statusCode: 429 }))).toBe("Too many requests. Try again in a moment.");
	});

	it("shows the API's own message for other errors", () => {
		expect(errorMessageOf(new ApiError({ message: "Code expired", error: "BAD_REQUEST", statusCode: 400 }))).toBe("Code expired");
	});

	it("falls back when the API sent no message", () => {
		expect(errorMessageOf(new ApiError({ message: "", statusCode: 500 }))).toBe(GENERIC_ERROR_MESSAGE);
	});

	it("explains network failures", () => {
		expect(errorMessageOf(new TypeError("Network request failed"))).toBe(OFFLINE_ERROR_MESSAGE);
		expect(errorMessageOf(new SessionRefreshUnavailableError())).toBe(OFFLINE_ERROR_MESSAGE);
	});

	it("is generic for anything else", () => {
		expect(errorMessageOf(new Error("internal detail"))).toBe(GENERIC_ERROR_MESSAGE);
		expect(errorMessageOf(null)).toBe(GENERIC_ERROR_MESSAGE);
	});
});
