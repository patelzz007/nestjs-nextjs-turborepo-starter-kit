import { z } from "zod";

import { BaseResponseSchema, DateStringSchema } from "../api/common";
import { PermissionActionSchema, PermissionResourceSchema } from "./enums";
import { PermissionDetailsSchema } from "../auth/user";

export const CreateRoleSchema = z
	.object({
		name: z.string().max(100).meta({
			description: "Role name",
			example: "Editor",
		}),
		description: z.string().optional().meta({
			description: "Role description",
			example: "Can edit content",
		}),
	})
	.strict();

export type CreateRoleInput = z.output<typeof CreateRoleSchema>;

export const CreatePermissionSchema = z
	.object({
		action: PermissionActionSchema.meta({
			description: "The action this permission grants",
			example: "READ",
		}),
		resource: PermissionResourceSchema.meta({
			description: "The resource this permission applies to",
			example: "USER",
		}),
		description: z.string().optional().meta({
			description: "Permission description",
			example: "View user details",
		}),
	})
	.strict();

export type CreatePermissionInput = z.output<typeof CreatePermissionSchema>;

export const AssignRoleToUserSchema = z
	.object({
		userId: z.uuid().meta({
			description: "User ID",
			example: "550e8400-e29b-41d4-a716-446655440000",
		}),
		roleId: z.uuid().meta({
			description: "Role ID",
			example: "550e8400-e29b-41d4-a716-446655440001",
		}),
	})
	.strict();

export type AssignRoleToUserInput = z.output<typeof AssignRoleToUserSchema>;

export const AssignPermissionToUserSchema = z
	.object({
		userId: z.uuid().meta({
			description: "User ID",
		}),
		permissionId: z.uuid().meta({
			description: "Permission ID",
		}),
	})
	.strict();

export type AssignPermissionToUserInput = z.output<typeof AssignPermissionToUserSchema>;

export const AssignPermissionToRoleSchema = z
	.object({
		roleId: z.uuid().meta({
			description: "Role ID",
		}),
		permissionId: z.uuid().meta({
			description: "Permission ID",
		}),
	})
	.strict();

export type AssignPermissionToRoleInput = z.output<typeof AssignPermissionToRoleSchema>;

// ── Extended schemas for RBAC controller endpoints ──────────────────────────

/** CreateRole with optional parentId */
export const CreateRoleExtendedSchema = CreateRoleSchema.extend({
	parentId: z.uuid().optional().meta({
		description: "Parent role ID for role hierarchy",
	}),
}).strict();

export type CreateRoleExtendedInput = z.output<typeof CreateRoleExtendedSchema>;

/** CreatePermission with optional group and isSystem */
export const CreatePermissionExtendedSchema = CreatePermissionSchema.extend({
	group: z.string().optional().meta({
		description: "Permission group/category",
		example: "User Management",
	}),
	isSystem: z.boolean().optional().meta({
		description: "Whether this is a system permission",
	}),
}).strict();

export type CreatePermissionExtendedInput = z.output<typeof CreatePermissionExtendedSchema>;

// ── Bulk operations ──────────────────────────────────────────────────────────

export const BulkAssignPermissionsSchema = z
	.object({
		permissionIds: z
			.array(z.uuid())
			.min(1)
			.meta({
				description: "List of permission IDs to assign or remove",
				example: ["550e8400-e29b-41d4-a716-446655440000"],
			}),
	})
	.strict();

export type BulkAssignPermissionsInput = z.output<typeof BulkAssignPermissionsSchema>;

export const BulkAssignRolesSchema = z
	.object({
		roleIds: z
			.array(z.uuid())
			.min(1)
			.meta({
				description: "List of role IDs to assign or remove",
				example: ["550e8400-e29b-41d4-a716-446655440001"],
			}),
	})
	.strict();

export type BulkAssignRolesInput = z.output<typeof BulkAssignRolesSchema>;

// ── Assign permissions to user (bulk with optional expiry) ───────────────────

export const AssignPermissionsToUserBulkSchema = z
	.object({
		permissionIds: z.array(z.uuid()).min(1).meta({
			description: "List of permission IDs to assign",
		}),
		expiresAt: DateStringSchema.optional().meta({
			description: "ISO date string for when the grants expire",
			example: "2027-01-01T00:00:00.000Z",
		}),
	})
	.strict();

export type AssignPermissionsToUserBulkInput = z.output<typeof AssignPermissionsToUserBulkSchema>;

// ── Check permission ─────────────────────────────────────────────────────────

export const CheckPermissionSchema = z
	.object({
		userId: z.uuid().meta({
			description: "User ID to check permissions for",
		}),
		action: PermissionActionSchema.meta({
			description: "The action to check",
		}),
		resource: PermissionResourceSchema.meta({
			description: "The resource to check against",
		}),
	})
	.strict();

