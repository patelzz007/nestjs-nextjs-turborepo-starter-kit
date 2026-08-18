import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { REQUIRED_PERMISSION_KEY, type RequiredPermission } from "../../rbac/permission.constants";
import { PermissionGuard } from "../../rbac/permission.guard";

/**
 * Requires one JWT permission (or `MANAGE` on the same resource). Super-admins bypass.
 * Global `AuthGuard` already attached `request.user`.
 */
export const RequirePermission = (action: PermissionAction, resource: PermissionResource): ReturnType<typeof applyDecorators> => {
	return applyDecorators(SetMetadata(REQUIRED_PERMISSION_KEY, { action, resource } satisfies RequiredPermission), UseGuards(PermissionGuard));
};
