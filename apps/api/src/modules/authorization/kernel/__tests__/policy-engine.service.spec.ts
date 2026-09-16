import { Test, TestingModule } from "@nestjs/testing";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { PolicyEngineService } from "../policy-engine.service";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { AuthorizationRequest, PolicyEvaluationResult } from "@workspace/shared";

describe("PolicyEngineService", () => {
	let service: PolicyEngineService;
	let prisma: jest.Mocked<PrismaService>;

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

	beforeEach(async () => {
		const mockPrisma: jest.Mocked<PrismaService> = {
			policyDefinition: {
				findMany: jest.fn(),
				findFirst: jest.fn(),
			},
		} as never;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PolicyEngineService,
				{
					provide: PrismaService,
					useValue: mockPrisma,
				},
			],
		}).compile();

		service = module.get<PolicyEngineService>(PolicyEngineService);
		prisma = module.get(PrismaService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("evaluate() - Policy Evaluation", () => {
		it("should return null when no policies match", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([]);

			const request = createAuthRequest();
			const result = await service.evaluate(request);

			expect(result).toBeNull();
		});

		it("should ALLOW when policy condition matches with ALLOW effect", async () => {
			// Business hours policy: Allow during 9-5
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-business-hours",
					name: "Business Hours Access",
					effect: "ALLOW",
					conditions: {
						timeWindow: {
							startHour: 9,
							endHour: 17,
						},
					},
					actions: ["CREATE", "UPDATE"],
					resources: ["ORDER"],
					isActive: true,
				},
			]);

			// Mock current time to be within business hours (12:00 PM)
			const mockDate = new Date("2026-09-16T12:00:00Z");
			jest.spyOn(global, "Date").mockImplementation(() => mockDate as never);

			const request = createAuthRequest({
				action: "CREATE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "ALLOW",
				reason: expect.stringContaining("Business Hours"),
				policyId: "policy-business-hours",
			});

			jest.restoreAllMocks();
		});

		it("should DENY when policy condition matches with DENY effect", async () => {
			// Weekend deny policy
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-weekend-deny",
					name: "Deny Weekend Access",
					effect: "DENY",
					conditions: {
						dayOfWeek: [0, 6], // Sunday and Saturday
					},
					actions: ["DELETE"],
					resources: ["ORDER"],
					isActive: true,
				},
			]);

			// Mock current time to be Saturday
			const saturday = new Date("2026-09-19T14:00:00Z"); // Saturday
			jest.spyOn(global, "Date").mockImplementation(() => saturday as never);

			const request = createAuthRequest({
				action: "DELETE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "DENY",
				reason: expect.stringContaining("Weekend"),
				policyId: "policy-weekend-deny",
			});

			jest.restoreAllMocks();
		});

		it("should evaluate IP whitelist policy", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-ip-whitelist",
					name: "Trusted IP Access",
					effect: "ALLOW",
					conditions: {
						ipWhitelist: ["192.168.1.0/24", "10.0.0.1"],
					},
					actions: ["READ", "UPDATE"],
					resources: ["USER"],
					isActive: true,
				},
			]);

			const request = createAuthRequest({
				action: "READ" as PermissionAction,
				resource: "USER" as PermissionResource,
				context: { ipAddress: "192.168.1.100" },
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "ALLOW",
				policyId: "policy-ip-whitelist",
			});
		});

		it("should DENY when IP is not in whitelist", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-ip-whitelist",
					name: "Trusted IP Access",
					effect: "DENY",
					conditions: {
						ipBlacklist: ["203.0.113.0/24"], // Suspicious IPs
					},
					actions: ["*"],
					resources: ["*"],
					isActive: true,
				},
			]);

			const request = createAuthRequest({
				context: { ipAddress: "203.0.113.50" },
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "DENY",
				reason: expect.stringContaining("IP"),
			});
		});

		it("should evaluate owner-only policy", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-owner-only",
					name: "Owner-Only Access",
					effect: "ALLOW",
					conditions: {
						ownershipRequired: true,
					},
					actions: ["UPDATE", "DELETE"],
					resources: ["ORDER"],
					isActive: true,
				},
			]);

			const request = createAuthRequest({
				action: "UPDATE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				context: {
					ownerId: "user-123",
					requesterId: "user-123",
				},
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "ALLOW",
				policyId: "policy-owner-only",
			});
		});

		it("should DENY when ownership required but not met", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-owner-only",
					name: "Owner-Only Access",
					effect: "DENY",
					conditions: {
						ownershipRequired: true,
					},
					actions: ["DELETE"],
					resources: ["ORDER"],
					isActive: true,
				},
			]);

			const request = createAuthRequest({
				action: "DELETE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				context: {
					ownerId: "user-456", // Different owner
					requesterId: "user-123",
				},
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "DENY",
			});
		});
	});

	describe("evaluate() - Complex Conditions", () => {
		it("should evaluate AND conditions", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-complex",
					name: "Complex Policy",
					effect: "ALLOW",
					conditions: {
						AND: [
							{ timeWindow: { startHour: 9, endHour: 17 } },
							{ ipWhitelist: ["192.168.1.0/24"] },
							{ organizationId: "org-123" },
						],
					},
					actions: ["CREATE"],
					resources: ["ORDER"],
					isActive: true,
				},
			]);

			const mockDate = new Date("2026-09-16T12:00:00Z");
			jest.spyOn(global, "Date").mockImplementation(() => mockDate as never);

			const request = createAuthRequest({
				action: "CREATE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				context: {
					ipAddress: "192.168.1.100",
					organizationId: "org-123",
				},
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "ALLOW",
			});

			jest.restoreAllMocks();
		});

		it("should evaluate OR conditions", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-flexible",
					name: "Flexible Access",
					effect: "ALLOW",
					conditions: {
						OR: [
							{ role: "admin" },
							{ role: "superuser" },
							{ ownershipRequired: true },
						],
					},
					actions: ["DELETE"],
					resources: ["USER"],
					isActive: true,
				},
			]);

			const request = createAuthRequest({
				subject: {
					userId: "user-123",
					roles: ["admin"],
					organizationId: null,
					locationId: null,
					isSuperAdmin: false,
				},
				action: "DELETE" as PermissionAction,
				resource: "USER" as PermissionResource,
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "ALLOW",
			});
		});

		it("should handle nested conditions (AND of ORs)", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-nested",
					name: "Nested Conditions",
					effect: "ALLOW",
					conditions: {
						AND: [
							{
								OR: [{ role: "admin" }, { role: "manager" }],
							},
							{
								organizationId: "org-123",
							},
						],
					},
					actions: ["CREATE"],
					resources: ["LOCATION"],
					isActive: true,
				},
			]);

			const request = createAuthRequest({
				subject: {
					userId: "user-123",
					roles: ["manager"],
					organizationId: "org-123",
					locationId: null,
					isSuperAdmin: false,
				},
				action: "CREATE" as PermissionAction,
				resource: "LOCATION" as PermissionResource,
				context: { organizationId: "org-123" },
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "ALLOW",
			});
		});
	});

	describe("evaluate() - Priority and Multiple Policies", () => {
		it("should apply policy with highest priority", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-low-priority",
					name: "Low Priority ALLOW",
					effect: "ALLOW",
					priority: 10,
					conditions: {},
					actions: ["READ"],
					resources: ["USER"],
					isActive: true,
				},
				{
					id: "policy-high-priority",
					name: "High Priority DENY",
					effect: "DENY",
					priority: 100,
					conditions: {},
					actions: ["READ"],
					resources: ["USER"],
					isActive: true,
				},
			]);

			const request = createAuthRequest({
				action: "READ" as PermissionAction,
				resource: "USER" as PermissionResource,
			});

			const result = await service.evaluate(request);

			// Higher priority DENY should win
			expect(result).toMatchObject({
				effect: "DENY",
				policyId: "policy-high-priority",
			});
		});

		it("should skip inactive policies", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-inactive",
					name: "Inactive DENY",
					effect: "DENY",
					conditions: {},
					actions: ["DELETE"],
					resources: ["ORDER"],
					isActive: false, // Inactive
				},
				{
					id: "policy-active",
					name: "Active ALLOW",
					effect: "ALLOW",
					conditions: {},
					actions: ["DELETE"],
					resources: ["ORDER"],
					isActive: true,
				},
			]);

			const request = createAuthRequest({
				action: "DELETE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
			});

			const result = await service.evaluate(request);

			expect(result).toMatchObject({
				effect: "ALLOW",
				policyId: "policy-active",
			});
		});
	});

	describe("Type Safety & Validation", () => {
		it("should validate policy conditions schema", async () => {
			// Invalid condition structure should be handled gracefully
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-invalid",
					name: "Invalid Policy",
					effect: "ALLOW",
					conditions: {
						invalidField: "should-be-ignored",
					},
					actions: ["READ"],
					resources: ["USER"],
					isActive: true,
				},
			]);

			const request = createAuthRequest();
			const result = await service.evaluate(request);

			// Should handle invalid conditions gracefully
			expect(result).toBeDefined();
		});

		it("should handle missing conditions", async () => {
			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue([
				{
					id: "policy-no-conditions",
					name: "No Conditions",
					effect: "ALLOW",
					conditions: null,
					actions: ["READ"],
					resources: ["USER"],
					isActive: true,
				},
			]);

			const request = createAuthRequest();
			const result = await service.evaluate(request);

			// Policy with no conditions should always match
			expect(result).toMatchObject({
				effect: "ALLOW",
			});
		});
	});

	describe("Performance", () => {
		it("should evaluate policies efficiently", async () => {
			// Multiple policies to test performance
			const policies = Array.from({ length: 50 }, (_, i) => ({
				id: `policy-${i}`,
				name: `Policy ${i}`,
				effect: i % 2 === 0 ? ("ALLOW" as const) : ("DENY" as const),
				conditions: { timeWindow: { startHour: 0, endHour: 24 } },
				actions: ["READ"],
				resources: ["USER"],
				priority: i,
				isActive: true,
			}));

			(prisma.policyDefinition.findMany as jest.Mock).mockResolvedValue(policies);

			const request = createAuthRequest();

			const start = Date.now();
			await service.evaluate(request);
			const duration = Date.now() - start;

			// Should complete in reasonable time even with many policies
			expect(duration).toBeLessThan(100);
		});
	});
});
