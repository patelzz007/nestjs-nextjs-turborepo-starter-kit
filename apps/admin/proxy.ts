// ============================================
// proxy.ts - Admin App Route Protection
// Next.js 16+ convention (replaces middleware.ts)
// Next.js 16 runs `proxy.ts` on the **Node.js** runtime by design (only the
// legacy `middleware.ts` convention can opt into Edge), so no Edge runtime
// setup is needed on Node hosts (DigitalOcean / Linode droplets, etc.).
// ============================================

import { API_BASE_URL } from "@workspace/client/lib/api/config";
import { decodeJwtPayload } from "@workspace/client/lib/auth/jwt";
import { getEnrollmentRedirectPath, isEnrollmentAllowedPath, isRestrictedSession } from "@workspace/client/lib/auth/restricted-session";
import {
	createProxyRefreshCooldown,
	hasRouteSession,
	isDocumentNavigation,
	parseSetCookie,
	refreshSessionFromProxy,
	resolveProxySessionRefresh,
	type ParsedCookie,
	type ProxyRefreshResult,
} from "@workspace/client/lib/auth/proxy-refresh";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Cookie names are isolated from web app ─────────────────────────────
// The admin panel uses separate cookie names (adminAccessToken,
// adminRefreshToken) so that a user logged in at the web app does not
// have their cookies recognized by the admin app.
const ACCESS_TOKEN_COOKIE = "adminAccessToken";
const REFRESH_TOKEN_COOKIE = "adminRefreshToken";

// The whole admin panel lives under `/` (overview, settings, users, …).
// Only `/auth/*` is open to unauthenticated visitors.
const AUTH_ROUTES: readonly string[] = ["/auth/login", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];

/** Token links must run even when the admin session cookie is already set. */
const TOKEN_AUTH_ROUTE_PREFIXES: readonly string[] = ["/auth/verify-email", "/auth/reset-password"];

function isTokenAuthRoute(pathname: string): boolean {
	return TOKEN_AUTH_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}

// Routes accessible without authentication.
const PUBLIC_ROUTES: readonly string[] = [];

/**
 * Transient-failure cooldown (60s), instantiated ONCE at module scope so the
 * memoized failure survives across requests in the server process. When the
 * API is down, the first navigation inside the skew window hits it once and
 * subsequent navigations skip — silencing the ECONNREFUSED spam in the logs.
 */
const attemptRefresh = createProxyRefreshCooldown((refreshToken: string): Promise<ProxyRefreshResult> =>
	refreshSessionFromProxy({
		apiBaseUrl: API_BASE_URL,
		refreshTokenName: REFRESH_TOKEN_COOKIE,
		refreshToken,
		clientType: "admin",
	}),
);

/** @internal Clears the module-scope refresh cooldown between tests. */
export function resetAdminProxyRefreshCooldownForTests(): void {
	attemptRefresh.reset();
}

function isSafeRedirect(redirect: string): boolean {
	return redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/auth/");
}

function redirectToLogin(request: NextRequest, pathname: string, rotatedCookies: readonly string[]): NextResponse {
	const loginUrl = new URL("/auth/login", request.url);
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
 * Expire the given cookies on a response. The proxy CAN clear httpOnly
 * cookies (unlike browser JS), so a confirmed-dead session can be cleaned up
 * here — this is what breaks the stale-cookie bounce loop between the panel
 * and the login page.
 */
function clearCookies(response: NextResponse, names: readonly string[]): NextResponse {
	for (const name of names) {
		response.cookies.set(name, "", { maxAge: 0, path: "/" });
	}
	return response;
}

/** Forward the rotated `Set-Cookie` headers from the refresh response to the browser. */
function applyRotatedCookies(response: NextResponse, setCookies: readonly string[]): NextResponse {
	for (const header of setCookies) {
		const cookie: ParsedCookie | null = parseSetCookie(header);
		if (cookie === null) continue;
		response.cookies.set(cookie.name, cookie.value, {
			httpOnly: cookie.httpOnly,
			secure: cookie.secure,
			sameSite: cookie.sameSite,
			path: cookie.path,
			domain: cookie.domain ?? undefined,
			maxAge: cookie.maxAge ?? undefined,
			expires: cookie.expires ?? undefined,
		});
	}
	return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
	const { pathname } = request.nextUrl;

	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
	const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route);
	const isPanelRoute = !isAuthRoute && !isPublicRoute;

	let rotatedCookies: readonly string[] = [];
	let effectiveAccessToken: string | undefined = accessToken;

	const refreshResult = await resolveProxySessionRefresh({
		accessToken,
		refreshToken,
		isDocumentNavigation: isDocumentNavigation(request.headers),
		isAuthRoute,
		isPublicRoute,
		accessTokenCookieName: ACCESS_TOKEN_COOKIE,
		app: "admin",
		pathname,
		attemptRefresh,
	});

	rotatedCookies = refreshResult.rotatedCookies;
	effectiveAccessToken = refreshResult.effectiveAccessToken;

	if (refreshResult.sessionDead) {
		if (isPanelRoute) {
			return redirectToLogin(request, pathname, rotatedCookies);
		}
		return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
	}

	const isAuthenticated = hasRouteSession(accessToken, refreshToken, effectiveAccessToken);

	const payload = effectiveAccessToken ? decodeJwtPayload(effectiveAccessToken) : null;
	const hasAdminAccess: boolean = payload?.hasAdminAccess === true;

	if (isPublicRoute) {
		return applyRotatedCookies(NextResponse.next(), rotatedCookies);
	}

	if (isAuthRoute) {
		if (isAuthenticated && hasAdminAccess && !isTokenAuthRoute(pathname)) {
			const redirect = request.nextUrl.searchParams.get("redirect");
			const targetUrl = redirect !== null && isSafeRedirect(redirect) ? redirect : "/";
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
		const loginUrl = new URL("/auth/login", request.url);
		return applyRotatedCookies(NextResponse.redirect(loginUrl), rotatedCookies);
	}
	return applyRotatedCookies(NextResponse.next(), rotatedCookies);
}

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
