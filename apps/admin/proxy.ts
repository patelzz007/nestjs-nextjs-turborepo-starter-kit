// ============================================
// proxy.ts - Admin App Route Protection
// Next.js 16+ convention (replaces middleware.ts)
// Next.js 16 runs `proxy.ts` on the **Node.js** runtime by design (only the
// legacy `middleware.ts` convention can opt into Edge), so no Edge runtime
// setup is needed on Node hosts (DigitalOcean / Linode droplets, etc.).
// ============================================

import { API_BASE_URL } from "@workspace/client/lib/api/config";
import { decodeJwtPayload } from "@workspace/client/lib/auth/edge/jwt";
import { getEnrollmentRedirectPath, isEnrollmentAllowedPath, isRestrictedSession } from "@workspace/client/lib/auth/edge/restricted-session";
import {
	applyRotatedSetCookies,
	clearAuthCookies,
	createProxyRefreshCooldown,
	hasRouteSession,
	isDocumentNavigation,
	refreshSessionFromProxy,
	resolveProxySessionRefresh,
	type AuthCookieClearOptions,
	type ProxyRefreshCooldownOptions,
	type ProxyRefreshResult,
} from "@workspace/client/lib/auth/edge/proxy-refresh";
import { AUTH_COOKIE_NAMES, NodeEnvSchema } from "@workspace/shared";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAdminAuthPath, isAdminTokenAuthPath, resolveAdminRedirectTarget } from "@/lib/auth-routes";
import { clientEnv } from "@/lib/env/env.client";
import { serverEnv } from "@/lib/env/env.server";
import { LOGIN_REDIRECT_PARAM, ROUTES } from "@/lib/routes";

// ── Cookie names are isolated from web app ─────────────────────────────
// The admin panel uses its own cookie pair (from the shared AUTH_COOKIE_NAMES
// table) so that a user logged in at the web app does not have their cookies
// recognized by the admin app.
const ACCESS_TOKEN_COOKIE = AUTH_COOKIE_NAMES.admin.accessToken;
const REFRESH_TOKEN_COOKIE = AUTH_COOKIE_NAMES.admin.refreshToken;
const CLIENT_ORIGIN: string = clientEnv.NEXT_PUBLIC_ADMIN_URL;
const COOKIE_CLEAR_OPTIONS: AuthCookieClearOptions = {
	domain: serverEnv.COOKIE_DOMAIN,
	path: "/",
	secure: serverEnv.NODE_ENV === NodeEnvSchema.enum.production,
	sameSite: "lax",
};

// The whole admin panel lives under `/` (overview, users, settings, account, …).
// There are no public pages: only the auth pages (`ADMIN_AUTH_ROUTE_PREFIXES`)
// are open to unauthenticated visitors, and token links (verify email, reset
// password) run even with a session.

/** The refresh attempt the proxy uses — a cooldown-wrapped call to the API's refresh endpoint. */
export type AdminProxyRefreshAttempt = (refreshToken: string, options?: { readonly bypassCooldown?: boolean }) => Promise<ProxyRefreshResult>;

/** The admin route proxy. */
export type AdminProxy = (request: NextRequest) => Promise<NextResponse>;

/**
 * A refresh attempt with its own transient-failure cooldown (60s). When the
 * API is down, the first navigation inside the skew window hits it once and
 * subsequent navigations skip — silencing the ECONNREFUSED spam in the logs.
 * `cooldownOptions` injects the breaker's clock and limits (tests drive time
 * through `now` instead of patching globals).
 */
export function createAdminRefreshAttempt(cooldownOptions: ProxyRefreshCooldownOptions = {}): AdminProxyRefreshAttempt {
	return createProxyRefreshCooldown(
		(refreshToken: string): Promise<ProxyRefreshResult> =>
			refreshSessionFromProxy({
				apiBaseUrl: API_BASE_URL,
				refreshTokenName: REFRESH_TOKEN_COOKIE,
				accessTokenName: ACCESS_TOKEN_COOKIE,
				refreshToken,
				clientType: "admin",
				clientOrigin: CLIENT_ORIGIN,
			}),
		cooldownOptions,
	);
}

function redirectToLogin(request: NextRequest, pathname: string, rotatedCookies: readonly string[]): NextResponse {
	const loginUrl = new URL(ROUTES.auth.login, request.url);
	loginUrl.searchParams.set(LOGIN_REDIRECT_PARAM, pathname);
	return clearCookies(applyRotatedCookies(NextResponse.redirect(loginUrl), rotatedCookies), [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]);
}

