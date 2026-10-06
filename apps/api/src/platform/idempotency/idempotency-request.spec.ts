import { describe, expect, it } from "vitest";

import type { RequestContext, RequestPrincipal } from "../../common/context/request-context";
import { AppError } from "../../common/errors/app-error";
import { IDEMPOTENCY_SCOPE_MAX_LENGTH } from "./idempotency.constants";
import { IdempotencyPrincipalRequiredError, IdempotencyUnsupportedContentTypeError } from "./idempotency.errors";
import {
	buildIdempotencyScope,
	canonicalJson,
	hashIdempotentRequest,
	parseIdempotencyKeyHeader,
	readIdempotentRequestBody,
	type IdempotentRequestFingerprint,
	type ParsedRequestBody,
} from "./idempotency-request";

describe("parseIdempotencyKeyHeader", () => {
	it("returns undefined when the header is absent", () => {
		expect(parseIdempotencyKeyHeader(undefined)).toBeUndefined();
	});

	it("accepts a UUID and trims surrounding whitespace", () => {
		expect(parseIdempotencyKeyHeader(" 3f1c2a9e-1b7d-4c55-9a55-2d3c1f9a7b10 ")).toBe("3f1c2a9e-1b7d-4c55-9a55-2d3c1f9a7b10");
	});

	it.each([
		["too short", "abc"],
		["too long", "a".repeat(129)],
		["illegal characters", "key with spaces!"],
		["empty", ""],
	])("rejects a %s key with 400 VALIDATION_ERROR", (_label: string, value: string) => {
		try {
			parseIdempotencyKeyHeader(value);
			expect.unreachable("expected a validation error");
		} catch (error) {
			expect(error).toBeInstanceOf(AppError);
			expect(error instanceof AppError ? error.code : undefined).toBe("VALIDATION_ERROR");
		}
	});

	it("rejects the header sent more than once", () => {
		expect(() => parseIdempotencyKeyHeader(["key-00000001", "key-00000002"])).toThrow(AppError);
	});
});

describe("canonicalJson", () => {
	it("sorts object keys recursively", () => {
		expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
	});

	it("serializes primitives like JSON.stringify", () => {
		expect(canonicalJson("x")).toBe('"x"');
		expect(canonicalJson(1.5)).toBe("1.5");
		expect(canonicalJson(false)).toBe("false");
		expect(canonicalJson(null)).toBe("null");
	});

	it("preserves array order", () => {
		expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
	});
});

