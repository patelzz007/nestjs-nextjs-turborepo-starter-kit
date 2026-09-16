import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthorizationKernelService } from "../src/modules/authorization/kernel/authorization-kernel.service";

/**
 * E2E Tests for Authorization Kernel
 *
 * Tests the full authorization flow from HTTP request → Guard → Kernel → Database
 */
describe("Authorization Kernel E2E", () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let kernel: AuthorizationKernelService;
	let adminToken: string;
	let userToken: string;
	let userId: string;
	let adminId: string;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		prisma = app.get<PrismaService>(PrismaService);
		kernel = app.get<AuthorizationKernelService>(AuthorizationKernelService);

		// Setup: Create test users with different permissions
		await setupTestUsers();
	});

	afterAll(async () => {
		await cleanupTestData();
		await app.close();
	});

	describe("Public Routes", () => {
		it("should allow access to public routes without authentication", async () => {
			const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should allow access to /version without authentication", async () => {
			const response = await request(app.getHttpServer()).get("/version").expect(200);

			expect(response.body.current).toBeDefined();
		});
	});

	describe("Authenticated Routes", () => {
		it("should deny access without token", async () => {
			await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
		});

		it("should allow access with valid token", async () => {
			const response = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Authorization", `Bearer ${userToken}`).expect(200);

			expect(response.body.data.id).toBe(userId);
		});

		it("should reject expired/invalid token", async () => {
			await request(app.getHttpServer()).get("/api/v1/auth/me").set("Authorization", "Bearer invalid-token").expect(401);
		});
	});

	describe("Permission-Based Authorization", () => {
		it("should allow access when user has required permission", async () => {
			// User with CREATE:ORDER permission
			const response = await request(app.getHttpServer()).post("/api/v1/orders").set("Authorization", `Bearer ${userToken}`).send({/* order data */}).expect(201);

			expect(response.body.success).toBe(true);
		});

		it("should deny access when user lacks required permission", async () => {
			// User without DELETE:ORDER permission
			await request(app.getHttpServer()).delete(`/api/v1/orders/test-order-id`).set("Authorization", `Bearer ${userToken}`).expect(403);
		});

		it("should allow access when user has permission via role", async () => {
			// User with MANAGER role that grants UPDATE:ORDER
			const response = await request(app.getHttpServer())
				.patch(`/api/v1/orders/test-order-id`)
				.set("Authorization", `Bearer ${userToken}`)
				.send({ status: "COMPLETED" })
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("Super-Admin Bypass", () => {
		it("should allow super-admin to access any resource", async () => {
			const response = await request(app.getHttpServer()).get("/api/v1/admin/users").set("Authorization", `Bearer ${adminToken}`).expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should audit super-admin bypass", async () => {
			await request(app.getHttpServer()).get("/api/v1/admin/users").set("Authorization", `Bearer ${adminToken}`).expect(200);

			// Verify audit log was created
			const auditLogs = await prisma.authorizationAudit.findMany({
				where: {
					actorId: adminId,
					action: "SUPER_ADMIN_BYPASS",
				},
				orderBy: { createdAt: "desc" },
				take: 1,
			});

			expect(auditLogs.length).toBeGreaterThan(0);
		});
	});

	describe("ACL Precedence", () => {
		it("should deny access when ACL DENY exists (even with role ALLOW)", async () => {
			// Setup: Create ACL DENY for specific resource
			await prisma.resourceAcl.create({
				data: {
					userId,
					effect: "DENY",
					action: "UPDATE",
					resource: "ORDER",
					resourceId: "blocked-order-id",
				},
			});

			// User has UPDATE:ORDER via role, but ACL DENY blocks it
			await request(app.getHttpServer()).patch(`/api/v1/orders/blocked-order-id`).set("Authorization", `Bearer ${userToken}`).send({ status: "COMPLETED" }).expect(403);

			// Cleanup
			await prisma.resourceAcl.deleteMany({
				where: { userId, resourceId: "blocked-order-id" },
			});
		});

		it("should allow access when ACL ALLOW exists", async () => {
			// Setup: Create ACL ALLOW for specific resource
			await prisma.resourceAcl.create({
				data: {
					userId,
					effect: "ALLOW",
					action: "DELETE",
					resource: "ORDER",
					resourceId: "allowed-order-id",
				},
			});

			// User normally lacks DELETE:ORDER, but ACL ALLOW grants it
			const response = await request(app.getHttpServer()).delete(`/api/v1/orders/allowed-order-id`).set("Authorization", `Bearer ${userToken}`).expect(200);

			expect(response.body.success).toBe(true);

			// Cleanup
			await prisma.resourceAcl.deleteMany({
				where: { userId, resourceId: "allowed-order-id" },
			});
		});
	});

	describe("Token Version Validation", () => {
		it("should reject token when tokenVersion changed (e.g., permission revoked)", async () => {
			// Simulate permission change that increments tokenVersion
			await prisma.user.update({
				where: { id: userId },
				data: { tokenVersion: { increment: 1 } },
			});

			// Old token should now be rejected
			await request(app.getHttpServer()).get("/api/v1/auth/me").set("Authorization", `Bearer ${userToken}`).expect(401);

			// Revert for other tests
			await prisma.user.update({
				where: { id: userId },
				data: { tokenVersion: { decrement: 1 } },
			});
		});
	});

	describe("Kernel API", () => {
		it("should return ALLOW for authorized action", async () => {
			const decision = await kernel.can({
				userId,
				action: "CREATE",
				resource: "ORDER",
			});

			expect(decision).toBe("ALLOW");
		});

		it("should return DENY for unauthorized action", async () => {
			const decision = await kernel.can({
				userId,
				action: "DELETE",
				resource: "USER",
			});

			expect(decision).toBe("DENY");
		});

		it("should provide detailed explanation via explain()", async () => {
			const result = await kernel.explain({
				subject: { userId },
				action: "CREATE",
				resource: "ORDER",
				resourceId: null,
				context: {},
			});

			expect(result.decision).toBe("ALLOW");
			expect(result.matchedGrants.length).toBeGreaterThan(0);
			expect(result.matchedGrants[0]).toHaveProperty("source");
			expect(result.matchedGrants[0]).toHaveProperty("action");
		});

		it("should generate correct filter for accessible resources", async () => {
			const filter = await kernel.filter({
				userId,
				action: "READ",
				resource: "ORDER",
			});

			expect(filter).toHaveProperty("OR");
			expect(Array.isArray(filter.OR)).toBe(true);
		});
	});

	// ─── Test Helpers ────────────────────────────────────────────────────────

	async function setupTestUsers(): Promise<void> {
		// Create test user with basic permissions
		const user = await prisma.user.create({
			data: {
				email: "test-user@example.com",
				fullName: "Test User",
				passwordHash: "hashed-password",
				isEmailVerified: true,
				isSuperAdmin: false,
			},
		});
		userId = user.id;

		// Create super-admin user
		const admin = await prisma.user.create({
			data: {
				email: "admin@example.com",
				fullName: "Admin User",
				passwordHash: "hashed-password",
				isEmailVerified: true,
				isSuperAdmin: true,
			},
		});
		adminId = admin.id;

		// Grant permissions to test user
		const createOrderPermission = await prisma.permission.findFirst({
			where: { action: "CREATE", resource: "ORDER" },
		});

		if (createOrderPermission) {
			await prisma.userPermission.create({
				data: {
					userId,
					permissionId: createOrderPermission.id,
				},
			});
		}

		// Generate tokens (simplified - in real app would use TokenService)
		userToken = await generateTestToken(userId, false);
		adminToken = await generateTestToken(adminId, true);
	}

	async function cleanupTestData(): Promise<void> {
		// Delete test users and their related data
		await prisma.userPermission.deleteMany({
			where: { userId: { in: [userId, adminId] } },
		});
		await prisma.resourceAcl.deleteMany({
			where: { userId: { in: [userId, adminId] } },
		});
		await prisma.user.deleteMany({
			where: { id: { in: [userId, adminId] } },
		});
	}

	async function generateTestToken(id: string, isSuperAdmin: boolean): Promise<string> {
		// Simplified token generation for tests
		// In real implementation, use TokenService
		return `test-token-${id}-${isSuperAdmin}`;
	}
});
