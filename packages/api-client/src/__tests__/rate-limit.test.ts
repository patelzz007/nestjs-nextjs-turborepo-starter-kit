import { describe, expect, it } from "vitest";

import { ApiError } from "../errors";
import { describeWait, isRateLimitError, rateLimitMessage, rateLimitRetryAfterSeconds } from "../rate-limit";

function tooFast(details?: { readonly retryAfterSeconds: number }): ApiError {
	return new ApiError({ message: "Too many requests", error: "RATE_LIMITED", statusCode: 429 }, details === undefined ? {} : { details });
}

describe("rate limit errors", () => {
	it("recognises a 429 and reads how long to wait", () => {
		expect(isRateLimitError(tooFast())).toBe(true);
		expect(rateLimitRetryAfterSeconds(tooFast({ retryAfterSeconds: 30 }))).toBe(30);
		expect(rateLimitRetryAfterSeconds(tooFast())).toBeNull();
	});

	it("ignores any other failure", () => {
		const notFound = new ApiError({ message: "Not found", error: "NOT_FOUND", statusCode: 404 });
		expect(isRateLimitError(notFound)).toBe(false);
		expect(rateLimitMessage(notFound)).toBeNull();
		expect(rateLimitMessage(new Error("offline"))).toBeNull();
	});

	it("names the wait, else keeps the API's own message, else says a moment", () => {
		expect(rateLimitMessage(tooFast({ retryAfterSeconds: 45 }))).toBe("Too many requests. Try again in 45 seconds.");
		expect(rateLimitMessage(tooFast())).toBe("Too many requests");
		expect(rateLimitMessage(new ApiError({ message: "", error: "RATE_LIMITED", statusCode: 429 }))).toBe("Too many requests. Try again in a moment.");
	});

	it("says the wait in words", () => {
		expect(describeWait(null)).toBe("a moment");
		expect(describeWait(1)).toBe("1 second");
		expect(describeWait(45)).toBe("45 seconds");
		expect(describeWait(60)).toBe("1 minute");
		expect(describeWait(125)).toBe("3 minutes");
	});
});
