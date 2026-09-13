import { z } from "zod";

import { BaseResponseSchema } from "../../api/common";
import { PermissionActionSchema, PermissionResourceSchema } from "../platform/enums";

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

/** Slim permission row returned by `GET /admin/permissions`. */
export const PermissionListItemSchema = z
	.object({
		id: z.string(),
		action: PermissionActionSchema,
		resource: PermissionResourceSchema,
		description: z.string().nullable(),
		group: z.string().nullable(),
		isSystem: z.boolean(),
	})
	.strict();

export type PermissionListItem = z.output<typeof PermissionListItemSchema>;

export const PermissionListResponseSchema = z
	.object({
		items: z.array(PermissionListItemSchema),
		total: z.number().int().nonnegative(),
	})
	.strict();

export type PermissionListResponse = z.output<typeof PermissionListResponseSchema>;

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
