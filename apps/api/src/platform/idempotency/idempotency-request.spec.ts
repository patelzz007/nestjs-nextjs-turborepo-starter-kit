import { describe, expect, it } from "vitest";

import { AppError } from "../../common/errors/app-error";
import { IDEMPOTENCY_SCOPE_MAX_LENGTH } from "./idempotency.constants";
import { buildIdempotencyScope, canonicalJson, hashIdempotentRequest, parseIdempotencyKeyHeader } from "./idempotency-request";

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
	const base = { method: "POST", url: "/api/v1/product", body: { name: "Mug", price: 12 } };

	it("is stable for semantically identical payloads", () => {
		expect(hashIdempotentRequest(base)).toBe(hashIdempotentRequest({ method: "post", url: "/api/v1/product", body: { price: 12, name: "Mug" } }));
	});

	it("changes when the body, URL or method changes", () => {
		const hash: string = hashIdempotentRequest(base);

		expect(hashIdempotentRequest({ ...base, body: { name: "Mug", price: 13 } })).not.toBe(hash);
		expect(hashIdempotentRequest({ ...base, url: "/api/v1/product?dryRun=true" })).not.toBe(hash);
		expect(hashIdempotentRequest({ ...base, method: "PUT" })).not.toBe(hash);
	});

	it("is a 64-character hex digest", () => {
		expect(hashIdempotentRequest(base)).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("buildIdempotencyScope", () => {
	it("namespaces keys by principal, method and route template", () => {
		expect(buildIdempotencyScope("user-1", "post", "/api/v1/product")).toBe("http:user-1:POST /api/v1/product");
		expect(buildIdempotencyScope("user-2", "POST", "/api/v1/product")).not.toBe(buildIdempotencyScope("user-1", "POST", "/api/v1/product"));
	});

	it("hashes over-long scopes to fit the column", () => {
		const scope: string = buildIdempotencyScope("user-1", "POST", `/api/v1/${"x".repeat(300)}`);

		expect(scope.length).toBeLessThanOrEqual(IDEMPOTENCY_SCOPE_MAX_LENGTH);
		expect(scope.startsWith("http:user-1:sha256:")).toBe(true);
	});
});
