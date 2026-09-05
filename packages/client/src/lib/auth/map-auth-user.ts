import type { UserResponse } from "@workspace/shared";

import type { AuthUser } from "./auth-store";

/** Maps an API user record into the client auth-store shape. */
export function toAuthUser(user: UserResponse): AuthUser {
	return {
		id: user.id,
		email: user.email,
		fullName: user.fullName,
		isSuperAdmin: user.isSuperAdmin,
		hasAdminAccess: user.hasAdminAccess,
		isEmailVerified: user.isEmailVerified,
		roles: user.roles,
	};
}
