import { z } from "zod";

import { PermissionActionSchema, PermissionResourceSchema } from "../platform/enums";

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

/** Slim role reference (id + name only). */
const RoleRefSchema = z
	.object({
		id: z.string(),
		name: z.string(),
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
