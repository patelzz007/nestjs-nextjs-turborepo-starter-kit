import { describe, expect, it } from "vitest";

import type { RequestLogEntry } from "@workspace/shared";

import { buildRequestSnippet, buildRequestUrl } from "@/lib/telescope";

const SAMPLE_REQUEST: RequestLogEntry = {
	id: "req-1",
	method: "GET",
	path: "/api/v1/auth/me",
	queryString: null,
	statusCode: 200,
	userId: "user-1",
	userEmail: "user@example.com",
	durationMs: 138,
	createdAt: 1_755_784_860_000,
	environment: null,
	starred: false,
	n1WarningCount: 0,
	correlationId: "corr-1",
	ip: "127.0.0.1",
	userAgent: "Mozilla/5.0",
	requestBody: null,
	responseBody: null,
	requestHeaders: { "content-type": "application/json", authorization: "Bearer stale-token" },
	spans: [],
	logs: [],
	handlerParams: null,
	cacheOps: [],
	piiFlags: [],
};

describe("buildRequestUrl", () => {
	it("joins the API base URL with the captured path", () => {
		expect(buildRequestUrl(SAMPLE_REQUEST, "http://localhost:8080")).toBe("http://localhost:8080/api/v1/auth/me");
	});

	it("appends the query string when present", () => {
		const withQuery: RequestLogEntry = { ...SAMPLE_REQUEST, queryString: "foo=bar" };
		expect(buildRequestUrl(withQuery, "http://localhost:8080")).toBe("http://localhost:8080/api/v1/auth/me?foo=bar");
	});
});

describe("buildRequestSnippet", () => {
	it("builds cURL with the absolute URL and a fresh Bearer token", () => {
		const curl = buildRequestSnippet(SAMPLE_REQUEST, "curl", {
			apiBaseUrl: "http://localhost:8080",
			accessToken: "live-access-token",
		});
		expect(curl).toContain("curl -X GET 'http://localhost:8080/api/v1/auth/me'");
		expect(curl).toContain("Authorization: Bearer live-access-token");
		expect(curl).not.toContain("stale-token");
		expect(curl).toContain("content-type: application/json");
	});
});
