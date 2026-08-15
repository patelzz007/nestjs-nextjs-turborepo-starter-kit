import { z } from "zod";

import { PermissionDetailsSchema, SlimRoleSchema } from "./schemas/user.schema";

// ── Public Exports ──────────────────────────────────────────────────────────

/**
 * Slim permission shape embedded in the JWT access token.
 * Excludes `id` and `description` to keep the JWT under ~4 KB cookie size limit.
 * The full PermissionDetails (with id and description) is reconstructed by AuthGuard.
 *
 * Deliberately NOT `.strict()`: this schema runs inside
 * `AccessTokenPayloadSchema.parse()` on every token verification. A strict
 * sub-schema would turn "we added a claim to the JWT" into a total auth
 * outage — unknown keys are stripped instead, keeping the decode defensive.
 */
export const JwtPermissionSchema = z.object({
	/** Permission action (e.g. "create", "read", "update", "delete") */
	action: z.string(),
	/** Permission resource (e.g. "user", "api_key", "role") */
	resource: z.string(),
});

export type JwtPermission = z.output<typeof JwtPermissionSchema>;

/**
 * The permission context returned by RbacService.getUserPermissions().
 */
export const UserPermissionsSchema = z
	.object({
		/** Roles assigned to the user (or a filtered set based on the target) */
		roles: z.array(SlimRoleSchema),
		/** Direct permission overrides (usually empty if using role-based access) */
		permissions: z.array(PermissionDetailsSchema),
	})
	.strict();

export type UserPermissions = z.output<typeof UserPermissionsSchema>;

/**
 * A flattened user object used internally by TokenService to generate JWT tokens.
 * Contains both user metadata and their full permission context.
 */
export const FlatUserResponseSchema = z
	.object({
		id: z.string(),
		email: z.string(),
		fullName: z.string(),
		isActive: z.boolean(),
		isSuperAdmin: z.boolean(),
		isEmailVerified: z.boolean(),
		hasAdminAccess: z.boolean(),
		roles: z.array(SlimRoleSchema),
		permissions: z.array(PermissionDetailsSchema),
	})
	.strict();

export type FlatUserResponse = z.output<typeof FlatUserResponseSchema>;
