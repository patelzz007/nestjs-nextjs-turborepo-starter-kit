/** Route helpers shared by `proxy.ts` and the client auth wrapper. */

/** Authenticated dashboard and account areas — login required. */
export const WEB_PROTECTED_ROUTE_PREFIXES: readonly string[] = ["/hello", "/dashboard", "/profile", "/welcome", "/settings", "/rewardhub"];

export const WEB_AUTH_ROUTE_PREFIXES: readonly string[] = ["/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];

/**
 * Token-based auth pages that must run even when the user already has a session
 * (e.g. after signup/login, the verify-email link must not be bounced away).
 */
export const WEB_TOKEN_AUTH_ROUTE_PREFIXES: readonly string[] = ["/auth/verify-email", "/auth/reset-password"];

export const WEB_PUBLIC_EXACT_ROUTES: readonly string[] = ["/about", "/contact"];

export function isWebProtectedPath(pathname: string): boolean {
	return WEB_PROTECTED_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}

export function isWebAuthPath(pathname: string): boolean {
	return WEB_AUTH_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}

export function isWebTokenAuthPath(pathname: string): boolean {
	return WEB_TOKEN_AUTH_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}

export function isWebPublicExactPath(pathname: string): boolean {
	return WEB_PUBLIC_EXACT_ROUTES.some((route) => pathname === route);
}

/** Guest browsing — 401s should clear state but not navigate to login. */
export function isWebGuestBrowsablePath(pathname: string): boolean {
	return !isWebProtectedPath(pathname) && !isWebAuthPath(pathname);
}
