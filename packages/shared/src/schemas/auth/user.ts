import { z } from "zod";

import { CapabilitySlugSchema } from "../domain/capabilities";
import { PaginationSchema } from "../api/pagination";

import { EpochMsSchema, BaseResponseSchema } from "../api/common";

// ── Shared role shape ──────────────────────────────────────────────────────

export const SlimRoleSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		description: z.string().nullable(),
	})
	.strict();

export type SlimRoleResponse = z.output<typeof SlimRoleSchema>;

// ── Permission detail shape ────────────────────────────────────────────────

export const PermissionDetailsSchema = z
	.object({
		id: z.string(),
		action: z.string(),
		resource: z.string(),
		description: z.string().nullable(),
		group: z.string().nullable(),
	})
	.strict();

export type PermissionDetailsResponse = z.output<typeof PermissionDetailsSchema>;

/** Permission context returned by `AuthorizationCheckerService.getUserPermissionDetails()`. */
export const UserPermissionsSchema = z
	.object({
		roles: z.array(SlimRoleSchema),
		permissions: z.array(PermissionDetailsSchema),
	})
	.strict();

export type UserPermissions = z.output<typeof UserPermissionsSchema>;

// ── User response (returned from login / /me / admin) ──────────────────────

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
	tokenVersion: z.number().meta({
		description: "Incremented on role/permission mutations; JWTs with a stale version are rejected",
	}),
	roles: z.array(SlimRoleSchema),
}).strict();

export type UserResponse = z.output<typeof UserResponseSchema>;

/**
 * Session RBAC payload — roles, permissions, and JWT-aligned flags.
 * Fetched via `GET /auth/permissions` (not bundled in `/auth/me`).
 */
export const SessionPermissionsResponseSchema = UserPermissionsSchema.extend({
	tokenVersion: z.number().int(),
	hasAdminAccess: z.boolean(),
	capabilities: z.array(CapabilitySlugSchema),
	isImpersonating: z.boolean().optional(),
	originalUserId: z.string().optional(),
}).strict();

export type SessionPermissionsResponse = z.output<typeof SessionPermissionsResponseSchema>;

/**
 * Profile update schema — used when a user updates their own profile.
 */
export const UpdateProfileSchema = z
	.object({
		fullName: z.string().min(2, "FullName must be at least 2 characters").max(100, "FullName must be at most 100 characters").optional().meta({
			description: "User's full name",
			example: "Jane Doe",
		}),
	})
	.strict();

export type UpdateProfileInput = z.output<typeof UpdateProfileSchema>;

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

// ── Admin-only user detail ─────────────────────────────────────────────────

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
	permissions: z.array(PermissionDetailsSchema),
	failedLoginAttempts: z.number().int().min(0).meta({
		description: "Number of consecutive failed login attempts",
		example: 0,
	}),
	lockedUntil: EpochMsSchema.nullable().meta({
		description: "Epoch ms when the account lockout expires (null = not locked)",
		example: null,
	}),
	directPermissionIds: z.array(z.string()).meta({
		description: "Permission IDs granted directly to this user (not via roles)",
	}),
}).strict();

export type AdminUserDetail = z.output<typeof AdminUserDetailSchema>;

/** Query string for `GET /auth/admin/users`. Query params arrive as strings; JSON Schema (Ajv) accepts either. */
export const AdminUserListQuerySchema = PaginationSchema.extend({
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
	search: z.string().optional(),
	sort: z.string().optional().describe("Sort field (prefix with - for desc, e.g. -fullName)"),
	role: z.string().optional(),
	status: z.enum(["active", "inactive", "locked"]).optional(),
}).strict();

export type AdminUserListQuery = z.output<typeof AdminUserListQuerySchema>;

// ── Generic message response ───────────────────────────────────────────────

export const UserMessageResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type UserMessageResponse = z.output<typeof UserMessageResponseSchema>;
