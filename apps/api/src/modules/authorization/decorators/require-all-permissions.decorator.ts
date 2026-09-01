import { SetMetadata } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { REQUIRED_PERMISSIONS_KEY, type RequiredPermissionsMetadata } from "../constants/authorization.constants";

/**
 * Requires ALL of the listed permissions (AND semantics).
 *
 * Usage:
 * ```ts
 * @RequireAllPermissions(
 *   ["CREATE", "USER"],
 *   ["READ", "USER"],
 * )
 * ```
 *
 * The route is only accessible when the user holds every listed
 * action+resource pair (or `MANAGE` on the same resource).
 */
export const RequireAllPermissions = (...permissions: [PermissionAction, PermissionResource][]): ReturnType<typeof SetMetadata> => {
	return SetMetadata(REQUIRED_PERMISSIONS_KEY, {
		mode: "all",
		permissions,
	} satisfies RequiredPermissionsMetadata);
};
