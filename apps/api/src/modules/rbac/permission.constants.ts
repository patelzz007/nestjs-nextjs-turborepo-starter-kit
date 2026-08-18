import type { PermissionAction, PermissionResource } from "@workspace/shared";

export const REQUIRED_PERMISSION_KEY = "requiredPermission";

export interface RequiredPermission {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
}
