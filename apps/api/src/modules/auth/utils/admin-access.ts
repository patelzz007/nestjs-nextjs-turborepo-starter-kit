import { ForbiddenException } from "@nestjs/common";

import type { AccessTokenPayload, RefreshTokenPayload } from "../services/token.service";

export const ADMIN_ACCESS_ERROR = "ADMIN_ACCESS_REQUIRED";

/** Metadata key for a route-specific admin-access denial message. */
export const ADMIN_ACCESS_MESSAGE_KEY = "adminAccessMessage";

/** True when the request user is an access-token payload with `hasAdminAccess`. */
export function userHasAdminAccess(user: AccessTokenPayload | RefreshTokenPayload | undefined): user is AccessTokenPayload {
	return user !== undefined && "hasAdminAccess" in user && user.hasAdminAccess;
}

/**
 * Super-admin routes accept either `isSuperAdmin` or the pre-computed
 * `hasAdminAccess` flag from the JWT (ADMIN_DASHBOARD permission).
 */
export function userHasElevatedAdminAccess(user: AccessTokenPayload | RefreshTokenPayload | undefined): user is AccessTokenPayload {
	if (user === undefined) {
		return false;
	}
	if ("isSuperAdmin" in user && user.isSuperAdmin) {
		return true;
	}
	return userHasAdminAccess(user);
}

/** Narrow the auth payload union to an access token and re-check admin access. */
export function requireAdminAccessToken(
	user: AccessTokenPayload | RefreshTokenPayload | undefined,
	message: string = "Admin access required.",
): AccessTokenPayload {
	if (!userHasAdminAccess(user)) {
		throw new ForbiddenException({ message, error: ADMIN_ACCESS_ERROR });
	}
	return user;
}
