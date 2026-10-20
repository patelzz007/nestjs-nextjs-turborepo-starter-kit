import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

import { ValidationError } from "../../../../../platform/application/errors/app-error";
import type { TenantResolution, TenantSource } from "../../../../../platform/application/tenancy/tenant-source.port";
import { setApiKeyAuthOnRequest } from "../../../../../platform/presentation/http/security/api-keys/api-key-request";
import { accessToken, createHttpContext, testRequest, type TestHttpRequest } from "../../../../../../test/support/http-execution-context";
import { createTestPrisma } from "../../../../../../test/support/test-service-graph";
import type { Prisma } from "@prisma/client";
import type { SystemDatabaseContext } from "../../../../../prisma/tenant-context";

import { AccessDeniedError } from "../../../domain/errors/authorization.errors";
import { TenantMembershipService, type TargetTenant } from "../tenant-membership.service";
import { AuthorizationContextResolver } from "../authorization-context.resolver";

const mocks = vi.hoisted(() => ({
	verify: vi.fn(),
	resolve: vi.fn<(request: { readonly tenantSlug?: string }) => Promise<TenantResolution>>(),
}));

vi.mock("../tenant-membership.service", () => ({
	TenantMembershipService: class {
		public readonly verify = mocks.verify;
	},
}));

const source: TenantSource = { resolve: (request) => mocks.resolve(request) };

function fastifyRequest(request: TestHttpRequest): FastifyRequest {
	return createHttpContext(request).switchToHttp().getRequest<FastifyRequest>();
}

