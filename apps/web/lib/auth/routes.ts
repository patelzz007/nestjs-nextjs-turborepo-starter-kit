/** Route classification shared by `proxy.ts` and the client auth wrapper. All checks are segment-aware. */

import { isPathWithin, ROUTE_PREFIXES, ROUTES } from "@/lib/routes";

/** Signed-in areas — login required. Everything else outside `/auth` is guest-browsable. */
const WEB_PROTECTED_ROUTE_PREFIXES: readonly string[] = [ROUTES.hello, ROUTE_PREFIXES.rewardHub];

const WEB_AUTH_ROUTE_PREFIXES: readonly string[] = [ROUTES.auth.login, ROUTES.auth.signup, ROUTES.auth.forgotPassword, ROUTES.auth.resetPassword, ROUTES.auth.verifyEmail];

/**
 * Token-based auth pages that must run even when the user already has a session
 * (e.g. after signup/login, the verify-email link must not be bounced away).
 */
const WEB_TOKEN_AUTH_ROUTE_PREFIXES: readonly string[] = [ROUTES.auth.verifyEmail, ROUTES.auth.resetPassword];

function isWithinAny(pathname: string, prefixes: readonly string[]): boolean {
	return prefixes.some((prefix) => isPathWithin(pathname, prefix));
}

export function isWebProtectedPath(pathname: string): boolean {
	return isWithinAny(pathname, WEB_PROTECTED_ROUTE_PREFIXES);
}

export function isWebAuthPath(pathname: string): boolean {
	return isWithinAny(pathname, WEB_AUTH_ROUTE_PREFIXES);
}

export function isWebTokenAuthPath(pathname: string): boolean {
	return isWithinAny(pathname, WEB_TOKEN_AUTH_ROUTE_PREFIXES);
}

/** Guest browsing — 401s should clear state but not navigate to login. */
export function isWebGuestBrowsablePath(pathname: string): boolean {
	return !isWebProtectedPath(pathname) && !isWebAuthPath(pathname);
}