export type CheckPermissionInput = z.output<typeof CheckPermissionSchema>;

// ── Set role parent ──────────────────────────────────────────────────────────

export const SetRoleParentSchema = z
	.object({
		parentId: z.uuid().nullable().meta({
			description: "New parent role ID (null to remove parent)",
		}),
	})
	.strict();

export type SetRoleParentInput = z.output<typeof SetRoleParentSchema>;

// ── Filters (query params) ───────────────────────────────────────────────────

export const RoleFilterSchema = z
	.object({
		search: z.string().optional().meta({
			description: "Search term for role name or description",
		}),
		isActive: z.coerce.boolean().optional().meta({
			description: "Filter by active status",
		}),
		page: z.coerce.number().int().min(1).optional().default(1).meta({
			description: "Page number (1-based)",
		}),
		limit: z.coerce.number().int().min(1).max(100).optional().default(20).meta({
			description: "Results per page",
		}),
	})
	.strict();

export type RoleFilterInput = z.output<typeof RoleFilterSchema>;

export const PermissionFilterSchema = z
	.object({
		search: z.string().optional().meta({
			description: "Search term for permission description or group",
		}),
		resource: z.array(PermissionResourceSchema).optional().meta({
			description: "Filter by resource(s)",
		}),
		action: z.array(PermissionActionSchema).optional().meta({
			description: "Filter by action(s)",
		}),
		group: z.string().optional().meta({
			description: "Filter by permission group",
		}),
		isSystem: z.coerce.boolean().optional().meta({
			description: "Filter by system permission status",
		}),
		page: z.coerce.number().int().min(1).optional().default(1).meta({
			description: "Page number (1-based)",
		}),
		limit: z.coerce.number().int().min(1).max(100).optional().default(20).meta({
			description: "Results per page",
		}),
	})
	.strict();

export type PermissionFilterInput = z.output<typeof PermissionFilterSchema>;

// ── Permission update (PATCH) ────────────────────────────────────────────────

const abacConditionValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const abacConditions = z.record(z.string(), abacConditionValue);

export const PermissionUpdateSchema = z
	.object({
		description: z.string().optional().meta({
			description: "Updated permission description",
		}),
		group: z.string().optional().meta({
			description: "Updated permission group",
		}),
		conditions: abacConditions.nullable().optional().meta({
			description: "ABAC conditions as JSON object (null to clear)",
		}),
		isSystem: z.boolean().optional().meta({
			description: "Whether this is a system permission",
		}),
	})
	.strict();

export type PermissionUpdateInput = z.output<typeof PermissionUpdateSchema>;

// ── Permission Group Management ─────────────────────────────────────────────

/** Schema for creating a new permission group */
export const CreateGroupSchema = z
	.object({
		name: z.string().min(1).max(100).meta({
			description: "Group name",
			example: "User Management",
		}),
		permissionIds: z
			.array(z.uuid())
			.optional()
			.meta({
				description: "Initial permission IDs to add to the group",
				example: ["uuid-1", "uuid-2"],
			}),
	})
	.strict();

export type CreateGroupInput = z.output<typeof CreateGroupSchema>;

/** Schema for renaming a permission group */
export const RenameGroupSchema = z
	.object({
		newName: z.string().min(1).max(100).meta({
			description: "New name for the group",
			example: "User Administration",
		}),
	})
	.strict();

export type RenameGroupInput = z.output<typeof RenameGroupSchema>;

// ── Audit log query ──────────────────────────────────────────────────────────

export const AuditLogQuerySchema = z
	.object({
		actorId: z.uuid().optional().meta({
			description: "Filter by actor ID",
		}),
		targetUserId: z.uuid().optional().meta({
			description: "Filter by target user ID",
		}),
		targetRoleId: z.uuid().optional().meta({
			description: "Filter by target role ID",
		}),
		action: z.string().optional().meta({
			description: "Filter by action type",
		}),
		page: z.coerce.number().int().min(1).optional().default(1).meta({
			description: "Page number (1-based)",
		}),
		limit: z.coerce.number().int().min(1).max(100).optional().default(20).meta({
			description: "Results per page",
		}),
	})
	.strict();

export type AuditLogQueryInput = z.output<typeof AuditLogQuerySchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// RBAC Response Schemas
// ═══════════════════════════════════════════════════════════════════════════════

/** Standard message response for RBAC operations. */
export const RbacMessageResponseSchema = z
	.object({
		message: z.string().meta({
			description: "Status message about the RBAC operation",
			example: "Role assigned successfully",
		}),
	})
	.strict();

