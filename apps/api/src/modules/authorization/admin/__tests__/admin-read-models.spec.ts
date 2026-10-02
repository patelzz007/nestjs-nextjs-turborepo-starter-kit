import type { Permission, PermissionAuditLog, Role } from "@prisma/client";
import { AuditLogQuerySchema, type UserPermissions } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../../prisma/prisma.service";
import { toAdminPermissionResponse, toRoleResponse } from "../mappers/rbac-response.mappers";
import { PermissionAuditLogRepository } from "../repositories/permission-audit-log.repository";
import { RolePermissionPreviewRepository } from "../repositories/role-permission-preview.repository";
import { PermissionAuditLogQueryService, toAuditLogEntry } from "../services/permission-audit-log-query.service";
import { RoleAssignmentPreviewService } from "../services/role-assignment-preview.service";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";

const EPOCH = 1_790_812_800_000;
const ACTOR_ID = "6f1c2a52-9a3e-4d38-9a55-0d1e2f3a4b5c";
const TARGET_USER_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";
const TARGET_ROLE_ID = "8b3e4c74-1c50-4f5a-9c77-2f3a4b5c6d7e";

function buildAuditRow(overrides: Partial<PermissionAuditLog> = {}): PermissionAuditLog {
	return {
		id: "log-1",
		actorId: "user-actor",
		targetUserId: "user-target",
		targetRoleId: null,
		permissionId: null,
		action: "ROLE_ASSIGNED",
		detail: "Assigned Editor",
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(EPOCH),
		updatedAt: BigInt(EPOCH),
		...overrides,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("PermissionAuditLogRepository", () => {
	it("filters out deleted rows, applies every filter, and pages newest-first with an id tie-breaker", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const findMany = vi.spyOn(prisma.permissionAuditLog, "findMany").mockResolvedValue([buildAuditRow()]);
		const count = vi.spyOn(prisma.permissionAuditLog, "count").mockResolvedValue(41);
		const query = AuditLogQuerySchema.parse({
			page: "3",
			limit: "20",
			filter: { action: "ROLE_ASSIGNED", actorId: ACTOR_ID, targetUserId: TARGET_USER_ID, targetRoleId: TARGET_ROLE_ID },
		});

		const page = await new PermissionAuditLogRepository(prisma).list(query);

		const where = {
			AND: [
				{ isDeleted: false },
				{ action: { equals: "ROLE_ASSIGNED", mode: "insensitive" } },
				{ actorId: { equals: ACTOR_ID } },
				{ targetUserId: { equals: TARGET_USER_ID } },
				{ targetRoleId: { equals: TARGET_ROLE_ID } },
			],
		};
		expect(findMany).toHaveBeenCalledWith({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 40, take: 20 });
		expect(count).toHaveBeenCalledWith({ where });
		expect(page.total).toBe(41);
	});

	it("only filters on isDeleted when no filters are given", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const findMany = vi.spyOn(prisma.permissionAuditLog, "findMany").mockResolvedValue([]);
		vi.spyOn(prisma.permissionAuditLog, "count").mockResolvedValue(0);

		await new PermissionAuditLogRepository(prisma).list(AuditLogQuerySchema.parse({}));

		expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [{ isDeleted: false }] }, skip: 0 }));
	});
});

describe("PermissionAuditLogQueryService", () => {
	it("maps rows to the AuditLogEntry contract with offset pagination meta", async () => {
		const repository = new PermissionAuditLogRepository(new PrismaService(createTestTypedConfig()));
		vi.spyOn(repository, "list").mockResolvedValue({ items: [buildAuditRow()], total: 41, page: 3, totalPages: 3, nextCursor: null, hasNext: false, hasPrevious: true });

		const result = await new PermissionAuditLogQueryService(repository).list(AuditLogQuerySchema.parse({ page: "3", limit: "20" }));

		expect(result).toEqual({
			items: [
				{
					id: "log-1",
					actorId: "user-actor",
					targetUserId: "user-target",
					targetRoleId: null,
					permissionId: null,
					action: "ROLE_ASSIGNED",
					detail: "Assigned Editor",
					createdAt: EPOCH,
					updatedAt: EPOCH,
				},
			],
			limit: 20,
			total: 41,
			page: 3,
			totalPages: 3,
			nextCursor: null,
			hasNext: false,
			hasPrevious: true,
		});
	});

	it("does not expose internal soft-delete columns", () => {
		expect(toAuditLogEntry(buildAuditRow())).not.toHaveProperty("isDeleted");
	});
});

