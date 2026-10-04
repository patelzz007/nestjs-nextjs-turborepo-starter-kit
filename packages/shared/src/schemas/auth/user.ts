import { z } from "zod";

import { CapabilitySlugSchema } from "../domain/rbac/capabilities";
import { defineListQuery, listFilter, ListSearchSchema } from "../api/list-query";

import { EpochMsSchema, BaseResponseSchema } from "../api/common";
import { EnrollmentReasonSchema, SessionScopeSchema } from "./enrollment";
import { UserFullNameSchema } from "./profile";

// ── Shared role shape ──────────────────────────────────────────────────────

export const SlimRoleSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
});

export type SlimRoleResponse = z.output<typeof SlimRoleSchema>;

// ── Permission detail shape ────────────────────────────────────────────────

export const PermissionDetailsSchema = z.object({
	id: z.string(),
	action: z.string(),
	resource: z.string(),
	description: z.string().nullable(),
	group: z.string().nullable(),
});

export type PermissionDetailsResponse = z.output<typeof PermissionDetailsSchema>;

/** Permission context returned by `AuthorizationCheckerService.getUserPermissionDetails()`. */
export const UserPermissionsSchema = z.object({
	roles: z.array(SlimRoleSchema),
	permissions: z.array(PermissionDetailsSchema),
});

export type UserPermissions = z.output<typeof UserPermissionsSchema>;

// ── User response (returned from login / /me / admin) ──────────────────────

export const UserResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	email: z.string(),
	fullName: z.string(),
	isActive: z.boolean(),
	isSuperAdmin: z.boolean(),
	isEmailVerified: z.boolean(),
	twoFactorEnabled: z.boolean().default(false).meta({
		description: "Whether TOTP two-factor authentication is enabled",
	}),
	hasAdminAccess: z.boolean().meta({
		description: "Whether the user can access the admin panel",
	}),
	tokenVersion: z.number().meta({
		description: "Incremented on role/permission mutations; JWTs with a stale version are rejected",
	}),
	roles: z.array(SlimRoleSchema),
});

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
	/** Mirrors the current access token's `sessionScope` claim. Required: a client must never assume a full session. */
	sessionScope: SessionScopeSchema,
	/** Present when `sessionScope` is `restricted`. */
	enrollmentReason: EnrollmentReasonSchema.optional(),
});

export type SessionPermissionsResponse = z.output<typeof SessionPermissionsResponseSchema>;

/**
 * Admin user update. A user's own profile edit is `UpdateOwnProfileSchema`
 * (`./profile`, `PATCH /auth/profile`); the name rule is shared with it.
 */
export const UpdateUserSchema = z
	.object({
		fullName: UserFullNameSchema.optional(),
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
	})
	.strict();

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
});

export type AdminUserDetail = z.output<typeof AdminUserDetailSchema>;

/** Derived account state the admin user list filters on (`isActive` + `lockedUntil`). */
export const AdminUserStatusSchema = z.enum(["active", "inactive", "locked"]);
export type AdminUserStatus = z.output<typeof AdminUserStatusSchema>;

/** `GET /auth/admin/users` list query — see docs/technical/api/list-queries.md. */
export const adminUserListQuery = defineListQuery({
	sortable: ["fullName", "email", "createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(AdminUserStatusSchema, { eq: true }),
		role: listFilter.string({ eq: true }),
	},
	params: { search: ListSearchSchema },
});
export const AdminUserListQuerySchema = adminUserListQuery.schema;
export type AdminUserListQuery = z.output<typeof AdminUserListQuerySchema>;
export type AdminUserListSortField = (typeof adminUserListQuery.sortable)[number];

// ── Generic message response ───────────────────────────────────────────────

export const UserMessageResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type UserMessageResponse = z.output<typeof UserMessageResponseSchema>;
