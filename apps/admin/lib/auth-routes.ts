/** Route helpers shared by `proxy.ts`, the login page, and the client auth wrapper. */

import { AUTH_SECTION_PREFIX, isPathWithin, ROUTES } from "@/lib/routes";

/** The admin auth pages — open to unauthenticated visitors. Every entry has a page under `app/auth`. */
export const ADMIN_AUTH_ROUTE_PREFIXES: readonly string[] = [ROUTES.auth.login, ROUTES.auth.forgotPassword, ROUTES.auth.resetPassword, ROUTES.auth.verifyEmail];

/** Token links (emailed by the API) must run even when an admin session cookie is already set. */
export const ADMIN_TOKEN_AUTH_ROUTE_PREFIXES: readonly string[] = [ROUTES.auth.verifyEmail, ROUTES.auth.resetPassword];

/** True for an admin auth page (segment-aware: `/auth/login` matches, `/auth/loginx` does not). */
export function isAdminAuthPath(pathname: string): boolean {
	return ADMIN_AUTH_ROUTE_PREFIXES.some((route) => isPathWithin(route, pathname));
}

/** True for an emailed token link (verify email, reset password). */
export function isAdminTokenAuthPath(pathname: string): boolean {
	return ADMIN_TOKEN_AUTH_ROUTE_PREFIXES.some((route) => isPathWithin(route, pathname));
}

/**
 * True when `redirect` is a safe in-app post-login target: a same-origin path
 * (not protocol-relative `//host`) outside the auth pages — no open redirects
 * and no bounce back into the login flow.
 */
export function isSafeAdminRedirect(redirect: string): boolean {
	return redirect.startsWith("/") && !redirect.startsWith("//") && !isPathWithin(AUTH_SECTION_PREFIX, redirect);
}
