import { z } from "zod";

import { BaseResponseSchema, DateStringSchema } from "../api/common";
import { PermissionActionSchema, PermissionResourceSchema } from "../domain/enums";

/**
 * A single permission entry — action + resource pair with metadata.
 */
export const PermissionDetailsSchema = z
	.object({
		id: z.string(),
		action: PermissionActionSchema,
		resource: PermissionResourceSchema,
		description: z.string().nullable(),
	})
	.strict();

export type PermissionDetailsResponse = z.output<typeof PermissionDetailsSchema>;

/**
 * A slim role shape (without nested permissions).
 */
export const SlimRoleSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		description: z.string().nullable(),
	})
	.strict();

export type SlimRoleResponse = z.output<typeof SlimRoleSchema>;

/**
 * Full user response — includes base fields (createdAt, updatedAt, isDeleted, deletedAt).
 */
export const UserResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	email: z.string(),
	fullName: z.string(),
	isActive: z.boolean(),
	isSuperAdmin: z.boolean(),
	isEmailVerified: z.boolean(),
	hasAdminAccess: z.boolean().meta({
		description: "Whether the user can access the admin panel",
	}),
	roles: z.array(SlimRoleSchema),
	permissions: z.array(PermissionDetailsSchema),
}).strict();

export type UserResponse = z.output<typeof UserResponseSchema>;

/**
 * Profile update schema — used when a user updates their own profile.
 */
export const UpdateProfileSchema = z
	.object({
		fullName: z.string().min(2, "Full name must be at least 2 characters").max(100, "Full name must be at most 100 characters").optional().meta({
			description: "User's full name",
			example: "Jane Doe",
		}),
	})
	.strict();

export type UpdateProfileInput = z.output<typeof UpdateProfileSchema>;

/**
 * Admin user update schema — extends profile update with role assignment and account status.
 */
export const UpdateUserSchema = UpdateProfileSchema.extend({
	roleNames: z
		.array(z.string())
		.optional()
		.meta({
			description: "List of role names to assign to the user",
			example: ["Admin", "Manager"],
		}),
	isActive: z.boolean().optional().meta({
		description: "Whether the user account is active",
	}),
}).strict();

export type UpdateUserInput = z.output<typeof UpdateUserSchema>;

/**
 * Admin-only user detail schema — extends UserResponseSchema with internal
 * security fields that should NOT be exposed to regular users or API clients.
 *
 * Includes:
 * - `failedLoginAttempts`: Number of consecutive failed login attempts
 * - `lockedUntil`: When the account lockout expires (null = not locked)
 *
 * This schema should ONLY be used for SuperAdmin/Admin endpoints where the
 * caller has explicit permission to view account security state.
 */
export const AdminUserDetailSchema = UserResponseSchema.extend({
	failedLoginAttempts: z.number().int().min(0).meta({
		description: "Number of consecutive failed login attempts",
		example: 0,
	}),
	lockedUntil: DateStringSchema.nullable().meta({
		description: "ISO-8601 timestamp when the account lockout expires (null = not locked)",
		example: null,
	}),
}).strict();

export type AdminUserDetail = z.output<typeof AdminUserDetailSchema>;

/**
 * Message response for user deletion / profile operations.
 */
export const UserMessageResponseSchema = z
	.object({
		message: z.string().meta({
			description: "Status message about the user operation",
			example: "User deleted successfully",
		}),
	})
	.strict();

export type UserMessageResponse = z.output<typeof UserMessageResponseSchema>;
