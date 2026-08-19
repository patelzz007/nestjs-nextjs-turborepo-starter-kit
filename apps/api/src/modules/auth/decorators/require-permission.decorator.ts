import { SetMetadata } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { REQUIRED_PERMISSION_KEY, type RequiredPermission } from "../../rbac/permission.constants";

/**
 * Requires one JWT permission (or `MANAGE` on the same resource). Super-admins bypass.
 * Enforced by the global `PermissionGuard` (`APP_GUARD` in `app.module.ts`) — no
 * per-route `UseGuards` needed.
 */
export const RequirePermission = (action: PermissionAction, resource: PermissionResource): ReturnType<typeof SetMetadata> => {
	return SetMetadata(REQUIRED_PERMISSION_KEY, { action, resource } satisfies RequiredPermission);
};