describe("AuthorizationContextResolver", () => {
	const resolver = (): AuthorizationContextResolver =>
		new AuthorizationContextResolver(
			new TenantMembershipService({
				withSystemOperation: <TResult>(_context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> =>
					work(createTestPrisma()),
			}),
			source,
		);
	const member = accessToken();

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.verify.mockResolvedValue({ context: {}, tenantRejected: false, storeRejected: false, locationRejected: false, target: null });
		mocks.resolve.mockImplementation((request) =>
			Promise.resolve(request.tenantSlug === undefined ? { kind: "none" } : { kind: "tenant", tenantId: "org-a", lifecycleState: "ACTIVE" }),
		);
	});

	it("resolves nothing when the tenant source returns none", async () => {
		const result = await resolver().resolve(fastifyRequest(testRequest()), member);

		expect(result).toEqual({ verified: {}, requested: {}, target: null });
		expect(mocks.verify).toHaveBeenCalledWith("user-1", {});
	});

	it("verifies the tenant the source resolved from the route slug", async () => {
		mocks.verify.mockResolvedValue({ context: { tenantId: "org-a" }, tenantRejected: false, storeRejected: false, locationRejected: false, target: null });

		const result = await resolver().resolve(fastifyRequest(testRequest({ params: { tenantSlug: "brew-bean" } })), member);

		expect(mocks.resolve).toHaveBeenCalledWith({ tenantSlug: "brew-bean" });
		expect(mocks.verify).toHaveBeenCalledWith("user-1", { tenantId: "org-a" });
		expect(result.verified).toEqual({ tenantId: "org-a" });
	});

	it("ignores x-tenant-id, params.tenantId, query.tenantId and body.tenantId", async () => {
		mocks.verify.mockResolvedValue({ context: { tenantId: "org-a" }, tenantRejected: false, storeRejected: false, locationRejected: false, target: null });
		const request = testRequest({
			headers: { "x-tenant-id": "org-h" },
			params: { tenantSlug: "brew-bean", tenantId: "org-p", orgId: "org-o" },
			query: { tenantId: "org-q" },
			body: { tenantId: "org-b" },
		});

		const result = await resolver().resolve(fastifyRequest(request), member);

		expect(mocks.resolve).toHaveBeenCalledWith({ tenantSlug: "brew-bean" });
		expect(mocks.verify).toHaveBeenCalledWith("user-1", { tenantId: "org-a" });
		expect(result.verified).toEqual({ tenantId: "org-a" });
	});

	it("rejects a forged store header with 403", async () => {
		mocks.verify.mockResolvedValue({ context: { tenantId: "org-a" }, tenantRejected: false, storeRejected: true, locationRejected: false, target: null });
		const request = testRequest({ headers: { "x-store-id": "store-x" } });

		await expect(resolver().resolve(fastifyRequest(request), member)).rejects.toBeInstanceOf(AccessDeniedError);
		expect(mocks.verify).toHaveBeenCalledWith("user-1", { storeId: "store-x" });
	});

	it("reads nothing from x-location-id: the merchant console sends it as information, so it neither selects nor narrows a location", async () => {
		mocks.resolve.mockResolvedValue({ kind: "tenant", tenantId: "org-a", lifecycleState: "ACTIVE" });
		mocks.verify.mockResolvedValue({ context: { tenantId: "org-a" }, tenantRejected: false, storeRejected: false, locationRejected: false, target: null });
		const request = testRequest({ params: { tenantSlug: "brew-bean" }, headers: { "x-tenant-id": "org-h", "x-location-id": "loc-x" } });

		const result = await resolver().resolve(fastifyRequest(request), member);

		expect(mocks.verify).toHaveBeenCalledWith("user-1", { tenantId: "org-a" });
		expect(result.requested).toEqual({ tenantId: "org-a" });
	});

	it("still takes a location from the query, whatever x-location-id says", async () => {
		mocks.resolve.mockResolvedValue({ kind: "tenant", tenantId: "org-a", lifecycleState: "ACTIVE" });
		mocks.verify.mockResolvedValue({
			context: { tenantId: "org-a", locationId: "loc-q" },
			tenantRejected: false,
			storeRejected: false,
			locationRejected: false,
			target: null,
		});
		const request = testRequest({ params: { tenantSlug: "brew-bean" }, query: { locationId: "loc-q" }, headers: { "x-location-id": "loc-x" } });

		await resolver().resolve(fastifyRequest(request), member);

		expect(mocks.verify).toHaveBeenCalledWith("user-1", { tenantId: "org-a", locationId: "loc-q" });
	});

	it("keeps an unverified route storeId only as a requested attribute", async () => {
		mocks.resolve.mockResolvedValue({ kind: "tenant", tenantId: "org-a", lifecycleState: "ACTIVE" });
		const target: TargetTenant = { tenantId: "org-a", lifecycleState: "ACTIVE", membershipStatus: "ACTIVE" };
		mocks.verify.mockResolvedValue({ context: { tenantId: "org-a" }, tenantRejected: false, storeRejected: true, locationRejected: false, target });
		const request = testRequest({ params: { tenantSlug: "brew-bean", storeId: "store-x" } });

		const result = await resolver().resolve(fastifyRequest(request), member);

		expect(result).toEqual({ verified: { tenantId: "org-a" }, requested: { tenantId: "org-a", storeId: "store-x" }, target });
	});

	it("passes on the target the verification found through a store, so its lifecycle is enforced without a :tenantSlug", async () => {
		const target: TargetTenant = { tenantId: "org-a", lifecycleState: "SUSPENDED", membershipStatus: "ACTIVE" };
		mocks.verify.mockResolvedValue({ context: { tenantId: "org-a", storeId: "store-1" }, tenantRejected: false, storeRejected: false, locationRejected: false, target });

		const result = await resolver().resolve(fastifyRequest(testRequest({ headers: { "x-store-id": "019b76da-a800-7000-8000-000000000001" } })), member);

		expect(result.target).toEqual(target);
	});

	it("PLAT-002: verifies a SuperAdmin like any user, so no membership and no grant binds no tenant", async () => {
		mocks.verify.mockResolvedValue({ context: {}, tenantRejected: true, storeRejected: false, locationRejected: false, target: null });

		const result = await resolver().resolve(
			fastifyRequest(testRequest({ params: { tenantSlug: "brew-bean" }, headers: { "x-tenant-id": "org-z" } })),
			accessToken({ isSuperAdmin: true }),
		);

		expect(result.verified).toEqual({});
		expect(mocks.verify).toHaveBeenCalledWith("user-1", { tenantId: "org-a" });
	});

	it("PLAT-003: binds the tenant for a SuperAdmin whose approved support grant the verification found", async () => {
		mocks.verify.mockResolvedValue({
			context: { tenantId: "org-a" },
			tenantRejected: false,
			storeRejected: false,
			locationRejected: false,
			target: { tenantId: "org-a", lifecycleState: "ACTIVE", membershipStatus: "ACTIVE" },
			supportAccessGrantId: "grant-1",
		});

		const result = await resolver().resolve(fastifyRequest(testRequest({ params: { tenantSlug: "brew-bean" } })), accessToken({ isSuperAdmin: true }));

		expect(result.verified).toEqual({ tenantId: "org-a" });
	});

	it("MACH-002: rejects a machine request that also names a tenant", async () => {
		const request = fastifyRequest(testRequest({ params: { tenantSlug: "brew-bean" } }));
		setApiKeyAuthOnRequest(request, {
			provider: "merchant",
			apiKeyId: "key-1",
			tenantId: "org-1",
			locationId: null,
			terminal: null,
			requireRegisteredTerminals: false,
			scope: "POS",
			capabilities: [],
		});

		await expect(resolver().resolve(request, member)).rejects.toMatchObject({ code: "TENANT_SELECTOR_NOT_ALLOWED" });
		expect(mocks.resolve).not.toHaveBeenCalled();
	});
});

describe("rejectMachineTenantSelector", () => {
	it("MACH-002: is a 400", async () => {
		const request = fastifyRequest(testRequest({ body: { tenantId: "org-b" } }));
		setApiKeyAuthOnRequest(request, {
			provider: "merchant",
			apiKeyId: "key-1",
			tenantId: "org-1",
			locationId: null,
			terminal: null,
			requireRegisteredTerminals: false,
			scope: "POS",
			capabilities: [],
		});

		await expect(
			new AuthorizationContextResolver(
				new TenantMembershipService({
					withSystemOperation: <TResult>(_context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> =>
						work(createTestPrisma()),
				}),
				source,
			).resolve(request, accessToken()),
		).rejects.toBeInstanceOf(ValidationError);
	});
});
