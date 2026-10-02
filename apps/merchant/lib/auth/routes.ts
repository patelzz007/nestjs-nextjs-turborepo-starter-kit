/**
 * Route classification shared by `proxy.ts` and the client session provider —
 * the single source for which merchant paths are protected, auth, or token
 * links. Every check is segment-aware (`/account` never matches `/accounts`).
 */
import { isPathWithin, ORG_SCOPE_PREFIX, ROUTES, stripQueryAndHash, type AppPath } from "@/lib/routes";

/**
 * Pages rendered outside the authenticated shell (sign-in, invite and
 * verification links). The proxy treats them as auth routes and the client
 * skips session revalidation on them.
 */
export const MERCHANT_AUTH_ROUTE_PREFIXES: readonly AppPath[] = [
	ROUTES.auth.login,
	ROUTES.auth.verifyEmail,
	ROUTES.auth.forgotPassword,
	ROUTES.auth.resetPassword,
	ROUTES.onboarding,
	ROUTES.teamInvite,
];

/**
 * One-shot token links (`?token=`). They must run even when a merchant session
 * cookie is already set: the proxy neither bounces a signed-in visitor away
 * nor refreshes the session on them (the token action handles its own session).
 */
export const MERCHANT_TOKEN_AUTH_ROUTE_PREFIXES: readonly AppPath[] = [ROUTES.auth.verifyEmail, ROUTES.auth.resetPassword, ROUTES.onboarding, ROUTES.teamInvite];

/**
 * The signed-in surface: the post-login entry `/`, the personal-account entry
 * `/account`, and everything organization-scoped under `/orgs`.
 */
export const MERCHANT_PROTECTED_ROUTE_PREFIXES: readonly AppPath[] = [ROUTES.home, ROUTES.account, ORG_SCOPE_PREFIX];

function matchesAnyPrefix(pathname: string, prefixes: readonly AppPath[]): boolean {
	return prefixes.some((prefix) => isPathWithin(pathname, prefix));
}

export function isMerchantAuthPath(pathname: string): boolean {
	return matchesAnyPrefix(pathname, MERCHANT_AUTH_ROUTE_PREFIXES);
}

export function isMerchantTokenAuthPath(pathname: string): boolean {
	return matchesAnyPrefix(pathname, MERCHANT_TOKEN_AUTH_ROUTE_PREFIXES);
}

export function isMerchantProtectedPath(pathname: string): boolean {
	return matchesAnyPrefix(pathname, MERCHANT_PROTECTED_ROUTE_PREFIXES);
}

/**
 * Whether a `?redirect=` target is safe to send a freshly signed-in user to:
 * a protected page or a team-invite link (query string allowed). Anything
 * else — including protocol-relative `//host` / `/\host` URLs — falls back to `/`.
 */
export function isAllowedMerchantPostLoginRedirect(redirect: string): boolean {
	// `//host` and `/\host` are protocol-relative to browsers — never same-origin.
	if (redirect.startsWith("//") || redirect.startsWith("/\\")) {
		return false;
	}
	const pathname = stripQueryAndHash(redirect);
	return isPathWithin(pathname, ROUTES.teamInvite) || isMerchantProtectedPath(pathname);
}
