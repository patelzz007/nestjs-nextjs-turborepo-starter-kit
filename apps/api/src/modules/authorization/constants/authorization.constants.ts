import type { PermissionAction, PermissionResource } from "@workspace/shared";

/** Metadata key for permission-based route guards. */
export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";

/** Metadata key for role-based route guards. */
export const REQUIRED_ROLES_KEY = "requiredRoles";

/** Legacy key used by the existing @RequirePermission decorator. */
export const REQUIRED_PERMISSION_KEY = "requiredPermission";

/** Shape of the metadata set by @RequireAllPermissions / @RequireAnyPermission. */
export interface RequiredPermissionsMetadata {
	readonly mode: "all" | "any";
	readonly permissions: readonly [PermissionAction, PermissionResource][];
}

/** Shape of the metadata set by @RequireAllRoles / @RequireAnyRole. */
export interface RequiredRolesMetadata {
	readonly mode: "all" | "any";
	readonly roles: readonly string[];
}

/** Shape of the metadata set by the legacy @RequirePermission decorator. */
export interface RequiredPermission {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
}
