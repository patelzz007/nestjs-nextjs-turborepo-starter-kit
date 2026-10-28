import { z } from "zod";

import { PermissionScopeSchema } from "../../../authorization/policy-dsl.schema";
import { BaseResponseSchema } from "../../../schemas/api/common";
import { defineListQuery, LIST_MAX_LIMIT, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { PermissionActionSchema, PermissionResourceSchema } from "./permission-enums";

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

/**
 * CreatePermission with an optional group. `isSystem` is server-controlled
 * (only the code registry sync creates system permissions), so the strict
 * schema rejects it.
 */
export const CreatePermissionExtendedSchema = CreatePermissionSchema.extend({
	group: z.string().optional().meta({
		description: "Permission group/category",
		example: "User Management",
	}),
}).strict();

export type CreatePermissionExtendedInput = z.output<typeof CreatePermissionExtendedSchema>;

export const PermissionUpdateSchema = z
	.object({
		description: z.string().optional().meta({
			description: "Updated permission description",
		}),
		group: z.string().optional().meta({
			description: "Updated permission group",
		}),
	})
	.strict();

export type PermissionUpdateInput = z.output<typeof PermissionUpdateSchema>;

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

// ── Responses ────────────────────────────────────────────────────────────────
// Response schemas are open (strip unknown keys, never reject — ADR 022).
// `BaseResponseSchema` is strict, so its `shape` is spread into a fresh object.

/** Slim permission row returned by `GET /admin/permissions`. */
export const PermissionListItemSchema = z.object({
	id: z.string(),
	action: PermissionActionSchema,
	resource: PermissionResourceSchema,
	description: z.string().nullable(),
	group: z.string().nullable(),
	isSystem: z.boolean(),
});

export type PermissionListItem = z.output<typeof PermissionListItemSchema>;

/**
 * `GET /admin/permissions` list query — ordered by group, then resource and action, so a page holds whole
 * groups for the grouped tree; `search` matches the description, `filter[group]` / `filter[resource]` narrow it.
 * Pages are as large as the grammar allows: the tree reads best with every group of a page in view.
 * Offset pages only (the default order is not a timestamp).
 */
export const permissionListQuery = defineListQuery({
	sortable: ["group", "resource", "action", "createdAt"],
	defaultSort: [
		{ field: "group", direction: "asc" },
		{ field: "resource", direction: "asc" },
		{ field: "action", direction: "asc" },
	],
	filter: {
		group: listFilter.string({ eq: true }),
		resource: listFilter.enumeration(PermissionResourceSchema, { eq: true, in: true }),
	},
	params: { search: ListSearchSchema },
	defaultLimit: LIST_MAX_LIMIT,
});

export const PermissionListQuerySchema = permissionListQuery.schema;

export type PermissionListQuery = z.output<typeof PermissionListQuerySchema>;

export type PermissionListSortField = (typeof permissionListQuery.sortable)[number];

/** Slim role reference (id + name only). */
const RoleRefSchema = z.object({
	id: z.string(),
	name: z.string(),
});

/** Slim user reference for RBAC responses. */
const UserRefSchema = z.object({
	id: z.string(),
	fullName: z.string(),
	email: z.string(),
});

/** Permission with role and user assignments. */
export const PermissionResponseSchema = z.object({
	...BaseResponseSchema.shape,
	id: z.string(),
	action: PermissionActionSchema,
	resource: PermissionResourceSchema,
	description: z.string().nullable(),
	group: z.string().nullable(),
	isSystem: z.boolean(),
	rolePermissions: z.array(z.object({ role: RoleRefSchema })).optional(),
	userPermissions: z.array(z.object({ user: UserRefSchema })).optional(),
});

export type PermissionResponse = z.output<typeof PermissionResponseSchema>;

/** Minimal permission created response. */
export const PermissionCreatedResponseSchema = z.object({
	...BaseResponseSchema.shape,
	id: z.string(),
	action: PermissionActionSchema,
	resource: PermissionResourceSchema,
	description: z.string().nullable(),
	group: z.string().nullable(),
	isSystem: z.boolean(),
});

export type PermissionCreatedResponse = z.output<typeof PermissionCreatedResponseSchema>;

/** Permission as the `/admin/permissions` CRUD routes answer it: the created shape plus its `scope`. */
export const AdminPermissionResponseSchema = PermissionCreatedResponseSchema.extend({
	scope: PermissionScopeSchema,
});

export type AdminPermissionResponse = z.output<typeof AdminPermissionResponseSchema>;

/** `GET /admin/permissions/groups/list` payload — distinct permission group names. */
export const PermissionGroupsResponseSchema = z.object({
	groups: z.array(z.string()),
});

export type PermissionGroupsResponse = z.output<typeof PermissionGroupsResponseSchema>;

/** Single field change entry for audit / dry-run previews. */
export const PermissionChangeSchema = z.object({
	field: z.string(),
	from: z.string().nullable(),
	to: z.string().nullable(),
});

/** Updated permission result. */
export const PermissionUpdatedResponseSchema = z.object({
	...BaseResponseSchema.shape,
	id: z.string(),
	action: PermissionActionSchema,
	resource: PermissionResourceSchema,
	description: z.string().nullable(),
	group: z.string().nullable(),
	isSystem: z.boolean(),
});

export type PermissionUpdatedResponse = z.output<typeof PermissionUpdatedResponseSchema>;

/** Dry-run preview result. */
export const PermissionPreviewResponseSchema = z.object({
	permission: z.object({
		id: z.string(),
		action: PermissionActionSchema,
		resource: PermissionResourceSchema,
		description: z.string().nullable(),
		group: z.string().nullable(),
		isSystem: z.boolean(),
	}),
	dryRun: z.boolean(),
	changes: z.array(PermissionChangeSchema),
});

export type PermissionPreviewResponse = z.output<typeof PermissionPreviewResponseSchema>;

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

/** Grant info — how a permission was obtained. */
export const GrantInfoSchema = z.object({
	via: z.string(),
	detail: z.string().optional(),
});

/** Check permission result. */
export const CheckPermissionResponseSchema = z.object({
	allowed: z.boolean(),
	grants: z.array(GrantInfoSchema),
});

export type CheckPermissionResponse = z.output<typeof CheckPermissionResponseSchema>;
