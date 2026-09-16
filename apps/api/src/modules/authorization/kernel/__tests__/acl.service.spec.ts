import { Test, TestingModule } from "@nestjs/testing";
import type { PermissionAction, PermissionResource, AclEffect } from "@workspace/shared";

import { AclService } from "../acl.service";
import { PrismaService } from "../../../../prisma/prisma.service";

describe("AclService", () => {
	let service: AclService;
	let prisma: jest.Mocked<PrismaService>;

	beforeEach(async () => {
		const mockPrisma: jest.Mocked<PrismaService> = {
			resourceAcl: {
				findFirst: jest.fn(),
				findMany: jest.fn(),
				create: jest.fn(),
				delete: jest.fn(),
				deleteMany: jest.fn(),
			},
		} as never;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AclService,
				{
					provide: PrismaService,
					useValue: mockPrisma,
				},
			],
		}).compile();

		service = module.get<AclService>(AclService);
		prisma = module.get(PrismaService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("checkAcl() - ACL Lookup", () => {
		it("should return DENY when ACL DENY exists", async () => {
			(prisma.resourceAcl.findFirst as jest.Mock).mockResolvedValue({
				id: "acl-1",
				userId: "user-123",
				action: "DELETE",
				resource: "ORDER",
				resourceId: "order-123",
				effect: "DENY" as AclEffect,
			});

			const result = await service.checkAcl(
				"user-123",
				"DELETE" as PermissionAction,
				"ORDER" as PermissionResource,
				"order-123",
			);

			expect(result).toBe("DENY");
			expect(prisma.resourceAcl.findFirst).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					action: "DELETE",
					resource: "ORDER",
					resourceId: "order-123",
					isDeleted: false,
				},
				orderBy: { priority: "desc" },
			});
		});

		it("should return ALLOW when ACL ALLOW exists", async () => {
			(prisma.resourceAcl.findFirst as jest.Mock).mockResolvedValue({
				id: "acl-2",
				userId: "user-123",
				action: "UPDATE",
				resource: "ORDER",
				resourceId: "order-456",
				effect: "ALLOW" as AclEffect,
			});

			const result = await service.checkAcl(
				"user-123",
				"UPDATE" as PermissionAction,
				"ORDER" as PermissionResource,
				"order-456",
			);

			expect(result).toBe("ALLOW");
		});

		it("should return null when no ACL exists", async () => {
			(prisma.resourceAcl.findFirst as jest.Mock).mockResolvedValue(null);

			const result = await service.checkAcl(
				"user-123",
				"READ" as PermissionAction,
				"USER" as PermissionResource,
				"user-456",
			);

			expect(result).toBeNull();
		});

		it("should prioritize by priority field", async () => {
			// High priority DENY should be returned first
			(prisma.resourceAcl.findFirst as jest.Mock).mockResolvedValue({
				id: "acl-high-priority",
				userId: "user-123",
				action: "DELETE",
				resource: "ORDER",
				resourceId: "order-123",
				effect: "DENY" as AclEffect,
				priority: 100,
			});

			const result = await service.checkAcl(
				"user-123",
				"DELETE" as PermissionAction,
				"ORDER" as PermissionResource,
				"order-123",
			);

			expect(result).toBe("DENY");
			expect(prisma.resourceAcl.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: { priority: "desc" },
				}),
			);
		});

		it("should filter out soft-deleted ACLs", async () => {
			(prisma.resourceAcl.findFirst as jest.Mock).mockResolvedValue(null);

			await service.checkAcl(
				"user-123",
				"READ" as PermissionAction,
				"USER" as PermissionResource,
				"user-456",
			);

			expect(prisma.resourceAcl.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						isDeleted: false,
					}),
				}),
			);
		});
	});

	describe("createAcl() - ACL Creation", () => {
		it("should create DENY ACL entry", async () => {
			const mockAcl = {
				id: "acl-new",
				userId: "user-123",
				action: "DELETE",
				resource: "ORDER",
				resourceId: "order-789",
				effect: "DENY" as AclEffect,
				priority: 50,
				reason: "User is not allowed to delete this order",
				createdAt: new Date(),
			};

			(prisma.resourceAcl.create as jest.Mock).mockResolvedValue(mockAcl);

			const result = await service.createAcl({
				userId: "user-123",
				action: "DELETE" as PermissionAction,
				resource: "ORDER" as PermissionResource,
				resourceId: "order-789",
				effect: "DENY" as AclEffect,
				priority: 50,
				reason: "User is not allowed to delete this order",
			});

			expect(result).toEqual(mockAcl);
			expect(prisma.resourceAcl.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					action: "DELETE",
					resource: "ORDER",
					resourceId: "order-789",
					effect: "DENY",
					priority: 50,
					reason: "User is not allowed to delete this order",
				},
			});
		});

		it("should create ALLOW ACL entry", async () => {
			const mockAcl = {
				id: "acl-allow",
				userId: "user-456",
				action: "UPDATE",
				resource: "LOCATION",
				resourceId: "loc-123",
				effect: "ALLOW" as AclEffect,
				priority: 75,
				reason: "Temporary access granted",
				createdAt: new Date(),
			};

			(prisma.resourceAcl.create as jest.Mock).mockResolvedValue(mockAcl);

			const result = await service.createAcl({
				userId: "user-456",
				action: "UPDATE" as PermissionAction,
				resource: "LOCATION" as PermissionResource,
				resourceId: "loc-123",
				effect: "ALLOW" as AclEffect,
				priority: 75,
				reason: "Temporary access granted",
			});

			expect(result).toEqual(mockAcl);
		});

		it("should default priority to 0 if not specified", async () => {
			(prisma.resourceAcl.create as jest.Mock).mockResolvedValue({
				id: "acl-default-priority",
				priority: 0,
			});

			await service.createAcl({
				userId: "user-123",
				action: "READ" as PermissionAction,
				resource: "USER" as PermissionResource,
				resourceId: "user-456",
				effect: "ALLOW" as AclEffect,
			});

			expect(prisma.resourceAcl.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						priority: 0,
					}),
				}),
			);
		});
	});

	describe("removeAcl() - ACL Deletion", () => {
		it("should soft-delete ACL entry", async () => {
			(prisma.resourceAcl.delete as jest.Mock).mockResolvedValue({
				id: "acl-to-delete",
				isDeleted: true,
			});

			await service.removeAcl("acl-to-delete");

			expect(prisma.resourceAcl.delete).toHaveBeenCalledWith({
				where: { id: "acl-to-delete" },
			});
		});

		it("should handle non-existent ACL gracefully", async () => {
			(prisma.resourceAcl.delete as jest.Mock).mockResolvedValue(null);

			await expect(service.removeAcl("non-existent-acl")).resolves.not.toThrow();
		});
	});

	describe("listAcls() - ACL Listing", () => {
		it("should list all ACLs for a user", async () => {
			const mockAcls = [
				{
					id: "acl-1",
					userId: "user-123",
					action: "DELETE",
					resource: "ORDER",
					resourceId: "order-1",
					effect: "DENY" as AclEffect,
					priority: 100,
				},
				{
					id: "acl-2",
					userId: "user-123",
					action: "UPDATE",
					resource: "ORDER",
					resourceId: "order-2",
					effect: "ALLOW" as AclEffect,
					priority: 50,
				},
			];

			(prisma.resourceAcl.findMany as jest.Mock).mockResolvedValue(mockAcls);

			const result = await service.listAcls({ userId: "user-123" });

			expect(result).toEqual(mockAcls);
			expect(prisma.resourceAcl.findMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					isDeleted: false,
				},
				orderBy: { priority: "desc" },
			});
		});

		it("should list ACLs for a specific resource", async () => {
			const mockAcls = [
				{
					id: "acl-resource-specific",
					userId: "user-123",
					action: "DELETE",
					resource: "ORDER",
					resourceId: "order-specific",
					effect: "DENY" as AclEffect,
				},
			];

			(prisma.resourceAcl.findMany as jest.Mock).mockResolvedValue(mockAcls);

			const result = await service.listAcls({
				userId: "user-123",
				resource: "ORDER" as PermissionResource,
				resourceId: "order-specific",
			});

			expect(result).toEqual(mockAcls);
			expect(prisma.resourceAcl.findMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					resource: "ORDER",
					resourceId: "order-specific",
					isDeleted: false,
				},
				orderBy: { priority: "desc" },
			});
		});

		it("should filter by effect type", async () => {
			const denyAcls = [
				{
					id: "acl-deny-1",
					effect: "DENY" as AclEffect,
				},
			];

			(prisma.resourceAcl.findMany as jest.Mock).mockResolvedValue(denyAcls);

			const result = await service.listAcls({
				userId: "user-123",
				effect: "DENY" as AclEffect,
			});

			expect(result).toEqual(denyAcls);
			expect(prisma.resourceAcl.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						effect: "DENY",
					}),
				}),
			);
		});

		it("should return empty array when no ACLs exist", async () => {
			(prisma.resourceAcl.findMany as jest.Mock).mockResolvedValue([]);

			const result = await service.listAcls({ userId: "user-no-acls" });

			expect(result).toEqual([]);
		});
	});

	describe("Type Safety & Generics", () => {
		it("should enforce type-safe action parameter", async () => {
			const action: PermissionAction = "READ";

			await service.checkAcl(
				"user-123",
				action, // Type-safe
				"USER" as PermissionResource,
				"user-456",
			);

			expect(prisma.resourceAcl.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						action: "READ",
					}),
				}),
			);
		});

		it("should enforce type-safe resource parameter", async () => {
			const resource: PermissionResource = "ORDER";

			await service.checkAcl(
				"user-123",
				"CREATE" as PermissionAction,
				resource, // Type-safe
				"order-123",
			);

			expect(prisma.resourceAcl.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						resource: "ORDER",
					}),
				}),
			);
		});

		it("should enforce type-safe effect parameter", async () => {
			const effect: AclEffect = "DENY";

			await service.createAcl({
				userId: "user-123",
				action: "DELETE" as PermissionAction,
				resource: "USER" as PermissionResource,
				resourceId: "user-456",
				effect, // Type-safe
			});

			expect(prisma.resourceAcl.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						effect: "DENY",
					}),
				}),
			);
		});
	});

	describe("Priority Handling", () => {
		it("should respect ACL priority order", async () => {
			// High priority should be checked first
			const highPriorityAcl = {
				id: "acl-high",
				priority: 100,
				effect: "DENY" as AclEffect,
			};

			(prisma.resourceAcl.findFirst as jest.Mock).mockResolvedValue(highPriorityAcl);

			const result = await service.checkAcl(
				"user-123",
				"DELETE" as PermissionAction,
				"ORDER" as PermissionResource,
				"order-123",
			);

			expect(result).toBe("DENY");
			expect(prisma.resourceAcl.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: { priority: "desc" }, // Descending order
				}),
			);
		});
	});

	describe("Performance", () => {
		it("should complete ACL check efficiently", async () => {
			(prisma.resourceAcl.findFirst as jest.Mock).mockResolvedValue({
				effect: "ALLOW" as AclEffect,
			});

			const start = Date.now();
			await service.checkAcl(
				"user-123",
				"READ" as PermissionAction,
				"USER" as PermissionResource,
				"user-456",
			);
			const duration = Date.now() - start;

			// Should complete very quickly (< 50ms with mocks)
			expect(duration).toBeLessThan(50);
		});
	});
});
