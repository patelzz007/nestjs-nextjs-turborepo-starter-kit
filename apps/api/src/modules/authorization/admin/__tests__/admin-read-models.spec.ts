import type { Permission, PermissionAuditLog, Role } from "@prisma/client";
import { LIST_SLOT_INDEX, AuditLogQuerySchema } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../../common/context/request-context";
import { PrismaService } from "../../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
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
		actorKind: "USER",
		actorId: "user-actor",
		targetUserId: "user-target",
		targetRoleId: null,
		permissionId: null,
		action: "ROLE_ASSIGNED",
		detail: "Assigned Editor",
		correlationId: "corr-1",
		impersonatorId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(EPOCH),
		updatedAt: BigInt(EPOCH),
		...overrides,
	};
}

function buildRoleRow(overrides: Partial<Role> & Pick<Role, "id" | "name" | "parentId">): Role {
	return {
		description: null,
		isActive: true,
		isSystem: false,
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

		const page = await new PermissionAuditLogRepository().list(query, prisma);

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

		await new PermissionAuditLogRepository().list(AuditLogQuerySchema.parse({}), prisma);

		expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [{ isDeleted: false }] }, skip: 0 }));
	});
});

describe("PermissionAuditLogQueryService", () => {
	it("reads the bypass-only table under the allowlisted audit-read system operation and maps rows to the AuditLogEntry contract", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const tenantTx = new TenantTransactionService(prisma, new RequestContextService());
		const withSystemOperation = vi.spyOn(tenantTx, "withSystemOperation").mockImplementation(async (_context, handler) => handler(prisma));
		const repository = new PermissionAuditLogRepository();
		const list = vi
			.spyOn(repository, "list")
			.mockResolvedValue({ items: [buildAuditRow()], total: 41, page: 3, totalPages: 3, nextCursor: null, hasNext: false, hasPrevious: true });
		const query = AuditLogQuerySchema.parse({ page: "3", limit: "20" });

		const result = await new PermissionAuditLogQueryService(repository, tenantTx).list(ACTOR_ID, query);

		expect(withSystemOperation).toHaveBeenCalledWith(expect.objectContaining({ operation: "authorization.audit_log.read", actorUserId: ACTOR_ID }), expect.any(Function));
		expect(list).toHaveBeenCalledWith(query, prisma);
		expect(result).toEqual({
			items: [
				{
					id: "log-1",
					actor: { kind: "USER", userId: "user-actor", impersonatorId: null },
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

	it("maps the stored actor to the contract union: a user (with impersonator) or an allowlisted system operation", () => {
		expect(toAuditLogEntry(buildAuditRow({ impersonatorId: "root-1" })).actor).toEqual({ kind: "USER", userId: "user-actor", impersonatorId: "root-1" });
		expect(toAuditLogEntry(buildAuditRow({ actorKind: "SYSTEM_OPERATION", actorId: "maintenance.permission_expiry", action: "PERMISSION_EXPIRED" })).actor).toEqual({
			kind: "SYSTEM_OPERATION",
			operation: "maintenance.permission_expiry",
		});
		expect(toAuditLogEntry(buildAuditRow())).not.toHaveProperty("actorId");
	});

	it("does not expose internal soft-delete columns", () => {
		expect(toAuditLogEntry(buildAuditRow())).not.toHaveProperty("isDeleted");
	});
});

describe("RolePermissionPreviewRepository", () => {
	it("returns an empty set without querying when no role ids are given", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const findMany = vi.spyOn(prisma.role, "findMany");

		await expect(new RolePermissionPreviewRepository().findEffectiveRoleSet([], prisma)).resolves.toEqual({ roleNames: [], permissionKeys: [] });
		expect(findMany).not.toHaveBeenCalled();
	});

	it("includes permissions inherited from live, active ancestors", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const findRoles = vi
			.spyOn(prisma.role, "findMany")
			.mockResolvedValueOnce([buildRoleRow({ id: "r-editor", name: "Editor", parentId: "r-viewer" })])
			.mockResolvedValueOnce([buildRoleRow({ id: "r-viewer", name: "Viewer", parentId: null })]);
		const findRolePermissions = vi.spyOn(prisma.rolePermission, "findMany").mockResolvedValue([]);

		await new RolePermissionPreviewRepository().findEffectiveRoleSet(["r-editor"], prisma);

		expect(findRoles.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]?.where).toEqual({ id: { in: ["r-editor"] }, isDeleted: false, isActive: true });
		expect(findRoles.mock.calls[LIST_SLOT_INDEX.second]?.[LIST_SLOT_INDEX.first]?.where).toEqual({ id: { in: ["r-viewer"] }, isDeleted: false, isActive: true });
		expect(findRolePermissions.mock.lastCall?.[LIST_SLOT_INDEX.first]?.where).toEqual({
			roleId: { in: ["r-editor", "r-viewer"] },
			isDeleted: false,
			permission: { isDeleted: false },
		});
	});
});

describe("RoleAssignmentPreviewService", () => {
	/**
	 * Corrected behaviour (the previous test encoded the under-reporting bug):
	 * the proposed side used to count only the proposed roles' OWN permissions
	 * — no inherited ones, no surviving direct grants, no DENY overrides — so
	 * escalation through a parent role never showed up as "gained".
	 */
	it("diffs effective permissions: inherited grants count, direct ALLOWs survive, DENY overrides are subtracted", async () => {
		const prisma = new PrismaService(createTestTypedConfig());
		const tenantTx = new TenantTransactionService(prisma, new RequestContextService());
		const withSystemOperation = vi.spyOn(tenantTx, "withSystemOperation").mockImplementation(async (_context, handler) => handler(prisma));
		const repository = new RolePermissionPreviewRepository();
		vi.spyOn(repository, "findAssignedRoleIds").mockResolvedValue(["r-viewer"]);
		vi.spyOn(repository, "findEffectiveRoleSet").mockImplementation((roleIds: readonly string[]) =>
			Promise.resolve(
				roleIds.includes("r-viewer")
					? { roleNames: ["Viewer"], permissionKeys: ["READ:PRODUCT", "LIST:PRODUCT"] }
					: // Editor inherits MANAGE:SYSTEM_SETTINGS from its parent role.
						{ roleNames: ["Editor"], permissionKeys: ["READ:PRODUCT", "UPDATE:PRODUCT", "MANAGE:SYSTEM_SETTINGS", "DELETE:PRODUCT"] },
			),
		);
		vi.spyOn(repository, "findDirectOverrideKeys").mockResolvedValue({ allow: ["READ:REPORT"], deny: ["DELETE:PRODUCT"] });

		const preview = await new RoleAssignmentPreviewService(repository, tenantTx).preview(ACTOR_ID, "user-1", ["r-editor"]);

		expect(withSystemOperation).toHaveBeenCalledWith(expect.objectContaining({ operation: "authorization.rbac.inspect", actorUserId: ACTOR_ID }), expect.any(Function));
		expect(preview).toEqual({
			currentRoles: ["Viewer"],
			newRoles: ["Editor"],
			roleAdded: ["Editor"],
			roleRemoved: ["Viewer"],
			permissionsGained: ["UPDATE:PRODUCT", "MANAGE:SYSTEM_SETTINGS"],
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
			isSystem: false,
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
			isSystem: false,
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
