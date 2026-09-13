import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { PermissionActionSchema, PermissionResourceSchema } from "../platform/enums";

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

/** Single permission entry in inspector output. */
export const InspectPermissionEntrySchema = z
	.object({
		action: z.string(),
		resource: z.string(),
		via: z.string(),
		expiresAt: EpochMsSchema.nullable().optional(),
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
					assignedAt: EpochMsSchema,
				}),
			)
			.optional(),
		error: z.string().optional(),
	})
	.strict();

export type FindPermissionOwnersResponse = z.output<typeof FindPermissionOwnersResponseSchema>;