describe("hashIdempotentRequest", () => {
	const base: IdempotentRequestFingerprint = { method: "POST", url: "/api/v1/product", body: { kind: "json", value: { name: "Mug", price: 12 } } };

	it("is stable for semantically identical payloads", () => {
		expect(hashIdempotentRequest(base)).toBe(hashIdempotentRequest({ method: "post", url: "/api/v1/product", body: { kind: "json", value: { price: 12, name: "Mug" } } }));
	});

	it("changes when the body, URL or method changes", () => {
		const hash: string = hashIdempotentRequest(base);

		expect(hashIdempotentRequest({ ...base, body: { kind: "json", value: { name: "Mug", price: 13 } } })).not.toBe(hash);
		expect(hashIdempotentRequest({ ...base, url: "/api/v1/product?dryRun=true" })).not.toBe(hash);
		expect(hashIdempotentRequest({ ...base, method: "PUT" })).not.toBe(hash);
	});

	it("distinguishes NO body from a JSON null body", () => {
		expect(hashIdempotentRequest({ ...base, body: { kind: "none" } })).not.toBe(hashIdempotentRequest({ ...base, body: { kind: "json", value: null } }));
	});

	it("is a 64-character hex digest", () => {
		expect(hashIdempotentRequest(base)).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("readIdempotentRequestBody", () => {
	it("fingerprints a JSON body and an absent body", () => {
		expect(readIdempotentRequestBody({ contentType: "application/json; charset=utf-8", body: { kind: "json", value: { a: 1 } } })).toEqual({ kind: "json", value: { a: 1 } });
		expect(readIdempotentRequestBody({ contentType: "application/merge-patch+json", body: { kind: "json", value: [] } })).toEqual({ kind: "json", value: [] });
		expect(readIdempotentRequestBody({ contentType: undefined, body: { kind: "absent" } })).toEqual({ kind: "none" });
	});

	it.each([
		["multipart upload", "multipart/form-data; boundary=x", { kind: "absent" }],
		["form post", "application/x-www-form-urlencoded", { kind: "json", value: { a: "1" } }],
		["raw bytes", "application/octet-stream", { kind: "not_json" }],
	] satisfies [string, string, ParsedRequestBody][])(
		"refuses a %s with 415 instead of fingerprinting it as 'no body'",
		(_label: string, contentType: string, body: ParsedRequestBody) => {
			expect(() => readIdempotentRequestBody({ contentType, body })).toThrow(IdempotencyUnsupportedContentTypeError);
		},
	);

	it("refuses a body that is not JSON even without a content type", () => {
		expect(() => readIdempotentRequestBody({ contentType: undefined, body: { kind: "not_json" } })).toThrow(IdempotencyUnsupportedContentTypeError);
	});
});

/** A request context as AuthGuard / AuthorizationGuard / the API-key guards leave it. */
function contextWith(overrides: Partial<RequestContext>): RequestContext {
	return {
		correlationId: "corr-1",
		traceId: "corr-1",
		ip: undefined,
		userAgent: undefined,
		edgeLocation: undefined,
		principal: undefined,
		apiKey: undefined,
		tenant: { organizationId: undefined, storeId: undefined, locationId: undefined },
		systemOperations: [],
		receivedAtEpochMs: 0,
		isAuditRecorded: false,
		...overrides,
	};
}

const USER_1: RequestPrincipal = { userId: "user-1", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" };

describe("buildIdempotencyScope", () => {
	it("namespaces keys by principal, verified tenant, method and route template", () => {
		const scope: string = buildIdempotencyScope(
			contextWith({ principal: USER_1, tenant: { organizationId: "org-a", storeId: undefined, locationId: undefined } }),
			"post",
			"/api/v1/product",
		);

		expect(scope).toBe("http:user:user-1|org:org-a:store:-:loc:-|POST /api/v1/product");
		expect(
			buildIdempotencyScope(
				contextWith({ principal: { userId: "user-2", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" } }),
				"POST",
				"/api/v1/product",
			),
		).not.toBe(buildIdempotencyScope(contextWith({ principal: USER_1 }), "POST", "/api/v1/product"));
	});

	it("never lets the same user replay one organization's response in another organization", () => {
		const orgA: string = buildIdempotencyScope(
			contextWith({ principal: USER_1, tenant: { organizationId: "org-a", storeId: undefined, locationId: undefined } }),
			"POST",
			"/x",
		);
		const orgB: string = buildIdempotencyScope(
			contextWith({ principal: USER_1, tenant: { organizationId: "org-b", storeId: undefined, locationId: undefined } }),
			"POST",
			"/x",
		);

		expect(orgA).not.toBe(orgB);
	});

	it("separates an impersonated session from the user's own session", () => {
		const own: string = buildIdempotencyScope(contextWith({ principal: USER_1 }), "POST", "/x");
		const impersonated: string = buildIdempotencyScope(
			contextWith({ principal: { userId: "user-1", impersonatorId: "admin-1", impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" } }),
			"POST",
			"/x",
		);

		expect(impersonated).not.toBe(own);
	});

	it("scopes API-key callers (POS) by key and the key's organization", () => {
		expect(buildIdempotencyScope(contextWith({ apiKey: { apiKeyId: "key-1", organizationId: "org-a", terminalId: "T-1", locationId: null } }), "POST", "/pos/checkout")).toBe(
			"http:key:key-1|org:org-a:store:-:loc:-|POST /pos/checkout",
		);
	});

	it("refuses an anonymous request (401)", () => {
		expect(() => buildIdempotencyScope(contextWith({}), "POST", "/x")).toThrow(IdempotencyPrincipalRequiredError);
		expect(() => buildIdempotencyScope(undefined, "POST", "/x")).toThrow(IdempotencyPrincipalRequiredError);
	});

	it("hashes over-long scopes to fit the column", () => {
		const scope: string = buildIdempotencyScope(contextWith({ principal: USER_1 }), "POST", `/api/v1/${"x".repeat(300)}`);

		expect(scope.length).toBeLessThanOrEqual(IDEMPOTENCY_SCOPE_MAX_LENGTH);
		expect(scope).toMatch(/^http:sha256:[0-9a-f]{64}$/);
	});
});
