import { SetMetadata } from "@nestjs/common";

import { REQUIRED_ROLES_KEY, type RequiredRolesMetadata } from "../../../../../platform/presentation/http/security/decorators/route-requirements.metadata";

/**
 * Requires the user to hold ALL of the listed roles (AND semantics).
 *
 * Usage:
 * ```ts
 * @RequireAllRoles("admin", "auditor")
 * ```
 *
 * The route is only accessible when the user holds every listed role.
 */
export const RequireAllRoles = (...roles: string[]): ReturnType<typeof SetMetadata> => {
	return SetMetadata(REQUIRED_ROLES_KEY, {
		mode: "all",
		roles,
	} satisfies RequiredRolesMetadata);
};
