import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { NotFoundError } from "../../../../../application/errors/app-error";
import { Reflector } from "@nestjs/core";
import type { AccessTokenPayload, AuthorizationRequest } from "@workspace/shared";

import { accessToken, createHttpContext, testRequest, type TestHttpRequest, type TestRouteMetadata } from "../../../../../../../test/support/http-execution-context";

import {
	AuthorizationException,
	type AuthorizationKernelPort,
	type RequestTenantContext,
	type RequestTenantResolverPort,
	type SuperAdminBypassAuditPort,
} from "../../../../../../contexts/authorization/public-api";
import { REQUIRED_PERMISSION_KEY, type RequiredPermission } from "../../decorators/route-requirements.metadata";
import { self } from "../../decorators/permission-target";
import { AuthorizationGuard } from "../authorization.guard";
import { RequestContextService, type RequestTenant } from "../../../../../infrastructure/context/request-context";
import { MembershipInactiveError, TENANT_LIFECYCLE_ROUTE_KEY, TenantBannedError, TenantSuspendedError } from "../../../../../../contexts/tenancy/public-api";
import { createTestPrisma } from "../../../../../../../test/support/test-service-graph";
import type { SystemDatabaseContext } from "../../../../../../prisma/tenant-context";

const mocks = vi.hoisted(() => ({
	authorize: vi.fn<(request: AuthorizationRequest) => Promise<void>>(),
	explain: vi.fn(),
	can: vi.fn(),
	recordBypass: vi.fn(),
	resolve: vi.fn(),
	userFindUnique: vi.fn(),
}));

vi.mock("../../../../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly user = { findUnique: mocks.userFindUnique };
	},
}));

const requestContext = new RequestContextService();

/** Recording implementations of the authorization ports the guard depends on (the guard itself is real). */
const kernel: AuthorizationKernelPort = { authorize: mocks.authorize, explain: mocks.explain, can: mocks.can };
const bypassAudit: SuperAdminBypassAuditPort = { recordBypass: mocks.recordBypass };
const tenantResolver: RequestTenantResolverPort = { resolve: mocks.resolve };

