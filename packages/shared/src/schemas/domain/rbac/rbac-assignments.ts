import { z } from "zod";

import { EpochMsSchema } from "../../api/common";

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
		expiresAt: EpochMsSchema.optional().meta({
			description: "Optional epoch-ms timestamp when the grant expires",
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

/** Sync all direct permissions for a user (replaces existing). */
export const SyncUserPermissionsSchema = z
	.object({
		userId: z.uuid().meta({
			description: "User ID",
		}),
		permissionIds: z.array(z.uuid()).meta({
			description: "Complete list of permission IDs the user should have",
		}),
	})
	.strict();

export type SyncUserPermissionsInput = z.output<typeof SyncUserPermissionsSchema>;

/** Sync all roles for a user (replaces existing direct assignments). */
export const SyncUserRolesSchema = z
	.object({
		userId: z.uuid().meta({
			description: "User ID",
		}),
		roleIds: z.array(z.uuid()).meta({
			description: "Complete list of role IDs the user should have",
		}),
	})
	.strict();

export type SyncUserRolesInput = z.output<typeof SyncUserRolesSchema>;

/** Body for role assignment validation / preview. */
export const ValidateRoleAssignmentSchema = z
	.object({
		userId: z.uuid().meta({
			description: "User ID to validate assignment for",
		}),
		roleIds: z.array(z.uuid()).meta({
			description: "Role IDs to simulate assigning",
		}),
	})
	.strict();

export type ValidateRoleAssignmentInput = z.output<typeof ValidateRoleAssignmentSchema>;

export const AssignPermissionsToUserBulkSchema = z
	.object({
		permissionIds: z.array(z.uuid()).min(1).meta({
			description: "List of permission IDs to assign",
		}),
		expiresAt: EpochMsSchema.optional().meta({
			description: "Epoch milliseconds when the grants expire",
			example: 1786300000000,
		}),
	})
	.strict();

export type AssignPermissionsToUserBulkInput = z.output<typeof AssignPermissionsToUserBulkSchema>;
