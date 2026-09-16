import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import type { FastifyRequest } from "fastify";

import { AuthorizationGuard } from "../authorization.guard.refactored";
import { AuthorizationKernelService } from "../../kernel/authorization-kernel.service";
import { AuthorizationAuditService } from "../../audit/authorization-audit.service";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../../../types/authenticated-user";
import { REQUIRED_PERMISSION_KEY, REQUIRED_PERMISSIONS_KEY, REQUIRED_ROLES_KEY } from "../../constants/authorization.constants";

describe("AuthorizationGuard (Kernel-First)", () => {
	let guard: AuthorizationGuard;
	let reflector: Reflector;
	let kernel: jest.Mocked<AuthorizationKernelService>;
	let audit: jest.Mocked<AuthorizationAuditService>;
	let prisma: jest.Mocked<PrismaService>;

	const mockUser: AuthenticatedUser = {
		id: "user-123",
		email: "test@example.com",
		fullName: "Test User",
		tokenVersion: 1,
		isSuperAdmin: false,
		hasAdminAccess: false,
	};

	const mockSuperAdmin: AuthenticatedUser = {
		...mockUser,
		id: "superadmin-123",
		isSuperAdmin: true,
		hasAdminAccess: true,
	};

	const createMockContext = (user: Partial<AuthenticatedUser> | undefined, metadata: Record<string, unknown> = {}): ExecutionContext => {
		const request = {
			user,
			url: "/api/v1/test",
		} as FastifyRequest;

		return {
			switchToHttp: () => ({
				getRequest: () => request,
			}),
			getHandler: () => ({ name: "testHandler" }),
			getClass: () => ({ name: "TestController" }),
		} as ExecutionContext;
	};

	beforeEach(async () => {
		const mockKernel = {
			can: jest.fn(),
			explain: jest.fn(),
			authorize: jest.fn(),
		};

		const mockAudit = {
			log: jest.fn(),
		};

		const mockPrisma = {
			user: {
				findUnique: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthorizationGuard,
				{
					provide: Reflector,
					useValue: new Reflector(),
				},
				{
					provide: AuthorizationKernelService,
					useValue: mockKernel,
				},
				{
					provide: AuthorizationAuditService,
					useValue: mockAudit,
				},
				{
					provide: PrismaService,
					useValue: mockPrisma,
				},
			],
		}).compile();

		guard = module.get<AuthorizationGuard>(AuthorizationGuard);
		reflector = module.get<Reflector>(Reflector);
		kernel = module.get(AuthorizationKernelService);
		audit = module.get(AuthorizationAuditService);
		prisma = module.get(PrismaService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("Public Routes (No Metadata)", () => {
		it("should allow public routes with no authorization metadata", async () => {
			const context = createMockContext(undefined);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(kernel.can).not.toHaveBeenCalled();
		});

		it("should compute admin access for authenticated users on public routes", async () => {
			const context = createMockContext(mockUser);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
			kernel.can.mockResolvedValue("ALLOW");
			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });

			await guard.canActivate(context);

			const request = context.switchToHttp().getRequest<FastifyRequest>();
			expect((request.user as AuthenticatedUser).hasAdminAccess).toBeDefined();
		});
	});

	describe("Authentication", () => {
		it("should throw UnauthorizedException if user is not authenticated", async () => {
			const context = createMockContext(undefined);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "READ", resource: "USER" }).mockReturnValue(undefined);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
			await expect(guard.canActivate(context)).rejects.toMatchObject({
				message: "Authentication required",
				error: "UNAUTHENTICATED",
			});
		});

		it("should reject stale tokens (token version mismatch)", async () => {
			const context = createMockContext(mockUser);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "READ", resource: "USER" }).mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 2 }); // Different version

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
			await expect(guard.canActivate(context)).rejects.toMatchObject({
				message: "Token revoked — authorization state changed",
				error: "TOKEN_VERSION_MISMATCH",
			});
		});
	});

	describe("Super-Admin Bypass", () => {
		it("should bypass authorization for super-admins", async () => {
			const context = createMockContext(mockSuperAdmin);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "DELETE", resource: "USER" }).mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(kernel.can).not.toHaveBeenCalled();
			expect(audit.log).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "SUPER_ADMIN_BYPASS",
					actorId: "superadmin-123",
				}),
			);
		});

		it("should set hasAdminAccess to true for super-admins", async () => {
			const context = createMockContext(mockSuperAdmin);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "READ", resource: "USER" }).mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });

			await guard.canActivate(context);

			const request = context.switchToHttp().getRequest<FastifyRequest>();
			expect((request.user as AuthenticatedUser).hasAdminAccess).toBe(true);
		});
	});

	describe("Single Permission Check (@RequirePermission)", () => {
		it("should ALLOW when kernel returns ALLOW", async () => {
			const context = createMockContext(mockUser);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "READ", resource: "USER" }).mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockResolvedValue("ALLOW");

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(kernel.can).toHaveBeenCalledWith({
				userId: "user-123",
				action: "READ",
				resource: "USER",
			});
		});

		it("should DENY when kernel returns DENY", async () => {
			const context = createMockContext(mockUser);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "DELETE", resource: "USER" }).mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockResolvedValue("DENY");

			await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
			await expect(guard.canActivate(context)).rejects.toMatchObject({
				message: "Insufficient permissions",
				error: "PERMISSION_DENIED",
			});
		});
	});

	describe("Multi-Permission Check (@RequireAllPermissions)", () => {
		it("should ALLOW when ALL permissions are granted (AND semantics)", async () => {
			const context = createMockContext(mockUser);
			jest
				.spyOn(reflector, "getAllAndOverride")
				.mockReturnValueOnce(undefined)
				.mockReturnValueOnce({
					mode: "all",
					permissions: [
						["READ", "USER"],
						["UPDATE", "USER"],
					],
				})
				.mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockResolvedValue("ALLOW"); // Both checks return ALLOW

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(kernel.can).toHaveBeenCalledTimes(3); // 2 permission checks + 1 admin dashboard check
		});

		it("should DENY when ANY permission is missing (AND semantics)", async () => {
			const context = createMockContext(mockUser);
			jest
				.spyOn(reflector, "getAllAndOverride")
				.mockReturnValueOnce(undefined)
				.mockReturnValueOnce({
					mode: "all",
					permissions: [
						["READ", "USER"],
						["DELETE", "USER"],
					],
				})
				.mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockResolvedValueOnce("ALLOW").mockResolvedValueOnce("DENY"); // Second check fails

			await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
			await expect(guard.canActivate(context)).rejects.toMatchObject({
				message: "Missing required permissions",
				error: "PERMISSION_DENIED",
			});
		});
	});

	describe("Multi-Permission Check (@RequireAnyPermission)", () => {
		it("should ALLOW when ANY permission is granted (OR semantics)", async () => {
			const context = createMockContext(mockUser);
			jest
				.spyOn(reflector, "getAllAndOverride")
				.mockReturnValueOnce(undefined)
				.mockReturnValueOnce({
					mode: "any",
					permissions: [
						["READ", "USER"],
						["DELETE", "USER"],
					],
				})
				.mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockResolvedValueOnce("ALLOW").mockResolvedValueOnce("DENY"); // First check passes

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
		});

		it("should DENY when ALL permissions are missing (OR semantics)", async () => {
			const context = createMockContext(mockUser);
			jest
				.spyOn(reflector, "getAllAndOverride")
				.mockReturnValueOnce(undefined)
				.mockReturnValueOnce({
					mode: "any",
					permissions: [
						["DELETE", "USER"],
						["MANAGE", "SYSTEM"],
					],
				})
				.mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockResolvedValue("DENY"); // All checks fail

			await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
			await expect(guard.canActivate(context)).rejects.toMatchObject({
				message: "Missing any of the required permissions",
				error: "PERMISSION_DENIED",
			});
		});
	});

	describe("Admin Access Computation", () => {
		it("should compute hasAdminAccess based on ADMIN_DASHBOARD permission", async () => {
			const context = createMockContext(mockUser);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "READ", resource: "USER" }).mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockImplementation(async ({ action, resource }) => {
				if (action === "READ" && resource === "ADMIN_DASHBOARD") {
					return "ALLOW";
				}
				return "ALLOW";
			});

			await guard.canActivate(context);

			const request = context.switchToHttp().getRequest<FastifyRequest>();
			expect((request.user as AuthenticatedUser).hasAdminAccess).toBe(true);
		});

		it("should set hasAdminAccess to false when user lacks ADMIN_DASHBOARD permission", async () => {
			const context = createMockContext(mockUser);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "READ", resource: "USER" }).mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockImplementation(async ({ action, resource }) => {
				if (action === "READ" && resource === "ADMIN_DASHBOARD") {
					return "DENY";
				}
				return "ALLOW";
			});

			await guard.canActivate(context);

			const request = context.switchToHttp().getRequest<FastifyRequest>();
			expect((request.user as AuthenticatedUser).hasAdminAccess).toBe(false);
		});
	});

	describe("Integration", () => {
		it("should handle full authorization flow", async () => {
			const context = createMockContext(mockUser);
			jest.spyOn(reflector, "getAllAndOverride").mockReturnValueOnce({ action: "CREATE", resource: "ORDER" }).mockReturnValue(undefined);

			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
			kernel.can.mockResolvedValue("ALLOW");

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(prisma.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user-123" },
				select: { tokenVersion: true },
			});
			expect(kernel.can).toHaveBeenCalledWith({
				userId: "user-123",
				action: "CREATE",
				resource: "ORDER",
			});
		});
	});
});
