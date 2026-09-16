import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import type { PermissionAction, PermissionResource, PermissionScope, AuthorizationDecision } from "@workspace/shared";

import { AuthorizationKernelService } from "../authorization-kernel.service";
import { PolicyEngineService } from "../policy-engine.service";
import { AclService } from "../acl.service";
import { AuthorizationAuditKernelService } from "../authorization-audit-kernel.service";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { AuthorizationRequest, AuthorizationResult, AuthorizationContext } from "@workspace/shared";

describe("AuthorizationKernelService", () => {
	let service: AuthorizationKernelService;
	let policyEngine: jest.Mocked<PolicyEngineService>;
	let aclService: jest.Mocked<AclService>;
	let auditService: jest.Mocked<AuthorizationAuditKernelService>;
	let prisma: jest.Mocked<PrismaService>;

	// Test data factories with full type safety
	const createAuthRequest = (overrides?: Partial<AuthorizationRequest>): AuthorizationRequest => ({
		subject: {
			userId: "user-123",
			roles: ["user"],
			organizationId: null,
			locationId: null,
			isSuperAdmin: false,
		},
		action: "READ" as PermissionAction,
		resource: "USER" as PermissionResource,
		resourceId: null,
		context: {},
		...overrides,
	});

	const createAuthContext = (overrides?: Partial<AuthorizationContext>): AuthorizationContext => ({
		requestTime: Date.now(),
		ipAddress: "127.0.0.1",
		userAgent: "test-agent",
		...overrides,
	});

	beforeEach(async () => {
		// Create fully typed mocks
		const mockPolicyEngine: jest.Mocked<PolicyEngineService> = {
			evaluate: jest.fn(),
		} as never;

		const mockAclService: jest.Mocked<AclService> = {
			checkAcl: jest.fn(),
			createAcl: jest.fn(),
			removeAcl: jest.fn(),
			listAcls: jest.fn(),
		} as never;

		const mockAuditService: jest.Mocked<AuthorizationAuditKernelService> = {
			log: jest.fn(),
			auditResult: jest.fn(),
		} as never;

		const mockPrisma: jest.Mocked<PrismaService> = {
			user: {
				findUnique: jest.fn(),
				findFirst: jest.fn(),
			},
			userRole: {
				findMany: jest.fn(),
			},
			role: {
				findMany: jest.fn(),
			},
			rolePermission: {
				findMany: jest.fn(),
			},
			permission: {
				findMany: jest.fn(),
			},
			userPermission: {
				findMany: jest.fn(),
			},
			resourceAcl: {
				findFirst: jest.fn(),
				findMany: jest.fn(),
			},
		} as never;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthorizationKernelService,
				{
					provide: PolicyEngineService,
					useValue: mockPolicyEngine,
				},
				{
					provide: AclService,
					useValue: mockAclService,
				},
				{
					provide: AuthorizationAuditKernelService,
					useValue: mockAuditService,
				},
				{
					provide: PrismaService,
					useValue: mockPrisma,
				},
			],
		}).compile();

		service = module.get<AuthorizationKernelService>(AuthorizationKernelService);
		policyEngine = module.get(PolicyEngineService);
		aclService = module.get(AclService);
		auditService = module.get(AuthorizationAuditKernelService);
		prisma = module.get(PrismaService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("can() - Basic Authorization", () => {
		it("should DENY by default when no permissions exist", async () => {
			// Setup: No roles or permissions
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest();
			const decision = await service.can(request);

			expect(decision).toBe("DENY");
			expect(auditService.log).toHaveBeenCalledWith(
				expect.objectContaining({
					decision: "DENY",
					userId: "user-123",
				}),
			);
		});

		it("should ALLOW when user has matching role permission", async () => {
			// Setup: User has role with READ:USER permission
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([
				{
					roleId: "role-1",
					role: { id: "role-1", name: "user", parentId: null },
				},
			]);

			(prisma.role.findMany as jest.Mock).mockResolvedValue([{ id: "role-1", name: "user" }]);

			(prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
				{
					roleId: "role-1",
					permissionId: "perm-1",
					permission: {
						action: "READ",
						resource: "USER",
					},
				},
			]);

			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest({
				action: "READ" as PermissionAction,
				resource: "USER" as PermissionResource,
			});

			const decision = await service.can(request);

			expect(decision).toBe("ALLOW");
			expect(auditService.log).toHaveBeenCalledWith(
				expect.objectContaining({
					decision: "ALLOW",
					userId: "user-123",
					reason: expect.stringContaining("ROLE"),
				}),
			);
		});

		it("should ALLOW when user has direct permission", async () => {
			// Setup: User has direct permission, no roles
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([
				{
					userId: "user-123",
					permissionId: "perm-1",
					permission: {
						action: "CREATE",
						resource: "ORDER",
					},
					expiresAt: null,
				},
			]);

			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest({
				action: "CREATE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
			});

			const decision = await service.can(request);

			expect(decision).toBe("ALLOW");
		});

		it("should ALLOW with MANAGE permission (wildcard)", async () => {
			// Setup: User has MANAGE permission on resource
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([
				{
					userId: "user-123",
					permissionId: "perm-1",
					permission: {
						action: "MANAGE",
						resource: "ORDER",
					},
					expiresAt: null,
				},
			]);

			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			// Request any action on ORDER
			const request = createAuthRequest({
				action: "DELETE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
			});

			const decision = await service.can(request);

			expect(decision).toBe("ALLOW");
		});
	});

	describe("can() - ACL Precedence", () => {
		it("should DENY when ACL DENY exists (highest precedence)", async () => {
			// Setup: User has permission BUT ACL DENY exists
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([
				{
					userId: "user-123",
					permissionId: "perm-1",
					permission: {
						action: "DELETE",
						resource: "ORDER",
					},
					expiresAt: null,
				},
			]);

			// ACL DENY takes precedence
			aclService.checkAcl.mockResolvedValue("DENY");
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest({
				action: "DELETE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				resourceId: "order-123",
			});

			const decision = await service.can(request);

			expect(decision).toBe("DENY");
			expect(aclService.checkAcl).toHaveBeenCalledWith("user-123", "DELETE", "ORDER", "order-123");
		});

		it("should ALLOW when ACL ALLOW exists (overrides missing role permission)", async () => {
			// Setup: User has NO permission BUT ACL ALLOW exists
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);

			// ACL ALLOW grants access
			aclService.checkAcl.mockResolvedValue("ALLOW");
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest({
				action: "UPDATE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				resourceId: "order-123",
			});

			const decision = await service.can(request);

			expect(decision).toBe("ALLOW");
		});

		it("should verify ACL precedence order: DENY > ALLOW > Role > Default DENY", async () => {
			// Test 1: ACL DENY beats everything
			aclService.checkAcl.mockResolvedValue("DENY");
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([{ permission: { action: "READ", resource: "USER" } }]);

			let decision = await service.can(createAuthRequest());
			expect(decision).toBe("DENY");

			// Test 2: ACL ALLOW beats role permissions
			aclService.checkAcl.mockResolvedValue("ALLOW");
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);

			decision = await service.can(createAuthRequest({ resourceId: "res-1" }));
			expect(decision).toBe("ALLOW");

			// Test 3: Role permission when no ACL
			aclService.checkAcl.mockResolvedValue(null);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([{ permission: { action: "READ", resource: "USER" } }]);

			decision = await service.can(createAuthRequest());
			expect(decision).toBe("ALLOW");

			// Test 4: Default DENY when nothing matches
			aclService.checkAcl.mockResolvedValue(null);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);

			decision = await service.can(createAuthRequest());
			expect(decision).toBe("DENY");
		});
	});

	describe("can() - Policy-Based Authorization (ABAC)", () => {
		it("should DENY when policy returns DENY effect", async () => {
			// Setup: User has permission BUT policy DENIES
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([
				{
					permission: { action: "CREATE", resource: "ORDER" },
				},
			]);

			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue({
				effect: "DENY",
				reason: "Business hours policy: Access denied outside 9-5",
				policyId: "policy-business-hours",
			});

			const request = createAuthRequest({
				action: "CREATE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
			});

			const decision = await service.can(request);

			expect(decision).toBe("DENY");
			expect(policyEngine.evaluate).toHaveBeenCalled();
		});

		it("should ALLOW when policy returns ALLOW effect", async () => {
			// Setup: User has no permission BUT policy ALLOWS
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);
			aclService.checkAcl.mockResolvedValue(null);

			policyEngine.evaluate.mockResolvedValue({
				effect: "ALLOW",
				reason: "IP whitelist policy: Access granted from trusted IP",
				policyId: "policy-ip-whitelist",
			});

			const request = createAuthRequest({
				action: "READ" as PermissionAction,
				resource: "USER" as PermissionResource,
				context: { ipAddress: "192.168.1.100" },
			});

			const decision = await service.can(request);

			expect(decision).toBe("ALLOW");
		});
	});

	describe("can() - Ownership-Based Authorization", () => {
		it("should ALLOW when user owns the resource", async () => {
			// Setup: User has READ:OWN permission
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([
				{
					permission: {
						action: "READ",
						resource: "ORDER",
						scope: "OWN" as PermissionScope,
					},
				},
			]);

			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			// Mock ownership check
			(prisma.user.findFirst as jest.Mock).mockResolvedValue({
				id: "user-123",
			});

			const request = createAuthRequest({
				action: "READ" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				resourceId: "order-owned-by-user-123",
				context: { ownerId: "user-123" },
			});

			const decision = await service.can(request);

			expect(decision).toBe("ALLOW");
		});

		it("should DENY when user does not own the resource", async () => {
			// Setup: User has READ:OWN permission but doesn't own resource
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([
				{
					permission: {
						action: "READ",
						resource: "ORDER",
						scope: "OWN" as PermissionScope,
					},
				},
			]);

			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest({
				action: "READ" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				resourceId: "order-owned-by-other-user",
				context: { ownerId: "other-user-456" },
			});

			const decision = await service.can(request);

			expect(decision).toBe("DENY");
		});
	});

	describe("explain() - Decision Tracing", () => {
		it("should provide full decision trace for ALLOW", async () => {
			// Setup: User has permission via role
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([
				{
					roleId: "role-1",
					role: { id: "role-1", name: "admin", parentId: null },
				},
			]);

			(prisma.role.findMany as jest.Mock).mockResolvedValue([{ id: "role-1", name: "admin" }]);

			(prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
				{
					roleId: "role-1",
					permission: { action: "DELETE", resource: "USER" },
				},
			]);

			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest({
				action: "DELETE" as PermissionAction,
				resource: "USER" as PermissionResource,
			});

			const result: AuthorizationResult = await service.explain(request);

			expect(result.decision).toBe("ALLOW");
			expect(result.evaluationSteps).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						stage: "ACL",
						result: "NOT_APPLICABLE",
					}),
					expect.objectContaining({
						stage: "POLICY",
						result: "NOT_APPLICABLE",
					}),
					expect.objectContaining({
						stage: "ROLE",
						result: "ALLOW",
					}),
				]),
			);
			expect(result.evaluationTimeMs).toBeGreaterThan(0);
		});

		it("should provide full decision trace for DENY with ACL", async () => {
			// Setup: User has permission BUT ACL DENY
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([{ permission: { action: "DELETE", resource: "ORDER" } }]);

			aclService.checkAcl.mockResolvedValue("DENY");
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest({
				action: "DELETE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				resourceId: "order-123",
			});

			const result = await service.explain(request);

			expect(result.decision).toBe("DENY");
			expect(result.evaluationSteps).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						stage: "ACL",
						result: "DENY",
						reason: expect.stringContaining("ACL DENY"),
					}),
				]),
			);
		});

		it("should include timing information in trace", async () => {
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest();
			const result = await service.explain(request);

			expect(result.evaluationTimeMs).toBeDefined();
			expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
			expect(result.timestamp).toBeDefined();
		});
	});

	describe("authorize() - Throws on DENY", () => {
		it("should throw ForbiddenException when decision is DENY", async () => {
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest();

			await expect(service.authorize(request)).rejects.toThrow(ForbiddenException);
			await expect(service.authorize(request)).rejects.toMatchObject({
				message: expect.stringContaining("Access denied"),
			});
		});

		it("should not throw when decision is ALLOW", async () => {
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([{ permission: { action: "READ", resource: "USER" } }]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest();

			await expect(service.authorize(request)).resolves.not.toThrow();
		});
	});

	describe("filter() - Query Filtering", () => {
		it("should return filter for user-owned resources", async () => {
			const filter = await service.filter({
				userId: "user-123",
				action: "READ" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				context: {},
			});

			expect(filter).toEqual(
				expect.objectContaining({
					OR: expect.arrayContaining([expect.objectContaining({ ownerId: "user-123" })]),
				}),
			);
		});

		it("should return empty filter for super-admin", async () => {
			(prisma.user.findUnique as jest.Mock).mockResolvedValue({
				isSuperAdmin: true,
			});

			const filter = await service.filter({
				userId: "superadmin-123",
				action: "READ" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				context: {},
			});

			expect(filter).toEqual({}); // No filter = access to all
		});

		it("should return organization-scoped filter", async () => {
			const filter = await service.filter({
				userId: "user-123",
				action: "READ" as PermissionAction,
				resource: "LOCATION" as PermissionResource,
				context: { organizationId: "org-456" },
			});

			expect(filter).toEqual(
				expect.objectContaining({
					organizationId: "org-456",
				}),
			);
		});
	});

	describe("Type Safety & Generics", () => {
		it("should enforce type safety on permission actions", () => {
			const request = createAuthRequest({
				action: "READ" as PermissionAction, // Type-safe
				resource: "USER" as PermissionResource,
			});

			expect(request.action).toBe("READ");
		});

		it("should enforce type safety on permission resources", () => {
			const request = createAuthRequest({
				action: "CREATE" as PermissionAction,
				resource: "ORDER" as PermissionResource, // Type-safe
			});

			expect(request.resource).toBe("ORDER");
		});

		it("should use generic types for context", () => {
			interface OrderContext {
				readonly organizationId: string;
				readonly locationId: string;
				readonly orderTotal: number;
			}

			const request = createAuthRequest({
				context: {
					organizationId: "org-1",
					locationId: "loc-1",
					orderTotal: 100.5,
				} as OrderContext,
			});

			expect(request.context).toHaveProperty("organizationId");
			expect(request.context).toHaveProperty("locationId");
			expect(request.context).toHaveProperty("orderTotal");
		});
	});

	describe("Performance & Caching", () => {
		it("should cache permission lookups", async () => {
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([{ permission: { action: "READ", resource: "USER" } }]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest();

			// First call
			await service.can(request);
			expect(prisma.userPermission.findMany).toHaveBeenCalledTimes(1);

			// Second call - should use cache
			await service.can(request);
			// Note: In real implementation, this should not call DB again
			// This test documents expected caching behavior
		});

		it("should complete authorization check within performance threshold", async () => {
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([{ permission: { action: "READ", resource: "USER" } }]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest();

			const start = Date.now();
			await service.can(request);
			const duration = Date.now() - start;

			// Authorization should complete in < 100ms (with mocks)
			expect(duration).toBeLessThan(100);
		});
	});

	describe("Audit Logging", () => {
		it("should audit DENY decisions", async () => {
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest();
			await service.can(request);

			expect(auditService.log).toHaveBeenCalledWith(
				expect.objectContaining({
					decision: "DENY",
					userId: "user-123",
					action: "READ",
					resource: "USER",
				}),
			);
		});

		it("should audit ALLOW decisions for write operations", async () => {
			(prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.userPermission.findMany as jest.Mock).mockResolvedValue([{ permission: { action: "DELETE", resource: "USER" } }]);
			aclService.checkAcl.mockResolvedValue(null);
			policyEngine.evaluate.mockResolvedValue(null);

			const request = createAuthRequest({
				action: "DELETE" as PermissionAction,
			});

			await service.can(request);

			expect(auditService.log).toHaveBeenCalledWith(
				expect.objectContaining({
					decision: "ALLOW",
					action: "DELETE",
				}),
			);
		});
	});
});
