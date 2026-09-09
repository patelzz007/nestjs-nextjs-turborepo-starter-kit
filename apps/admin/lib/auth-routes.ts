/** Route helpers shared by `proxy.ts` and the client auth wrapper. */

export const ADMIN_AUTH_ROUTE_PREFIXES: readonly string[] = ["/auth/login", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];

export function isAdminAuthPath(pathname: string): boolean {
	return ADMIN_AUTH_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}
