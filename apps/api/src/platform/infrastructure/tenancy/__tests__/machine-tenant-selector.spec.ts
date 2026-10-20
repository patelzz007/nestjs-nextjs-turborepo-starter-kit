import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest } from "../../../../../test/support/http-execution-context";
import { AppError } from "../../../application/errors/app-error";
import { rejectMachineTenantSelector } from "../machine-tenant-selector";

interface RequestParts {
	readonly params?: Record<string, string>;
	readonly query?: Record<string, string>;
	readonly body?: Record<string, string>;
	readonly headers?: Record<string, string>;
}

function request(parts: RequestParts): FastifyRequest {
	return createHttpContext(
		testRequest({ params: parts.params ?? {}, query: parts.query ?? {}, ...(parts.body === undefined ? {} : { body: parts.body }), headers: parts.headers ?? {} }),
	)
		.switchToHttp()
		.getRequest<FastifyRequest>();
}

function errorCodeOf(parts: RequestParts): string | null {
	try {
		rejectMachineTenantSelector(request(parts));
		return null;
	} catch (error: unknown) {
		return error instanceof AppError ? error.code : "unexpected";
	}
}

describe("rejectMachineTenantSelector (MACH-002)", () => {
	it.each([
		["a tenantSlug path parameter", { params: { tenantSlug: "acme" } }],
		["a tenantId path parameter", { params: { tenantId: "t-1" } }],
		["a tenantSlug query value", { query: { tenantSlug: "acme" } }],
		["a tenantId query value", { query: { tenantId: "t-1" } }],
		["a tenantSlug body field", { body: { tenantSlug: "acme" } }],
		["a tenantId body field", { body: { tenantId: "t-1" } }],
	])("rejects %s with 400 TENANT_SELECTOR_NOT_ALLOWED", (_where, parts: RequestParts) => {
		expect(errorCodeOf(parts)).toBe("TENANT_SELECTOR_NOT_ALLOWED");
	});

	it("accepts the informational x-tenant-id and x-location-id headers a POS sends on every call", () => {
		expect(errorCodeOf({ headers: { "x-tenant-id": "t-1", "x-location-id": "loc-1" } })).toBeNull();
	});

	it("accepts a request that names no tenant", () => {
		expect(errorCodeOf({ query: { limit: "10", locationId: "loc-1" }, body: { title: "x" } })).toBeNull();
	});
});
