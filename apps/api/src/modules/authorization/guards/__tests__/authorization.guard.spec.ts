import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AccessTokenPayload, AuthorizationRequest, AuthorizationResult } from "@workspace/shared";

import { accessToken, createHttpContext, testRequest, type TestHttpRequest, type TestRouteMetadata } from "../../../../../test/support/http-execution-context";

import { AuthorizationAuditService } from "../../audit/authorization-audit.service";
import { REQUIRED_PERMISSION_KEY, REQUIRED_PERMISSIONS_KEY, REQUIRED_ROLES_KEY } from "../../constants/authorization.constants";
import { AUTHORIZE_KEY, self, type AuthorizationRequirement } from "../../decorators/authorize.decorator";
import { AuthorizationException } from "../../exceptions/authorization.exception";
import { AuthorizationAuditKernelService } from "../../kernel/authorization-audit-kernel.service";
import { TenantMembershipService } from "../../kernel/tenant-membership.service";
import { AuthorizationContextResolver, type RequestTenantContext } from "../../services/authorization-context.resolver";
import { AuthorizationGuard } from "../authorization.guard";
import { createTestAuthorizationKernel, createTestPrisma, createTestSystemPrisma } from "../../../../../test/support/test-service-graph";
import { RequestContextService, type RequestTenant } from "../../../../common/context/request-context";

const mocks = vi.hoisted(() => ({
	authorize: vi.fn(),
	explain: vi.fn(),
	can: vi.fn(),
	hasRoles: vi.fn(),
	auditResult: vi.fn(),
	auditLog: vi.fn(),
	resolve: vi.fn(),
	userFindUnique: vi.fn(),
}));

vi.mock("../../kernel/authorization-kernel.service", () => ({
	AuthorizationKernelService: class {
		public readonly authorize = mocks.authorize;
		public readonly explain = mocks.explain;
		public readonly can = mocks.can;
		public readonly hasRoles = mocks.hasRoles;
	},
}));

vi.mock("../../kernel/authorization-audit-kernel.service", () => ({
	AuthorizationAuditKernelService: class {
		public readonly auditResult = mocks.auditResult;
	},
}));

vi.mock("../../audit/authorization-audit.service", () => ({
	AuthorizationAuditService: class {
		public readonly log = mocks.auditLog;
	},
}));

vi.mock("../../services/authorization-context.resolver", () => ({
	AuthorizationContextResolver: class {
		public readonly resolve = mocks.resolve;
	},
}));

vi.mock("../../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly user = { findUnique: mocks.userFindUnique };
	},
}));

const requestContext = new RequestContextService();

function createGuard(): AuthorizationGuard {
	const prisma = createTestPrisma();
	return new AuthorizationGuard(
		new Reflector(),
		createTestAuthorizationKernel(prisma),
		new AuthorizationAuditKernelService(createTestSystemPrisma()),
		new AuthorizationAuditService(prisma),
		new AuthorizationContextResolver(new TenantMembershipService(prisma)),
		prisma,
		requestContext,
	);
}

function contextFor(
	user: AccessTokenPayload | undefined,
	metadata: TestRouteMetadata = {},
	params: Record<string, string> = {},
): { request: TestHttpRequest; context: ExecutionContext } {
	const request = testRequest({ user, params });
	return { request, context: createHttpContext(request, metadata) };
}

const noTenant: RequestTenantContext = { verified: {}, requested: {} };

function result(decision: "ALLOW" | "DENY", request: AuthorizationRequest): AuthorizationResult {
	return { decision, request, evaluation: [] };
}