export type RbacMessageResponse = z.output<typeof RbacMessageResponseSchema>;

/** Slim role reference (id + name only). */
const RoleRefSchema = z
	.object({
		id: z.string(),
		name: z.string(),
	})
	.strict();

/** Slim user reference for RBAC responses. */
const UserRefSchema = z
	.object({
		id: z.string(),
		fullName: z.string(),
		email: z.string(),
	})
	.strict();

/** A permission's assigned roles and user count. */
const PermissionAssignmentSchema = z
	.object({
		id: z.string(),
		action: PermissionActionSchema,
		resource: PermissionResourceSchema,
		description: z.string().nullable(),
		isSystem: z.boolean(),
		conditions: z.nullable(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
		roles: z.array(RoleRefSchema),
		directUsers: z.number(),
	})
	.strict();

// ── Role List / Create ──────────────────────────────────────────────────────

/** Role with parent/children refs, permission assignments, and user assignments. */
export const RoleResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
	isSystem: z.boolean().optional(),
	parentId: z.string().nullable(),
	parent: RoleRefSchema.nullable().optional(),
	children: z.array(RoleRefSchema.extend({ isActive: z.boolean() })).optional(),
	rolePermissions: z.array(z.object({ permission: PermissionDetailsSchema })).optional(),
	userRoles: z.array(z.object({ user: UserRefSchema })).optional(),
	_count: z.object({ userRoles: z.number(), rolePermissions: z.number() }).optional(),
}).strict();

export type RoleResponse = z.output<typeof RoleResponseSchema>;

/** Minimal role created response. */
export const RoleCreatedResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	parentId: z.string().nullable(),
	isActive: z.boolean(),
}).strict();

export type RoleCreatedResponse = z.output<typeof RoleCreatedResponseSchema>;

// ── Permission List / Create ────────────────────────────────────────────────

/** Permission with role and user assignments. */
export const PermissionResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	action: PermissionActionSchema,
	resource: PermissionResourceSchema,
	description: z.string().nullable(),
	group: z.string().nullable(),
	isSystem: z.boolean(),
	conditions: z.nullable(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
	rolePermissions: z.array(z.object({ role: RoleRefSchema })).optional(),
	userPermissions: z.array(z.object({ user: UserRefSchema })).optional(),
}).strict();

export type PermissionResponse = z.output<typeof PermissionResponseSchema>;

/** Minimal permission created response. */
export const PermissionCreatedResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	action: PermissionActionSchema,
	resource: PermissionResourceSchema,
	description: z.string().nullable(),
	group: z.string().nullable(),
	isSystem: z.boolean(),
	conditions: z.nullable(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
}).strict();

export type PermissionCreatedResponse = z.output<typeof PermissionCreatedResponseSchema>;

// ── Permission Update ───────────────────────────────────────────────────────

/** Single field change entry for audit / dry-run previews. */
export const PermissionChangeSchema = z
	.object({
		field: z.string(),
		from: z.string().nullable(),
		to: z.string().nullable(),
	})
	.strict();

/** Updated permission result. */
export const PermissionUpdatedResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	action: PermissionActionSchema,
	resource: PermissionResourceSchema,
	description: z.string().nullable(),
	group: z.string().nullable(),
	isSystem: z.boolean(),
	conditions: z.nullable(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
}).strict();

export type PermissionUpdatedResponse = z.output<typeof PermissionUpdatedResponseSchema>;

