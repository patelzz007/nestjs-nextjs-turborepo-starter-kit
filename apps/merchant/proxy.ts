import { API_BASE_URL } from "@workspace/client/lib/api/config";
import { withSecurityHeaders, type SecurityHeadersOptions } from "@workspace/client/lib/security/security-headers";
import { decodeJwtPayload } from "@workspace/client/lib/contexts/identity/edge/jwt";
import { getEnrollmentRedirectPath, isEnrollmentAllowedPath, isRestrictedSession } from "@workspace/client/lib/contexts/identity/edge/restricted-session";
import {
	applyRotatedSetCookies,
	clearAuthCookies,
	createProxyRefreshCooldown,
	hasRouteSession,
	isDocumentNavigation,
	refreshSessionFromProxy,
	resolveProxySessionRefresh,
	type AuthCookieClearOptions,
	type ProxyRefreshResult,
} from "@workspace/client/lib/contexts/identity/edge/proxy-refresh";
import { NodeEnvSchema } from "@workspace/shared";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAllowedMerchantPostLoginRedirect, isMerchantAuthPath, isMerchantProtectedPath, isMerchantTokenAuthPath } from "@/contexts/identity/lib/routes";
import { clientEnv } from "@/lib/env/env.client";
import { serverEnv } from "@/lib/env/env.server";
import { isCanonicalTenantSlug } from "@/contexts/tenancy/lib/tenant/resolve-slug";
import { TENANT_SLUG_COOKIE_NAME } from "@/contexts/tenancy/lib/tenant/slug";
import { ROUTES } from "@/lib/routes";

const ACCESS_TOKEN_COOKIE = "merchantAccessToken";
const REFRESH_TOKEN_COOKIE = "merchantRefreshToken";
const CLIENT_ORIGIN: string = clientEnv.NEXT_PUBLIC_MERCHANT_URL;
const COOKIE_CLEAR_OPTIONS: AuthCookieClearOptions = {
	domain: serverEnv.COOKIE_DOMAIN,
	path: "/",
	secure: serverEnv.NODE_ENV === NodeEnvSchema.enum.production,
	sameSite: "lax",
};

const attemptRefresh = createProxyRefreshCooldown((refreshToken: string): Promise<ProxyRefreshResult> =>
	refreshSessionFromProxy({
		apiBaseUrl: API_BASE_URL,
		refreshTokenName: REFRESH_TOKEN_COOKIE,
		accessTokenName: ACCESS_TOKEN_COOKIE,
		refreshToken,
		clientType: "merchant",
		clientOrigin: CLIENT_ORIGIN,
	}),
);

/** The shared response security headers: a nonce CSP, no framing (@workspace/client lib/security/security-headers). */
const SECURITY_HEADERS: SecurityHeadersOptions = { apiBaseUrl: API_BASE_URL, development: serverEnv.NODE_ENV === NodeEnvSchema.enum.development };

function clearCookies(response: NextResponse, names: readonly string[]): NextResponse {
	clearAuthCookies(response.cookies, names, COOKIE_CLEAR_OPTIONS);
	return response;
}

function applyRotatedCookies(response: NextResponse, setCookies: readonly string[]): NextResponse {
	applyRotatedSetCookies(response.cookies, setCookies);
	return response;
}

function redirectToLogin(request: NextRequest, pathname: string, rotatedCookies: readonly string[]): NextResponse {
	const loginUrl = new URL(ROUTES.auth.login, request.url);
	loginUrl.searchParams.set("redirect", pathname);
	return clearCookies(applyRotatedCookies(NextResponse.redirect(loginUrl), rotatedCookies), [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]);
}

function serveGuestResponse(response: NextResponse, rotatedCookies: readonly string[], accessToken: string | undefined): NextResponse {
	if (accessToken !== undefined) {
		return clearCookies(applyRotatedCookies(response, rotatedCookies), [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]);
	}
	return applyRotatedCookies(response, rotatedCookies);
}

