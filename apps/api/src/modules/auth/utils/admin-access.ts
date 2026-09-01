import { ForbiddenException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../../types/authenticated-user";
import { isAuthenticatedUser } from "../../../types/authenticated-user";
import type { AccessTokenPayload, RefreshTokenPayload } from "../services/token.service";

export const ADMIN_ACCESS_ERROR = "ADMIN_ACCESS_REQUIRED";

/** Metadata key for a route-specific admin-access denial message. */
export const ADMIN_ACCESS_MESSAGE_KEY = "adminAccessMessage";

/** True when the request user is an access-token payload with `hasAdminAccess`. */
export function userHasAdminAccess(user: AccessTokenPayload | RefreshTokenPayload | undefined): user is AuthenticatedUser {
	if (!isAuthenticatedUser(user)) {
		return false;
	}
	return user.hasAdminAccess === true;
}

/**
 * Super-admin routes accept either `isSuperAdmin` or the pre-computed
 * `hasAdminAccess` flag resolved at guard time from DB/cache.
 */
export function userHasElevatedAdminAccess(user: AccessTokenPayload | RefreshTokenPayload | undefined): user is AuthenticatedUser {
	if (!isAuthenticatedUser(user)) {
		return false;
	}
	if (user.isSuperAdmin) {
		return true;
	}
	return user.hasAdminAccess === true;
}

/** Narrow the auth payload union to an access token and re-check admin access. */
export function requireAdminAccessToken(user: AccessTokenPayload | RefreshTokenPayload | undefined, message = "Admin access required."): AuthenticatedUser {
	if (!userHasAdminAccess(user)) {
		throw new ForbiddenException({ message, error: ADMIN_ACCESS_ERROR });
	}
	return user;
}
