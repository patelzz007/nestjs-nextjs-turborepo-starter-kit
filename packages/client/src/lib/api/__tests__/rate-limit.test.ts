import { describe, expect, it } from "vitest";

import { ApiError } from "../api-request";
import { resolveAuthErrorMessage } from "../error-messages";

describe("rate limit errors in the shared resolver", () => {
	it("is what sign-in and every other form shows for a 429", () => {
		const error = new ApiError({ message: "Too many requests", error: "RATE_LIMITED", statusCode: 429 }, { details: { retryAfterSeconds: 90 } });

		expect(resolveAuthErrorMessage(error)).toBe("Too many requests. Try again in 2 minutes.");
	});
});