function createGuard(): AuthorizationGuard {
	const prisma = createTestPrisma();
	return new AuthorizationGuard(new Reflector(), kernel, bypassAudit, tenantResolver, requestContext, {
		withSystemOperation: <TResult>(_context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> => work(prisma),
	});
}

function contextFor(
	user: AccessTokenPayload | undefined,
	metadata: TestRouteMetadata = {},
	params: Record<string, string> = {},
): { request: TestHttpRequest; context: ExecutionContext } {
	const request = testRequest({ user, params });
	return { request, context: createHttpContext(request, metadata) };
}

const noTenant: RequestTenantContext = { verified: {}, requested: {}, target: null };

describe("AuthorizationGuard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resolve.mockResolvedValue(noTenant);
		mocks.userFindUnique.mockResolvedValue({ tokenVersion: 1 });
		mocks.authorize.mockResolvedValue(undefined);
		mocks.can.mockResolvedValue("DENY");
		mocks.recordBypass.mockResolvedValue(undefined);
	});

	it("lets anonymous requests through routes without requirements", async () => {
		await expect(createGuard().canActivate(contextFor(undefined).context)).resolves.toBe(true);
		expect(mocks.resolve).not.toHaveBeenCalled();
	});

	it("rejects anonymous requests to protected routes with 401", async () => {
		const { context } = contextFor(undefined, { [REQUIRED_PERMISSION_KEY]: [{ action: "READ", resource: "USER" }] });

		await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("binds the verified tenant into the request context (for RLS) on every authenticated request", async () => {
		mocks.resolve.mockResolvedValue({
			verified: { tenantId: "org-a" },
			requested: { tenantId: "org-a", locationId: "loc-forged" },
			target: { tenantId: "org-a", lifecycleState: "ACTIVE", membershipStatus: "ACTIVE" },
		});
		const { context } = contextFor(accessToken());

		const tenant: RequestTenant | undefined = await requestContext.run(
			{ correlationId: "corr-ctx", ip: undefined, userAgent: undefined, edgeLocation: undefined },
			async () => {
				await createGuard().canActivate(context);
				return requestContext.current()?.tenant;
			},
		);

		// Only the VERIFIED ids — a requested-but-unproven location never reaches the context.
		expect(tenant).toEqual({ tenantId: "org-a", storeId: undefined, locationId: undefined });
	});

	it("rejects an active member of a suspended tenant on an ordinary route", async () => {
		mocks.resolve.mockResolvedValue({
			verified: { tenantId: "org-a" },
			requested: { tenantId: "org-a" },
			target: { tenantId: "org-a", lifecycleState: "SUSPENDED", membershipStatus: "ACTIVE" },
		});

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).rejects.toBeInstanceOf(TenantSuspendedError);
	});

	it("rejects an active member of a banned tenant on an ordinary route with TENANT_BANNED", async () => {
		mocks.resolve.mockResolvedValue({
			verified: { tenantId: "org-a" },
			requested: { tenantId: "org-a" },
			target: { tenantId: "org-a", lifecycleState: "BANNED", membershipStatus: "ACTIVE" },
		});

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).rejects.toBeInstanceOf(TenantBannedError);
	});

	it("allows an active member of a suspended tenant on a lifecycle route", async () => {
		mocks.resolve.mockResolvedValue({
			verified: { tenantId: "org-a" },
			requested: { tenantId: "org-a" },
			target: { tenantId: "org-a", lifecycleState: "SUSPENDED", membershipStatus: "ACTIVE" },
		});

		await expect(createGuard().canActivate(contextFor(accessToken(), { [TENANT_LIFECYCLE_ROUTE_KEY]: "lifecycle" }).context)).resolves.toBe(true);
	});

	it("LIFE-003: a deleted tenant is not found", async () => {
		mocks.resolve.mockResolvedValue({
			verified: { tenantId: "org-a" },
			requested: { tenantId: "org-a" },
			target: { tenantId: "org-a", lifecycleState: "DELETED", membershipStatus: "ACTIVE" },
		});

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).rejects.toBeInstanceOf(NotFoundError);
	});

	it("rejects a member of a suspended tenant reached through a location, with no :tenantSlug on the route", async () => {
		mocks.resolve.mockResolvedValue({
			verified: { tenantId: "org-a", locationId: "loc-1" },
			requested: { locationId: "loc-1" },
			target: { tenantId: "org-a", lifecycleState: "SUSPENDED", membershipStatus: "ACTIVE" },
		});

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).rejects.toBeInstanceOf(TenantSuspendedError);
	});

	it("rejects support access to a suspended tenant on an ordinary route (an approved grant is active access, not an exemption)", async () => {
		mocks.resolve.mockResolvedValue({
			verified: { tenantId: "org-a" },
			requested: { tenantId: "org-a" },
			target: { tenantId: "org-a", lifecycleState: "SUSPENDED", membershipStatus: "ACTIVE" },
		});

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).rejects.toBeInstanceOf(TenantSuspendedError);
	});

	it("leaves a caller with no access to the ordinary authorization answer, revealing nothing about the tenant's state", async () => {
		mocks.resolve.mockResolvedValue({ verified: {}, requested: { tenantId: "org-a" }, target: { tenantId: "org-a", lifecycleState: "SUSPENDED", membershipStatus: "none" } });

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).resolves.toBe(true);
	});

	it("rejects a suspended membership with MEMBERSHIP_INACTIVE", async () => {
		mocks.resolve.mockResolvedValue({
			verified: {},
			requested: { tenantId: "org-a" },
			target: { tenantId: "org-a", lifecycleState: "ACTIVE", membershipStatus: "SUSPENDED" },
		});

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).rejects.toBeInstanceOf(MembershipInactiveError);
	});

	it("lets a suspended membership call the leave-tenant route, and no other lifecycle route", async () => {
		mocks.resolve.mockResolvedValue({
			verified: {},
			requested: { tenantId: "org-a" },
			target: { tenantId: "org-a", lifecycleState: "SUSPENDED", membershipStatus: "SUSPENDED" },
		});

		await expect(createGuard().canActivate(contextFor(accessToken(), { [TENANT_LIFECYCLE_ROUTE_KEY]: "leave" }).context)).resolves.toBe(true);
		await expect(createGuard().canActivate(contextFor(accessToken(), { [TENANT_LIFECYCLE_ROUTE_KEY]: "lifecycle" }).context)).rejects.toBeInstanceOf(MembershipInactiveError);
	});

	it("audits decisions with the request context's correlation id, not a raw header", async () => {
		const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: [{ action: "READ", resource: "ORDER" }] });

		await requestContext.run({ correlationId: "corr-from-context", ip: undefined, userAgent: undefined, edgeLocation: undefined }, () => createGuard().canActivate(context));

		expect(mocks.authorize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requestId: "corr-from-context" }));
	});

	it("propagates a forged tenant header rejection", async () => {
		mocks.resolve.mockRejectedValue(new AuthorizationException());

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("enforces @RequirePermission through kernel.authorize with the verified subject and requested tenant attributes", async () => {
		mocks.resolve.mockResolvedValue({
			verified: { tenantId: "org-a" },
			requested: { tenantId: "org-a" },
			target: { tenantId: "org-a", lifecycleState: "ACTIVE", membershipStatus: "ACTIVE" },
		});
		const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: [{ action: "READ", resource: "ORDER" }] });

		await createGuard().canActivate(context);

		expect(mocks.authorize).toHaveBeenCalledWith(
			{ subject: { userId: "user-1", isSuperAdmin: false, tenantId: "org-a" }, action: "READ", resource: "ORDER", resourceAttributes: { tenantId: "org-a" } },
			expect.objectContaining({ ipAddress: "127.0.0.1", userAgent: "vitest", requestId: "corr-1" }),
		);
	});

	it("denies when the kernel denies", async () => {
		mocks.authorize.mockRejectedValue(new AuthorizationException());
		const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: [{ action: "DELETE", resource: "USER" }] });

		await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("rejects stale tokens on protected routes", async () => {
		mocks.userFindUnique.mockResolvedValue({ tokenVersion: 2 });
		const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: [{ action: "READ", resource: "USER" }] });

		await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
	});

	describe("@RequirePermission with a record target", () => {
		it("is enforced with the resource id read from the named route param", async () => {
			const requirement: RequiredPermission = { action: "UPDATE", resource: "PERMISSION", resourceId: "id" };
			const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: [requirement] }, { id: "perm-9" });

			await createGuard().canActivate(context);

			expect(mocks.authorize).toHaveBeenCalledWith(expect.objectContaining({ action: "UPDATE", resource: "PERMISSION", resourceId: "perm-9" }), expect.anything());
		});

		it("resolves self() to the caller for self-service routes", async () => {
			const requirement: RequiredPermission = { action: "UPDATE", resource: "USER", resourceId: self() };

			await createGuard().canActivate(contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: [requirement] }).context);

			expect(mocks.authorize).toHaveBeenCalledWith(expect.objectContaining({ resource: "USER", resourceId: "user-1" }), expect.anything());
		});

		it("fails closed when the declared resource id cannot be resolved", async () => {
			const requirement: RequiredPermission = { action: "DELETE", resource: "ORDER", resourceId: "id" };

			await expect(createGuard().canActivate(contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: [requirement] }).context)).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.authorize).not.toHaveBeenCalled();
		});

		it("never lets declared attributes override the routed tenant", async () => {
			mocks.resolve.mockResolvedValue({ verified: {}, requested: { tenantId: "org-a" }, target: { tenantId: "org-a", lifecycleState: "ACTIVE", membershipStatus: "none" } });
			const requirement: RequiredPermission = { action: "UPDATE", resource: "ORDER", attributes: { tenantId: "org-evil", status: "PENDING" } };

			await createGuard().canActivate(contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: [requirement] }).context);

			expect(mocks.authorize).toHaveBeenCalledWith(expect.objectContaining({ resourceAttributes: { tenantId: "org-a", status: "PENDING" } }), expect.anything());
		});
	});

	describe("stacked requirements", () => {
		const collectionAndRecord: readonly RequiredPermission[] = [
			{ action: "DELETE", resource: "USER" },
			{ action: "DELETE", resource: "USER", resourceId: "userId" },
		];

		it("checks every requirement, in the order they are written", async () => {
			await createGuard().canActivate(contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: collectionAndRecord }, { userId: "user-7" }).context);

			expect(mocks.authorize.mock.calls.map(([request]) => request.resourceId)).toEqual([undefined, "user-7"]);
		});

		it("denies when any one of them denies", async () => {
			mocks.authorize.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new AuthorizationException());

			await expect(
				createGuard().canActivate(contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: collectionAndRecord }, { userId: "user-7" }).context),
			).rejects.toBeInstanceOf(AuthorizationException);
		});
	});

	it("audits the SuperAdmin bypass on protected routes", async () => {
		const superAdmin = accessToken({ isSuperAdmin: true });
		const { context } = contextFor(superAdmin, { [REQUIRED_PERMISSION_KEY]: [{ action: "DELETE", resource: "USER" }] });

		await expect(createGuard().canActivate(context)).resolves.toBe(true);
		expect(mocks.authorize).not.toHaveBeenCalled();
		expect(mocks.recordBypass).toHaveBeenCalledWith("user-1", expect.stringContaining("Bypassed authorization for"));
		expect(superAdmin.hasAdminAccess).toBe(true);
	});

	it("computes hasAdminAccess from the kernel", async () => {
		const plain = accessToken();
		mocks.can.mockResolvedValue("ALLOW");

		await createGuard().canActivate(contextFor(plain).context);

		expect(plain.hasAdminAccess).toBe(true);
		expect(mocks.can).toHaveBeenCalledWith(expect.objectContaining({ action: "READ", resource: "ADMIN_DASHBOARD" }));
	});
});
