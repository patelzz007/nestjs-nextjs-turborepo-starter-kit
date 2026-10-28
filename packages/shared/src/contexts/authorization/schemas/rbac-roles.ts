import { z } from "zod";

import { BaseResponseSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { PermissionDetailsSchema } from "../../identity/schemas/user";
import { RoleKindSchema } from "./permission-enums";

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

// ── Responses ────────────────────────────────────────────────────────────────
// Response schemas are open (strip unknown keys, never reject — ADR 022): the
// API strips internal fields and clients tolerate additive ones. Shared shapes
// that are strict elsewhere (`BaseResponseSchema`, `PermissionDetailsSchema`)
// are re-opened by spreading their `shape` into a fresh `z.object`.

/** Slim role row returned by `GET /admin/roles`. */
export const RoleListItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
	/** `PLATFORM` (assignable to staff) or `TEMPLATE` (the code-defined start of every tenant's role, read-only here). */
	kind: RoleKindSchema,
});

export type RoleListItem = z.output<typeof RoleListItemSchema>;

/**
 * `GET /admin/roles` list query — roles by name; `search` matches the name, `filter[isActive]` keeps the
 * assignable ones. Offset pages only (the default order is by name, not a timestamp).
 */
export const roleListQuery = defineListQuery({
	sortable: ["name", "createdAt"],
	defaultSort: [{ field: "name", direction: "asc" }],
	filter: {
		isActive: listFilter.boolean({ eq: true }),
	},
	params: { search: ListSearchSchema },
});

export const RoleListQuerySchema = roleListQuery.schema;

export type RoleListQuery = z.output<typeof RoleListQuerySchema>;

export type RoleListSortField = (typeof roleListQuery.sortable)[number];

/** Slim user reference for RBAC responses. */
const UserRefSchema = z.object({
	id: z.string(),
	fullName: z.string(),
	email: z.string(),
});

/** Role with parent/children refs, permission assignments, and user assignments. */
export const RoleResponseSchema = z.object({
	...BaseResponseSchema.shape,
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
	isSystem: z.boolean().optional(),
	rolePermissions: z.array(z.object({ permission: z.object(PermissionDetailsSchema.shape) })).optional(),
	userRoles: z.array(z.object({ user: UserRefSchema })).optional(),
	_count: z.object({ userRoles: z.number(), rolePermissions: z.number() }).optional(),
});

export type RoleResponse = z.output<typeof RoleResponseSchema>;

/** Minimal role created response. */
export const RoleCreatedResponseSchema = z.object({
	...BaseResponseSchema.shape,
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
});

export type RoleCreatedResponse = z.output<typeof RoleCreatedResponseSchema>;

/** `POST /admin/roles/:id/validate-assignment` payload — conflicts answer with an error instead. */
export const RoleAssignmentValidationResponseSchema = z.object({
	valid: z.boolean(),
	message: z.string(),
});

export type RoleAssignmentValidationResponse = z.output<typeof RoleAssignmentValidationResponseSchema>;

/** `POST /admin/roles/preview` payload — roles / permission keys (`ACTION:RESOURCE`) a user would gain or lose if their role set were replaced. */
export const RoleAssignmentPreviewSchema = z.object({
	currentRoles: z.array(z.string()),
	newRoles: z.array(z.string()),
	roleAdded: z.array(z.string()),
	roleRemoved: z.array(z.string()),
	permissionsGained: z.array(z.string()),
	permissionsLost: z.array(z.string()),
});

export type RoleAssignmentPreview = z.output<typeof RoleAssignmentPreviewSchema>;
