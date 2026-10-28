import type { Permission, Role } from "@prisma/client";

import { PermissionAggregate, type PermissionState } from "../../domain/aggregates/permission.aggregate";
import { RoleAggregate, type RoleState } from "../../domain/aggregates/role.aggregate";

/** A `Role` row as domain state (bigint epochs → numbers). */
export function roleStateOf(row: Role): RoleState {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		isActive: row.isActive,
		isSystem: row.isSystem,
		isDeleted: row.isDeleted,
		deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

export function roleAggregateOf(row: Role): RoleAggregate {
	return RoleAggregate.rehydrate(roleStateOf(row));
}

/** A `Permission` row as domain state. */
export function permissionStateOf(row: Permission): PermissionState {
	return {
		id: row.id,
		action: row.action,
		resource: row.resource,
		scope: row.scope,
		description: row.description,
		group: row.group,
		isSystem: row.isSystem,
		isDeleted: row.isDeleted,
		deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

export function permissionAggregateOf(row: Permission): PermissionAggregate {
	return PermissionAggregate.rehydrate(permissionStateOf(row));
}
