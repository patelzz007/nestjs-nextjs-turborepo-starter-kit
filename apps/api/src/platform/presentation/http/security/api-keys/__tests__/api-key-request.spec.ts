import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest, type TestHttpRequest } from "../../../../../../../test/support/http-execution-context";
import { extractApiKeyFromRequest, getTillPointFromRequest, isJwtShapedToken, requestHeader, setTillPointOnRequest, TillPointMissingError } from "../api-key-request";

/** A test request as the HTTP layer hands it to guards and helpers. */
function request(overrides: Partial<TestHttpRequest> = {}): FastifyRequest {
	return createHttpContext(testRequest(overrides)).switchToHttp().getRequest<FastifyRequest>();
}

describe("extractApiKeyFromRequest", () => {
	it("reads a bearer token first, then X-API-Key", () => {
		expect(extractApiKeyFromRequest(request({ headers: { authorization: "Bearer mk_live_a", "x-api-key": "mk_live_b" } }))).toBe("mk_live_a");
		expect(extractApiKeyFromRequest(request({ headers: { "x-api-key": "mk_live_b" } }))).toBe("mk_live_b");
	});

	it("finds nothing in an empty bearer, another scheme or an empty header", () => {
		expect(extractApiKeyFromRequest(request({ headers: { authorization: "Bearer " } }))).toBeUndefined();
		expect(extractApiKeyFromRequest(request({ headers: { authorization: "Basic abc" } }))).toBeUndefined();
		expect(extractApiKeyFromRequest(request({ headers: { "x-api-key": "" } }))).toBeUndefined();
	});
});

describe("isJwtShapedToken", () => {
	it("tells a three-segment JWT from an API key", () => {
		expect(isJwtShapedToken("a.b.c")).toBe(true);
		expect(isJwtShapedToken("mk_live_abc")).toBe(false);
		expect(isJwtShapedToken("a.b")).toBe(false);
	});
});

describe("till point and headers", () => {
	it("hands back the till the guard attached, and fails loudly where no guard ran", () => {
		const tillRequest = request();
		expect(() => getTillPointFromRequest(tillRequest)).toThrow(TillPointMissingError);

		setTillPointOnRequest(tillRequest, { organizationId: "org-1", locationId: null, terminalId: "TERM-AAAA2222", apiKeyId: "key-1" });
		expect(getTillPointFromRequest(tillRequest)).toEqual({ organizationId: "org-1", locationId: null, terminalId: "TERM-AAAA2222", apiKeyId: "key-1" });
	});

	it("reads a header's first value", () => {
		expect(requestHeader(request({ headers: { "x-terminal-id": "TERM-AAAA2222" } }), "x-terminal-id")).toBe("TERM-AAAA2222");
		expect(requestHeader(request({ headers: {} }), "x-terminal-id")).toBeUndefined();
	});
});