/** Dry-run preview result. */
export const PermissionPreviewResponseSchema = z
	.object({
		permission: z.object({
			id: z.string(),
			action: PermissionActionSchema,
			resource: PermissionResourceSchema,
			description: z.string().nullable(),
			group: z.string().nullable(),
			isSystem: z.boolean(),
			conditions: z.nullable(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
		}),
		dryRun: z.boolean(),
		changes: z.array(PermissionChangeSchema),
	})
	.strict();

export type PermissionPreviewResponse = z.output<typeof PermissionPreviewResponseSchema>;

// ── Permission Check ────────────────────────────────────────────────────────

/** Grant info — how a permission was obtained. */
export const GrantInfoSchema = z
	.object({
		via: z.string(),
		detail: z.string().optional(),
	})
	.strict();

/** Check permission result. */
export const CheckPermissionResponseSchema = z
	.object({
		allowed: z.boolean(),
		grants: z.array(GrantInfoSchema),
	})
	.strict();

export type CheckPermissionResponse = z.output<typeof CheckPermissionResponseSchema>;

// ── My Permissions ──────────────────────────────────────────────────────────

export const MyPermissionsResponseSchema = z
	.object({
		isSuperAdmin: z.boolean(),
		roles: z.array(
			z.object({
				name: z.string(),
				description: z.string().nullable(),
			}),
		),
		permissions: z.array(
			z.object({
				action: PermissionActionSchema,
				resource: PermissionResourceSchema,
			}),
		),
		totalPermissions: z.number(),
	})
	.strict();

export type MyPermissionsResponse = z.output<typeof MyPermissionsResponseSchema>;

// ── Permission Matrix ───────────────────────────────────────────────────────

export const PermissionMatrixRowSchema = z
	.object({
		resource: PermissionResourceSchema,
		action: PermissionActionSchema,
		description: z.string().nullable(),
		group: z.string().nullable(),
		isSystem: z.boolean(),
		roles: z.array(
			z.object({
				name: z.string(),
				granted: z.boolean(),
				via: z.string().nullable(),
			}),
		),
	})
	.strict();

export const PermissionMatrixResponseSchema = z
	.object({
		actions: z.array(z.string()),
		resources: z.array(PermissionResourceSchema),
		rows: z.array(PermissionMatrixRowSchema),
	})
	.strict();

export type PermissionMatrixResponse = z.output<typeof PermissionMatrixResponseSchema>;

// ── Permission Inspector ────────────────────────────────────────────────────

/** Single permission entry in inspector output. */
export const InspectPermissionEntrySchema = z
	.object({
		action: z.string(),
		resource: z.string(),
		via: z.string(),
		expiresAt: DateStringSchema.nullable().optional(),
	})
	.strict();

/** Inspect user result. */
export const InspectUserResponseSchema = z
	.object({
		user: z
			.object({
				id: z.string(),
				email: z.string(),
				fullName: z.string(),
				isSuperAdmin: z.boolean(),
				isActive: z.boolean(),
			})
			.optional(),
		roles: z
			.array(
				z.object({
					name: z.string(),
					description: z.string().nullable(),
				}),
			)
			.optional(),
		totalPermissions: z.number().optional(),
		permissions: z.array(InspectPermissionEntrySchema).optional(),
		error: z.string().optional(),
	})
	.strict();

export type InspectUserResponse = z.output<typeof InspectUserResponseSchema>;

/** User entry in permission owner lookup. */
export const PermissionOwnerUserSchema = z
	.object({
		id: z.string(),
		email: z.string(),
		fullName: z.string(),
		isSuperAdmin: z.boolean(),
		via: z.array(z.string()),
	})
	.strict();

/** Permission owner lookup result. */
export const FindPermissionOwnersResponseSchema = z
	.object({
		permission: z.string().optional(),
		affectedUsers: z.number().optional(),
		users: z.array(PermissionOwnerUserSchema).optional(),
		rolesWithPermission: z
			.array(
				z.object({
					name: z.string(),
					assignedAt: DateStringSchema,
				}),
			)
			.optional(),
		error: z.string().optional(),
	})
	.strict();

export type FindPermissionOwnersResponse = z.output<typeof FindPermissionOwnersResponseSchema>;

// ── Audit Log ───────────────────────────────────────────────────────────────

/** Audit log entry. */
export const AuditLogEntrySchema = BaseResponseSchema.omit({ isDeleted: true, deletedAt: true })
	.extend({
		id: z.string(),
		actorId: z.string().nullable(),
		targetUserId: z.string().nullable(),
		targetRoleId: z.string().nullable(),
		permissionId: z.string().nullable(),
		action: z.string(),
		detail: z.string().nullable(),
	})
	.strict();

export type AuditLogEntry = z.output<typeof AuditLogEntrySchema>;

// ── Permission Group ────────────────────────────────────────────────────────

/** Group listing entry. */
export const GroupListEntrySchema = z
	.object({
		group: z.string(),
		permissionCount: z.number(),
		resources: z.array(z.string()),
	})
	.strict();

export type GroupListEntry = z.output<typeof GroupListEntrySchema>;

/** Group permissions result. */
export const GroupPermissionsResponseSchema = z
	.object({
		group: z.string(),
		permissionCount: z.number(),
		permissions: z.array(PermissionAssignmentSchema),
	})
	.strict();

export type GroupPermissionsResponse = z.output<typeof GroupPermissionsResponseSchema>;

/** Group operation result (create, rename, delete, assign). */
export const GroupOperationResponseSchema = z
	.object({
		group: z.string().optional(),
		affectedPermissions: z.number().optional(),
		assignedCount: z.number().optional(),
		message: z.string(),
	})
	.strict();

export type GroupOperationResponse = z.output<typeof GroupOperationResponseSchema>;

/** Permission entry type inside group permissions response. */
export type GroupPermissionEntry = z.output<typeof PermissionAssignmentSchema>;