/**
 * The `tenantSlug` preference for the enrollment redirect, only when it
 * is a canonical slug — a cookie is client input, so a tampered value never
 * becomes part of a redirect path. (Membership is checked by the tenant layout
 * the redirect lands on; the proxy stays cheap and does not call the API.)
 */
function readPreferredTenantSlug(request: NextRequest): string | undefined {
	const value = request.cookies.get(TENANT_SLUG_COOKIE_NAME)?.value;
	return value !== undefined && isCanonicalTenantSlug(value) ? value : undefined;
}

/** @internal Clears the module-scope refresh cooldown between tests. */
export function resetMerchantProxyRefreshCooldownForTests(): void {
	attemptRefresh.reset();
}

/** Every route runs with the shared security headers; `next` continues the request carrying them. */
export function proxy(request: NextRequest): Promise<NextResponse> {
	return withSecurityHeaders(request, routeRequest, SECURITY_HEADERS);
}

async function routeRequest(request: NextRequest, next: () => NextResponse): Promise<NextResponse> {
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
	const { pathname } = request.nextUrl;

	const isProtectedRouteMatch = isMerchantProtectedPath(pathname);
	const isAuthRoute = isMerchantAuthPath(pathname);
	const isTokenAuthRoute = isMerchantTokenAuthPath(pathname);

	let rotatedCookies: readonly string[] = [];
	let effectiveAccessToken: string | undefined = accessToken;

	const refreshResult = await resolveProxySessionRefresh({
		accessToken,
		refreshToken,
		isDocumentNavigation: isDocumentNavigation(request.headers),
		isAuthRoute,
		isPublicRoute: false,
		tokenAuthRoute: isTokenAuthRoute,
		accessTokenCookieName: ACCESS_TOKEN_COOKIE,
		refreshTokenCookieName: REFRESH_TOKEN_COOKIE,
		app: "merchant",
		pathname,
		attemptRefresh,
	});

	rotatedCookies = refreshResult.rotatedCookies;
	effectiveAccessToken = refreshResult.effectiveAccessToken;

	if (refreshResult.sessionDead) {
		if (isProtectedRouteMatch) {
			return redirectToLogin(request, pathname, rotatedCookies);
		}
		return serveGuestResponse(next(), rotatedCookies, accessToken);
	}

	const isAuthenticated = hasRouteSession(refreshToken);

	if (isProtectedRouteMatch && !isAuthenticated) {
		return redirectToLogin(request, pathname, rotatedCookies);
	}

	if (isProtectedRouteMatch && isAuthenticated && effectiveAccessToken !== undefined && isRestrictedSession(effectiveAccessToken) && !isEnrollmentAllowedPath(pathname)) {
		const payload = decodeJwtPayload(effectiveAccessToken);
		const enrollmentReason = payload?.isEmailVerified === false ? "email_verification" : "mfa_enrollment";
		const enrollmentPath = getEnrollmentRedirectPath("merchant", enrollmentReason, readPreferredTenantSlug(request));
		return applyRotatedCookies(NextResponse.redirect(new URL(enrollmentPath, request.url)), rotatedCookies);
	}

	if (isAuthRoute && isAuthenticated && !isTokenAuthRoute) {
		const redirect = request.nextUrl.searchParams.get("redirect");
		const target = redirect !== null && isAllowedMerchantPostLoginRedirect(redirect) ? redirect : ROUTES.home;
		return applyRotatedCookies(NextResponse.redirect(new URL(target, request.url)), rotatedCookies);
	}

	if (isAuthRoute && !isAuthenticated && accessToken !== undefined) {
		return serveGuestResponse(next(), rotatedCookies, accessToken);
	}

	if (!isProtectedRouteMatch && !isAuthRoute && !isAuthenticated && accessToken !== undefined) {
		return serveGuestResponse(next(), rotatedCookies, accessToken);
	}

	return applyRotatedCookies(next(), rotatedCookies);
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)"],
};
