import type { Permission, Role } from "@prisma/client";
import { JsonValueSchema } from "@workspace/shared";

import { PermissionAggregate, type PermissionState } from "../../domain/aggregates/permission.aggregate";
import { RoleAggregate, type RoleState } from "../../domain/aggregates/role.aggregate";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** A `Role` row as domain state (bigint epochs → numbers). */
export function roleStateOf(row: Role): RoleState {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		isActive: row.isActive,
		isSystem: row.isSystem,
		parentId: row.parentId,
		isDeleted: row.isDeleted,
		deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

export function roleAggregateOf(row: Role): RoleAggregate {
	return RoleAggregate.rehydrate(roleStateOf(row));
}

/** A `Permission` row as domain state. Stored ABAC conditions that are not JSON are corrupt, never loaded silently. */
export function permissionStateOf(row: Permission): PermissionState {
	const conditions = JsonValueSchema.nullable().safeParse(row.conditions);
	if (!conditions.success) {
		throw new CorruptAggregateStateError("Permission", row.id);
	}
	return {
		id: row.id,
		action: row.action,
		resource: row.resource,
		scope: row.scope,
		description: row.description,
		group: row.group,
		isSystem: row.isSystem,
		conditions: conditions.data,
		isDeleted: row.isDeleted,
		deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

export function permissionAggregateOf(row: Permission): PermissionAggregate {
	return PermissionAggregate.rehydrate(permissionStateOf(row));
}
