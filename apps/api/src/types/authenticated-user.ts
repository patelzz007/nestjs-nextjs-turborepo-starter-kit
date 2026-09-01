import type { AccessTokenPayload, RefreshTokenPayload } from "../modules/auth/services/token.service";

/**
 * The runtime shape of `request.user` after the full guard pipeline.
 *
 * - AuthGuard attaches the decoded JWT as `AccessTokenPayload` (identity only).
 * - AuthorizationGuard enriches it with `hasAdminAccess` (resolved from DB/cache).
 * - RefreshTokenGuard attaches a `RefreshTokenPayload` on refresh routes.
 */
export type AuthenticatedUser = AccessTokenPayload & {
	/** Computed at guard time — not in the JWT. */
	readonly hasAdminAccess?: boolean;
};

/**
 * Type guard that narrows `request.user` to `AuthenticatedUser`.
 *
 * In the normal request lifecycle AuthGuard always attaches the access token
 * payload, so this is a safe narrowing.  Refresh-token routes and public
 * endpoints are the only cases where `request.user` may be a
 * `RefreshTokenPayload` or `undefined`.
 */
export function isAuthenticatedUser(user: AccessTokenPayload | RefreshTokenPayload | undefined): user is AuthenticatedUser {
	return user !== undefined && "id" in user && "isSuperAdmin" in user;
}
