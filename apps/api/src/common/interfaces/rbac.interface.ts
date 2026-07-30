import type { SlimRoleResponse, PermissionDetailsResponse, UserResponse } from "../schemas/user.schema";

// ── Public Exports ──────────────────────────────────────────────────────────

/**
 * Slim permission shape embedded in the JWT access token.
 * Excludes `id` and `description` to keep the JWT under ~4 KB cookie size limit.
 * The full PermissionDetails (with id and description) is reconstructed by AuthGuard.
 */
export interface JwtPermission {
	/** Permission action (e.g. "create", "read", "update", "delete") */
	readonly action: string;
	/** Permission resource (e.g. "user", "api_key", "role") */
	readonly resource: string;
}

/**
 * The permission context returned by RbacService.getUserPermissions().
 */
export interface UserPermissions {
	/** Roles assigned to the user (or a filtered set based on the target) */
	readonly roles: SlimRoleResponse[];
	/** Direct permission overrides (usually empty if using role-based access) */
	readonly permissions: PermissionDetailsResponse[];
}

/**
 * A flattened user object used internally by TokenService to generate JWT tokens.
 * Contains both user metadata and their full permission context.
 */
export interface FlatUserResponse {
	readonly id: string;
	readonly email: string;
	readonly fullName: string;
	readonly isActive: boolean;
	readonly isSuperAdmin: boolean;
	readonly isEmailVerified: boolean;
	readonly hasAdminAccess: boolean;
	readonly roles: SlimRoleResponse[];
	readonly permissions: PermissionDetailsResponse[];
}
