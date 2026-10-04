import type { Permission, Role } from "@prisma/client";
import { AdminPermissionResponseSchema, epochMs, RoleResponseSchema, type AdminPermissionResponse, type RoleResponse } from "@workspace/shared";

/** Prisma `Permission` row → wire contract (bigint epochs → numbers). Same fields the raw row exposed. */
export function toAdminPermissionResponse(row: Permission): AdminPermissionResponse {
	return AdminPermissionResponseSchema.parse({
		id: row.id,
		action: row.action,
		resource: row.resource,
		description: row.description,
		scope: row.scope,
		group: row.group,
		isSystem: row.isSystem,
		conditions: row.conditions,
		isDeleted: row.isDeleted,
		deletedAt: row.deletedAt === null ? null : epochMs(Number(row.deletedAt)),
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	});
}

/** Prisma `Role` row → shared `RoleResponse` contract (bigint epochs → numbers). */
export function toRoleResponse(row: Role): RoleResponse {
	return RoleResponseSchema.parse({
		id: row.id,
		name: row.name,
		description: row.description,
		isActive: row.isActive,
		isSystem: row.isSystem,
		parentId: row.parentId,
		isDeleted: row.isDeleted,
		deletedAt: row.deletedAt === null ? null : epochMs(Number(row.deletedAt)),
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	});
}
