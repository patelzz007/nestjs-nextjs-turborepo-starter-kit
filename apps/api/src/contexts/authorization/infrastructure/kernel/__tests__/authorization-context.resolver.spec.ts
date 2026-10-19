import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

import { accessToken, createHttpContext, testRequest, type TestHttpRequest } from "../../../../../../test/support/http-execution-context";
import { createTestPrisma } from "../../../../../../test/support/test-service-graph";

import { AccessDeniedError } from "../../../domain/errors/authorization.errors";
import { TenantMembershipService } from "../tenant-membership.service";
import { AuthorizationContextResolver } from "../authorization-context.resolver";

const mocks = vi.hoisted(() => ({
	verify: vi.fn(),
	organizationIdForRouteKey: vi.fn(),
}));

vi.mock("../tenant-membership.service", () => ({
	TenantMembershipService: class {
		public readonly verify = mocks.verify;
		public readonly organizationIdForRouteKey = mocks.organizationIdForRouteKey;
	},
}));

function fastifyRequest(request: TestHttpRequest): FastifyRequest {
	return createHttpContext(request).switchToHttp().getRequest<FastifyRequest>();
}

describe("AuthorizationContextResolver", () => {
	const resolver = (): AuthorizationContextResolver => new AuthorizationContextResolver(new TenantMembershipService(createTestPrisma()));
	const member = accessToken();

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.verify.mockResolvedValue({ context: {}, organizationRejected: false, storeRejected: false, locationRejected: false });
	});

	it("resolves nothing when no tenant is requested", async () => {
		const result = await resolver().resolve(fastifyRequest(testRequest()), member);

		expect(result).toEqual({ verified: {}, requested: {} });
	});

	it("verifies the header organization against the caller's membership", async () => {
		mocks.verify.mockResolvedValue({ context: { organizationId: "org-a" }, organizationRejected: false, storeRejected: false, locationRejected: false });
		const request = testRequest({ headers: { "x-organization-id": "org-a" } });

		const result = await resolver().resolve(fastifyRequest(request), member);

		expect(mocks.verify).toHaveBeenCalledWith("user-1", { organizationId: "org-a" });
		expect(result.verified).toEqual({ organizationId: "org-a" });
	});

	it("resolves an /orgs/:orgSlug route key to its organization and verifies the caller's membership", async () => {
		mocks.organizationIdForRouteKey.mockResolvedValue("org-a");
		mocks.verify.mockResolvedValue({ context: { organizationId: "org-a" }, organizationRejected: false, storeRejected: false, locationRejected: false });

		const result = await resolver().resolve(fastifyRequest(testRequest({ params: { orgSlug: "brew-bean" } })), member);

		expect(mocks.organizationIdForRouteKey).toHaveBeenCalledWith("brew-bean");
		expect(mocks.verify).toHaveBeenCalledWith("user-1", { organizationId: "org-a" });
		expect(result.verified).toEqual({ organizationId: "org-a" });
	});

	it("keeps a route-key organization the caller does not belong to unverified, without treating it as forged", async () => {
		mocks.organizationIdForRouteKey.mockResolvedValue("org-b");
		mocks.verify.mockResolvedValue({ context: {}, organizationRejected: true, storeRejected: false, locationRejected: false });

		const result = await resolver().resolve(fastifyRequest(testRequest({ params: { orgSlug: "someone-else" } })), member);

		expect(result).toEqual({ verified: {}, requested: { organizationId: "org-b" } });
	});

	it("requests no organization for a route key that names none, and prefers an explicit id over the route key", async () => {
		mocks.organizationIdForRouteKey.mockResolvedValue(null);
		expect(await resolver().resolve(fastifyRequest(testRequest({ params: { orgSlug: "gone" } })), member)).toEqual({ verified: {}, requested: {} });

		mocks.verify.mockResolvedValue({ context: { organizationId: "org-a" }, organizationRejected: false, storeRejected: false, locationRejected: false });
		await resolver().resolve(fastifyRequest(testRequest({ headers: { "x-organization-id": "org-a" }, params: { orgSlug: "other" } })), member);
		expect(mocks.organizationIdForRouteKey).toHaveBeenCalledTimes(1);
	});

	it("rejects a forged organization header with 403", async () => {
		mocks.verify.mockResolvedValue({ context: {}, organizationRejected: true, storeRejected: false, locationRejected: false });
		const request = testRequest({ headers: { "x-organization-id": "org-b" } });

		await expect(resolver().resolve(fastifyRequest(request), member)).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("rejects a forged location header with 403", async () => {
		mocks.verify.mockResolvedValue({ context: { organizationId: "org-a" }, organizationRejected: false, storeRejected: false, locationRejected: true });
		const request = testRequest({ headers: { "x-organization-id": "org-a", "x-location-id": "loc-x" } });

		await expect(resolver().resolve(fastifyRequest(request), member)).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("keeps unverified route/body ids only as requested attributes", async () => {
		mocks.verify.mockResolvedValue({ context: {}, organizationRejected: true, storeRejected: false, locationRejected: false });
		const request = testRequest({ body: { organizationId: "org-b", name: "x" } });

		const result = await resolver().resolve(fastifyRequest(request), member);

		expect(result).toEqual({ verified: {}, requested: { organizationId: "org-b" } });
	});

	it("prefers the header over params, query and body", async () => {
		const request = testRequest({
			headers: { "x-organization-id": "org-h" },
			params: { organizationId: "org-p" },
			query: { organizationId: "org-q" },
			body: { organizationId: "org-b" },
		});

		await resolver().resolve(fastifyRequest(request), member);

		expect(mocks.verify).toHaveBeenCalledWith("user-1", { organizationId: "org-h" });
	});

	it("rejects a forged store header with 403", async () => {
		mocks.verify.mockResolvedValue({ context: { organizationId: "org-a" }, organizationRejected: false, storeRejected: true, locationRejected: false });
		const request = testRequest({ headers: { "x-store-id": "store-x" } });

		await expect(resolver().resolve(fastifyRequest(request), member)).rejects.toBeInstanceOf(AccessDeniedError);
		expect(mocks.verify).toHaveBeenCalledWith("user-1", { storeId: "store-x" });
	});

	it("keeps an unverified route storeId only as a requested attribute", async () => {
		mocks.verify.mockResolvedValue({ context: { organizationId: "org-a" }, organizationRejected: false, storeRejected: true, locationRejected: false });
		const request = testRequest({ params: { storeId: "store-x" } });

		const result = await resolver().resolve(fastifyRequest(request), member);

		expect(result).toEqual({ verified: { organizationId: "org-a" }, requested: { storeId: "store-x" } });
	});

	it("lets a SuperAdmin select any tenant without a membership lookup", async () => {
		const request = testRequest({ headers: { "x-organization-id": "org-z" } });

		const result = await resolver().resolve(fastifyRequest(request), accessToken({ isSuperAdmin: true }));

		expect(result.verified).toEqual({ organizationId: "org-z" });
		expect(mocks.verify).not.toHaveBeenCalled();
	});

	it("rejects a malformed tenant header", async () => {
		const request = testRequest({ headers: { "x-organization-id": "x".repeat(200) } });

		await expect(resolver().resolve(fastifyRequest(request), member)).rejects.toBeInstanceOf(AccessDeniedError);
	});
});