describe("AuthorizationGuard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resolve.mockResolvedValue(noTenant);
		mocks.userFindUnique.mockResolvedValue({ tokenVersion: 1 });
		mocks.authorize.mockResolvedValue(undefined);
		mocks.can.mockResolvedValue("DENY");
		mocks.auditResult.mockResolvedValue(undefined);
		mocks.auditLog.mockResolvedValue(undefined);
	});

	it("lets anonymous requests through routes without requirements", async () => {
		await expect(createGuard().canActivate(contextFor(undefined).context)).resolves.toBe(true);
		expect(mocks.resolve).not.toHaveBeenCalled();
	});

	it("rejects anonymous requests to protected routes with 401", async () => {
		const { context } = contextFor(undefined, { [REQUIRED_PERMISSION_KEY]: { action: "READ", resource: "USER" } });

		await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("binds the verified tenant into the request context (for RLS) on every authenticated request", async () => {
		mocks.resolve.mockResolvedValue({ verified: { organizationId: "org-a" }, requested: { organizationId: "org-a", locationId: "loc-forged" } });
		const { context } = contextFor(accessToken());

		const tenant: RequestTenant | undefined = await requestContext.run({ correlationId: "corr-ctx", ip: undefined, userAgent: undefined }, async () => {
			await createGuard().canActivate(context);
			return requestContext.current()?.tenant;
		});

		// Only the VERIFIED ids — a requested-but-unproven location never reaches the context.
		expect(tenant).toEqual({ organizationId: "org-a", storeId: undefined, locationId: undefined });
	});

	it("audits decisions with the request context's correlation id, not a raw header", async () => {
		const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: { action: "READ", resource: "ORDER" } });

		await requestContext.run({ correlationId: "corr-from-context", ip: undefined, userAgent: undefined }, () => createGuard().canActivate(context));

		expect(mocks.authorize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requestId: "corr-from-context" }));
	});

	it("propagates a forged tenant header rejection", async () => {
		mocks.resolve.mockRejectedValue(new AuthorizationException());

		await expect(createGuard().canActivate(contextFor(accessToken()).context)).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("enforces @RequirePermission through kernel.authorize with the verified subject and requested tenant attributes", async () => {
		mocks.resolve.mockResolvedValue({ verified: { organizationId: "org-a" }, requested: { organizationId: "org-a" } });
		const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: { action: "READ", resource: "ORDER" } });

		await createGuard().canActivate(context);

		expect(mocks.authorize).toHaveBeenCalledWith(
			{ subject: { userId: "user-1", isSuperAdmin: false, organizationId: "org-a" }, action: "READ", resource: "ORDER", resourceAttributes: { organizationId: "org-a" } },
			expect.objectContaining({ ipAddress: "127.0.0.1", userAgent: "vitest", requestId: "corr-1" }),
		);
	});

	it("denies when the kernel denies", async () => {
		mocks.authorize.mockRejectedValue(new AuthorizationException());
		const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: { action: "DELETE", resource: "USER" } });

		await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("rejects stale tokens on protected routes", async () => {
		mocks.userFindUnique.mockResolvedValue({ tokenVersion: 2 });
		const { context } = contextFor(accessToken(), { [REQUIRED_PERMISSION_KEY]: { action: "READ", resource: "USER" } });

		await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
	});

	describe("@Authorize", () => {
		it("is enforced with the resource id read from the named route param", async () => {
			const requirement: AuthorizationRequirement = { action: "UPDATE", resource: "PERMISSION", resourceId: "id" };
			const { context } = contextFor(accessToken(), { [AUTHORIZE_KEY]: requirement }, { id: "perm-9" });

			await createGuard().canActivate(context);

			expect(mocks.authorize).toHaveBeenCalledWith(expect.objectContaining({ action: "UPDATE", resource: "PERMISSION", resourceId: "perm-9" }), expect.anything());
		});

		it("resolves self() to the caller for self-service routes", async () => {
			const requirement: AuthorizationRequirement = { action: "UPDATE", resource: "USER", resourceId: self() };

			await createGuard().canActivate(contextFor(accessToken(), { [AUTHORIZE_KEY]: requirement }).context);

			expect(mocks.authorize).toHaveBeenCalledWith(expect.objectContaining({ resource: "USER", resourceId: "user-1" }), expect.anything());
		});

		it("fails closed when the declared resource id cannot be resolved", async () => {
			const requirement: AuthorizationRequirement = { action: "DELETE", resource: "ORDER", resourceId: "id" };

			await expect(createGuard().canActivate(contextFor(accessToken(), { [AUTHORIZE_KEY]: requirement }).context)).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.authorize).not.toHaveBeenCalled();
		});

		it("never lets declared attributes override the routed tenant", async () => {
			mocks.resolve.mockResolvedValue({ verified: {}, requested: { organizationId: "org-a" } });
			const requirement: AuthorizationRequirement = { action: "UPDATE", resource: "ORDER", attributes: { organizationId: "org-evil", status: "PENDING" } };

			await createGuard().canActivate(contextFor(accessToken(), { [AUTHORIZE_KEY]: requirement }).context);

			expect(mocks.authorize).toHaveBeenCalledWith(expect.objectContaining({ resourceAttributes: { organizationId: "org-a", status: "PENDING" } }), expect.anything());
		});
	});

	describe("multi-permission and role requirements", () => {
		const anyOf = {
			[REQUIRED_PERMISSIONS_KEY]: {
				mode: "any",
				permissions: [
					["UPDATE", "ROLE"],
					["UPDATE", "PERMISSION"],
				],
			},
		};

		it("ANY mode allows when one permission is allowed and audits it", async () => {
			mocks.explain.mockImplementation((request: AuthorizationRequest) => Promise.resolve(result(request.resource === "PERMISSION" ? "ALLOW" : "DENY", request)));

			await expect(createGuard().canActivate(contextFor(accessToken(), anyOf).context)).resolves.toBe(true);
			expect(mocks.auditResult).toHaveBeenCalledWith(expect.objectContaining({ decision: "ALLOW" }), expect.anything());
		});

		it("ANY mode denies and audits every denial when nothing is allowed", async () => {
			mocks.explain.mockImplementation((request: AuthorizationRequest) => Promise.resolve(result("DENY", request)));

			await expect(createGuard().canActivate(contextFor(accessToken(), anyOf).context)).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.auditResult).toHaveBeenCalledTimes(2);
		});

		it("ALL mode authorizes each permission", async () => {
			const { context } = contextFor(accessToken(), {
				[REQUIRED_PERMISSIONS_KEY]: {
					mode: "all",
					permissions: [
						["READ", "ROLE"],
						["READ", "PERMISSION"],
					],
				},
			});

			await createGuard().canActivate(context);

			expect(mocks.authorize).toHaveBeenCalledTimes(2);
		});

		it("evaluates role requirements natively (no pseudo ASSUME action)", async () => {
			const roles = { [REQUIRED_ROLES_KEY]: { mode: "any", roles: ["Admin"] } };
			mocks.hasRoles.mockResolvedValue(false);

			await expect(createGuard().canActivate(contextFor(accessToken(), roles).context)).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.hasRoles).toHaveBeenCalledWith("user-1", ["Admin"], "any");

			mocks.hasRoles.mockResolvedValue(true);
			await expect(createGuard().canActivate(contextFor(accessToken(), roles).context)).resolves.toBe(true);
		});
	});

	it("audits the SuperAdmin bypass on protected routes", async () => {
		const superAdmin = accessToken({ isSuperAdmin: true });
		const { context } = contextFor(superAdmin, { [REQUIRED_PERMISSION_KEY]: { action: "DELETE", resource: "USER" } });

		await expect(createGuard().canActivate(context)).resolves.toBe(true);
		expect(mocks.authorize).not.toHaveBeenCalled();
		expect(mocks.auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "SUPER_ADMIN_BYPASS", actorId: "user-1" }));
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
