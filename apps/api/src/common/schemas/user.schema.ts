import { z } from "zod";
import { PermissionActionSchema, PermissionResourceSchema } from "@workspace/shared";
import { BaseResponseSchema } from "./base.schema";
import { DateStringSchema } from "./date.schema";

// ── Slim Role ───────────────────────────────────────────────────────────────

/**
 * A lightweight role object embedded in the JWT and user response.
 */
export const SlimRoleSchema = z
	.object({
		id: z.string().meta({
			description: "Role unique identifier",
			example: "clx...",
		}),
		name: z.string().meta({
			description: "Role name (e.g. Admin, User)",
			example: "User",
		}),
		description: z.string().nullable().meta({
			description: "Human-readable role description",
			example: "Standard user with basic permissions",
		}),
	})
	.strict();

export type SlimRoleResponse = z.output<typeof SlimRoleSchema>;

// ── Permission Details ──────────────────────────────────────────────────────

/**
 * Full permission object with id and description.
 * Used in the API response (not the JWT — the JWT uses the slim JwtPermission type).
 */
export const PermissionDetailsSchema = z
	.object({
		id: z.string().meta({
			description: "Permission unique identifier",
			example: "clx...",
		}),
		action: PermissionActionSchema.meta({
			description: "Permission action (e.g. create, read, update, delete)",
			example: "read",
		}),
		resource: PermissionResourceSchema.meta({
			description: "Permission resource (e.g. user, api_key, role)",
			example: "user",
		}),
		description: z.string().nullable().meta({
			description: "Human-readable permission description",
			example: "Can read user profiles",
		}),
	})
	.strict();

export type PermissionDetailsResponse = z.output<typeof PermissionDetailsSchema>;

// ── User Response ───────────────────────────────────────────────────────────

/**
 * Full user profile returned by API endpoints.
 * Extends BaseResponseSchema with user-specific fields.
 */
export const UserResponseSchema = BaseResponseSchema.extend({
	id: z.string().meta({
		description: "User unique identifier",
		example: "clx...",
	}),
	email: z.string().email().meta({
		description: "User email address",
		example: "admin@example.com",
	}),
	fullName: z.string().meta({
		description: "User's full name",
		example: "Jane Doe",
	}),
	isActive: z.boolean().meta({
		description: "Whether the user account is active",
	}),
	isSuperAdmin: z.boolean().meta({
		description: "Whether the user has super admin privileges",
	}),
	isEmailVerified: z.boolean().meta({
		description: "Whether the user's email has been verified",
	}),
	hasAdminAccess: z.boolean().meta({
		description: "Whether the user can access the admin panel",
	}),
	roles: z.array(SlimRoleSchema).meta({
		description: "Roles assigned to the user",
	}),
	permissions: z.array(PermissionDetailsSchema).meta({
		description: "Direct permission overrides (usually empty if using role-based access)",
	}),
}).strict();

export type UserResponse = z.output<typeof UserResponseSchema>;
