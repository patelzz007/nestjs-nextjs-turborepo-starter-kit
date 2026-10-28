import { AdminPermissionResponseSchema, epochMs, RoleResponseSchema, type AdminPermissionResponse, type RoleResponse } from "@workspace/shared";

import type { PermissionState } from "../../domain/aggregates/permission.aggregate";
import type { RoleState } from "../../domain/aggregates/role.aggregate";

/** A stored permission → the admin wire contract (same fields the raw row always exposed). */
export function toAdminPermissionResponse(state: PermissionState): AdminPermissionResponse {
	return AdminPermissionResponseSchema.parse({
		id: state.id,
		action: state.action,
		resource: state.resource,
		description: state.description,
		scope: state.scope,
		group: state.group,
		isSystem: state.isSystem,
		isDeleted: state.isDeleted,
		deletedAt: state.deletedAt === null ? null : epochMs(state.deletedAt),
		createdAt: epochMs(state.createdAt),
		updatedAt: epochMs(state.updatedAt),
	});
}

/** A stored role → the shared `RoleResponse` contract. */
export function toRoleResponse(state: RoleState): RoleResponse {
	return RoleResponseSchema.parse({
		id: state.id,
		name: state.name,
		description: state.description,
		isActive: state.isActive,
		isSystem: state.isSystem,
		isDeleted: state.isDeleted,
		deletedAt: state.deletedAt === null ? null : epochMs(state.deletedAt),
		createdAt: epochMs(state.createdAt),
		updatedAt: epochMs(state.updatedAt),
	});
}
