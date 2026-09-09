/** Route helpers shared by `proxy.ts` and the client auth wrapper. */

export const MERCHANT_AUTH_ROUTE_PREFIXES: readonly string[] = ["/auth/login", "/auth/verify-email", "/auth/reset-password", "/onboarding"];

export function isMerchantAuthPath(pathname: string): boolean {
	return MERCHANT_AUTH_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}