function serveGuestResponse(response: NextResponse, rotatedCookies: readonly string[], accessToken: string | undefined): NextResponse {
	if (accessToken !== undefined) {
		return clearCookies(applyRotatedCookies(response, rotatedCookies), [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]);
	}
	return applyRotatedCookies(response, rotatedCookies);
}

/**
 * Expire the given cookies on a response. The proxy CAN clear httpOnly
 * cookies (unlike browser JS), so a confirmed-dead session can be cleaned up
 * here — this is what breaks the stale-cookie bounce loop between the panel
 * and the login page.
 */
function clearCookies(response: NextResponse, names: readonly string[]): NextResponse {
	clearAuthCookies(response.cookies, names, COOKIE_CLEAR_OPTIONS);
	return response;
}

/** Forward the rotated `Set-Cookie` headers from the refresh response to the browser. */
function applyRotatedCookies(response: NextResponse, setCookies: readonly string[]): NextResponse {
	applyRotatedSetCookies(response.cookies, setCookies);
	return response;
}

/**
 * Builds the admin proxy around one refresh attempt. The exported `proxy`
 * holds a single instance for the server process, so the cooldown memo
 * survives across requests; tests build a fresh proxy (and cooldown) each.
 */
export function createAdminProxy(attemptRefresh: AdminProxyRefreshAttempt): AdminProxy {
	return (request: NextRequest): Promise<NextResponse> => handleRequest(request, attemptRefresh);
}

async function handleRequest(request: NextRequest, attemptRefresh: AdminProxyRefreshAttempt): Promise<NextResponse> {
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
	const { pathname } = request.nextUrl;

	const isAuthRoute = isAdminAuthPath(pathname);

	let rotatedCookies: readonly string[] = [];
	let effectiveAccessToken: string | undefined = accessToken;

	const refreshResult = await resolveProxySessionRefresh({
		accessToken,
		refreshToken,
		isDocumentNavigation: isDocumentNavigation(request.headers),
		isAuthRoute,
		// The admin app has no public pages (see above).
		isPublicRoute: false,
		tokenAuthRoute: isAdminTokenAuthPath(pathname),
		accessTokenCookieName: ACCESS_TOKEN_COOKIE,
		refreshTokenCookieName: REFRESH_TOKEN_COOKIE,
		app: "admin",
		pathname,
		attemptRefresh,
	});

	rotatedCookies = refreshResult.rotatedCookies;
	effectiveAccessToken = refreshResult.effectiveAccessToken;

	if (refreshResult.sessionDead) {
		if (!isAuthRoute) {
			return redirectToLogin(request, pathname, rotatedCookies);
		}
		return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
	}

	const isAuthenticated = hasRouteSession(accessToken, refreshToken, effectiveAccessToken);

	const payload = effectiveAccessToken ? decodeJwtPayload(effectiveAccessToken) : null;
	const hasAdminAccess: boolean = payload?.hasAdminAccess === true;

	if (isAuthRoute) {
		if (isAuthenticated && hasAdminAccess && !isAdminTokenAuthPath(pathname)) {
			const targetUrl: string = resolveAdminRedirectTarget(request.nextUrl.searchParams.get(LOGIN_REDIRECT_PARAM), CLIENT_ORIGIN);
			return applyRotatedCookies(NextResponse.redirect(new URL(targetUrl, request.url)), rotatedCookies);
		}
		if (!isAuthenticated && accessToken !== undefined) {
			return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
		}
		return applyRotatedCookies(NextResponse.next(), rotatedCookies);
	}

	if (!isAuthenticated) {
		return redirectToLogin(request, pathname, rotatedCookies);
	}
	if (effectiveAccessToken !== undefined && isRestrictedSession(effectiveAccessToken) && !isEnrollmentAllowedPath(pathname)) {
		const enrollmentReason = payload?.isEmailVerified === false ? "email_verification" : "mfa_enrollment";
		const enrollmentPath = getEnrollmentRedirectPath("admin", enrollmentReason);
		return applyRotatedCookies(NextResponse.redirect(new URL(enrollmentPath, request.url)), rotatedCookies);
	}
	if (!hasAdminAccess) {
		const loginUrl = new URL(ROUTES.auth.login, request.url);
		return applyRotatedCookies(NextResponse.redirect(loginUrl), rotatedCookies);
	}
	return applyRotatedCookies(NextResponse.next(), rotatedCookies);
}

/** The proxy Next.js runs — one refresh cooldown for the whole server process. */
export const proxy: AdminProxy = createAdminProxy(createAdminRefreshAttempt());

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (static files)
		 * - images, fonts, etc.
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)).*)",
	],
};
