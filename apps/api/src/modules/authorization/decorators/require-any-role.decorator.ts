import { SetMetadata } from "@nestjs/common";

import { REQUIRED_ROLES_KEY, type RequiredRolesMetadata } from "../constants/authorization.constants";

/**
 * Requires the user to hold ANY of the listed roles (OR semantics).
 *
 * Usage:
 * ```ts
 * @RequireAnyRole("admin", "manager")
 * ```
 *
 * The route is accessible when the user holds at least one of the
 * listed roles.
 */
export const RequireAnyRole = (...roles: string[]): ReturnType<typeof SetMetadata> => {
	return SetMetadata(REQUIRED_ROLES_KEY, { mode: "any", roles } satisfies RequiredRolesMetadata);
};
