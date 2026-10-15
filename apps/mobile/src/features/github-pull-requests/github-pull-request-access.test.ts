import { ApiError } from "@workspace/api-client";
import { GITHUB_PULL_REQUEST_ERROR_CODES } from "@workspace/shared";

import { needsTokenLink } from "./github-pull-request-access";

describe("needsTokenLink", () => {
	it("asks for a token when none is linked or GitHub stopped accepting it", () => {
		expect(needsTokenLink(new ApiError({ message: "Link", error: GITHUB_PULL_REQUEST_ERROR_CODES.accountNotLinked, statusCode: 409 }))).toBe(true);
		expect(needsTokenLink(new ApiError({ message: "Rejected", error: GITHUB_PULL_REQUEST_ERROR_CODES.tokenRejected, statusCode: 409 }))).toBe(true);
	});

	it("offers a retry for every other failure", () => {
		expect(needsTokenLink(new ApiError({ message: "Down", error: "SERVICE_UNAVAILABLE", statusCode: 503 }))).toBe(false);
		expect(needsTokenLink(new Error("offline"))).toBe(false);
	});
});
