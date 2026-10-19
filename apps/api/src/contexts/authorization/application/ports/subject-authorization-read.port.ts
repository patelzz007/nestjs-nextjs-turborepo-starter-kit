import type { CapabilitySlug, CheckPermissionResponse, PermissionAction, PermissionResource, UserPermissions } from "@workspace/shared";

/**
 * A user's effective RBAC grants, as other contexts read them (`/auth/me`, `/auth/permissions`, session
 * payloads, admin user views) and as the admin inspector explains them.
 */
export interface SubjectAuthorizationReadPort {
	/** Flat capability slug list for frontend gating (`GET /auth/permissions`). SuperAdmins get every platform capability. */
	getUserCapabilitySlugs(userId: string): Promise<readonly CapabilitySlug[]>;
	/** Ids of the user's live, unexpired direct ALLOW grants. */
	getUserDirectPermissionIds(userId: string): Promise<readonly string[]>;
	/** Roles and permissions with their metadata (the `UserPermissions` shape `buildUserResponse()` expects). */
	getUserPermissionDetails(userId: string): Promise<UserPermissions>;
	/** Whether the user holds a permission, and which grants satisfy it (`POST /admin/permissions/check`). */
	checkPermissionWithGrants(userId: string, action: PermissionAction, resource: PermissionResource): Promise<CheckPermissionResponse>;
}
