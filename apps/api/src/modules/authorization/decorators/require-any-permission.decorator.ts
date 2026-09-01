import { SetMetadata } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { REQUIRED_PERMISSIONS_KEY, type RequiredPermissionsMetadata } from "../constants/authorization.constants";

/**
 * Requires ANY of the listed permissions (OR semantics).
 *
 * Usage:
 * ```ts
 * @RequireAnyPermission(
 *   ["CREATE", "USER"],
 *   ["UPDATE", "USER"],
 * )
 * ```
 *
 * The route is accessible when the user holds at least one of the
 * listed action+resource pairs.
 */
export const RequireAnyPermission = (...permissions: [PermissionAction, PermissionResource][]): ReturnType<typeof SetMetadata> => {
	return SetMetadata(REQUIRED_PERMISSIONS_KEY, {
		mode: "any",
		permissions,
	} satisfies RequiredPermissionsMetadata);
};
