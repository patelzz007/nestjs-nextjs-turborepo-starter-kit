import { z } from "zod";

import { BaseResponseSchema } from "../../api/common";
import { PermissionDetailsSchema } from "../../auth/user";

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

/** CreateRole with optional parentId */
export const CreateRoleExtendedSchema = CreateRoleSchema.extend({
	parentId: z.uuid().optional().meta({
		description: "Parent role ID for role hierarchy",
	}),
}).strict();

export type CreateRoleExtendedInput = z.output<typeof CreateRoleExtendedSchema>;

/** Update role metadata (PATCH). */
export const UpdateRoleSchema = z
	.object({
		name: z.string().max(100).optional().meta({
			description: "Updated role name",
		}),
		description: z.string().optional().meta({
			description: "Updated role description",
		}),
		isActive: z.boolean().optional().meta({
			description: "Whether the role is active",
		}),
	})
	.strict();

export type UpdateRoleInput = z.output<typeof UpdateRoleSchema>;

export const SetRoleParentSchema = z
	.object({
		parentId: z.uuid().nullable().meta({
			description: "New parent role ID (null to remove parent)",
		}),
	})
	.strict();

export type SetRoleParentInput = z.output<typeof SetRoleParentSchema>;

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

/** Slim role row returned by `GET /admin/roles`. */
export const RoleListItemSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		description: z.string().nullable(),
		isActive: z.boolean(),
		parentId: z.string().nullable(),
	})
	.strict();

export type RoleListItem = z.output<typeof RoleListItemSchema>;

export const RoleListResponseSchema = z
	.object({
		items: z.array(RoleListItemSchema),
		total: z.number().int().nonnegative(),
	})
	.strict();

export type RoleListResponse = z.output<typeof RoleListResponseSchema>;

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