describe("RolePermissionPreviewRepository", () => {
	it("returns nothing without querying when no role ids are given", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const findMany = vi.spyOn(prisma.role, "findMany");

		await expect(new RolePermissionPreviewRepository(prisma).findRolesWithPermissionKeys([])).resolves.toEqual([]);
		expect(findMany).not.toHaveBeenCalled();
	});

	it("loads non-deleted roles with only live permission assignments", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const findMany = vi.spyOn(prisma.role, "findMany").mockResolvedValue([]);

		await new RolePermissionPreviewRepository(prisma).findRolesWithPermissionKeys(["r-1"]);

		expect(findMany).toHaveBeenCalledTimes(1);
		const args = findMany.mock.lastCall?.[0];
		expect(args?.where).toEqual({ id: { in: ["r-1"] }, isDeleted: false });
		expect(args?.select?.rolePermissions).toHaveProperty("where", { isDeleted: false });
	});
});

describe("RoleAssignmentPreviewService", () => {
	it("diffs current roles/permissions against the proposed role set", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const current: UserPermissions = {
			roles: [{ id: "r-viewer", name: "Viewer", description: null }],
			permissions: [
				{ id: "p-read", action: "READ", resource: "PRODUCT", description: null, group: null },
				{ id: "p-list", action: "LIST", resource: "PRODUCT", description: null, group: null },
			],
		};
		const checker = { getUserPermissionDetails: vi.fn((): Promise<UserPermissions> => Promise.resolve(current)) };
		const repository = new RolePermissionPreviewRepository(prisma);
		vi.spyOn(repository, "findRolesWithPermissionKeys").mockResolvedValue([{ name: "Editor", permissionKeys: ["READ:PRODUCT", "UPDATE:PRODUCT"] }]);

		const preview = await new RoleAssignmentPreviewService(checker, repository).preview("user-1", ["r-editor"]);

		expect(preview).toEqual({
			currentRoles: ["Viewer"],
			newRoles: ["Editor"],
			roleAdded: ["Editor"],
			roleRemoved: ["Viewer"],
			permissionsGained: ["UPDATE:PRODUCT"],
			permissionsLost: ["LIST:PRODUCT"],
		});
	});
});

describe("RBAC response mappers", () => {
	it("maps a Role row to the shared RoleResponse contract", () => {
		const row: Role = {
			id: "r-1",
			name: "Editor",
			description: null,
			isActive: true,
			parentId: null,
			isDeleted: false,
			deletedAt: null,
			createdAt: BigInt(EPOCH),
			updatedAt: BigInt(EPOCH),
		};

		expect(toRoleResponse(row)).toEqual({
			id: "r-1",
			name: "Editor",
			description: null,
			isActive: true,
			parentId: null,
			isDeleted: false,
			deletedAt: null,
			createdAt: EPOCH,
			updatedAt: EPOCH,
		});
	});

	it("maps a Permission row including scope and nested policy conditions", () => {
		const row: Permission = {
			id: "p-1",
			action: "UPDATE",
			resource: "PRODUCT",
			description: "Edit products",
			scope: "ORGANIZATION",
			group: "catalog",
			isSystem: false,
			conditions: { all: [{ field: "ownerId", op: "eq", value: "$subject.id" }] },
			isDeleted: true,
			deletedAt: BigInt(EPOCH),
			createdAt: BigInt(EPOCH),
			updatedAt: BigInt(EPOCH),
		};

		expect(toAdminPermissionResponse(row)).toEqual({
			id: "p-1",
			action: "UPDATE",
			resource: "PRODUCT",
			description: "Edit products",
			scope: "ORGANIZATION",
			group: "catalog",
			isSystem: false,
			conditions: { all: [{ field: "ownerId", op: "eq", value: "$subject.id" }] },
			isDeleted: true,
			deletedAt: EPOCH,
			createdAt: EPOCH,
			updatedAt: EPOCH,
		});
	});
});
