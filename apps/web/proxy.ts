// ============================================
// proxy.ts - Web App Route Protection
// Next.js 16+ convention (replaces middleware.ts)
// Next.js 16 runs `proxy.ts` on the **Node.js** runtime by design (only the
// legacy `middleware.ts` convention can opt into Edge), so no Edge runtime
// setup is needed on Node hosts (DigitalOcean / Linode droplets, etc.).
// ============================================

import { API_BASE_URL } from "@workspace/client/lib/api/config";
import { decodeJwtPayload } from "@workspace/client/lib/auth/jwt";
import { getEnrollmentRedirectPath, isEnrollmentAllowedPath, isRestrictedSession } from "@workspace/client/lib/auth/restricted-session";
import { isWebAuthPath, isWebProtectedPath, isWebPublicExactPath, isWebTokenAuthPath } from "@/lib/auth-routes";
import {
	applyRotatedSetCookies,
	clearAuthCookies,
	createProxyRefreshCooldown,
	hasRouteSession,
	isDocumentNavigation,
	refreshSessionFromProxy,
	resolveProxySessionRefresh,
	type ProxyRefreshResult,
} from "@workspace/client/lib/auth/proxy-refresh";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";
const CLIENT_ORIGIN: string = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
const COOKIE_CLEAR_OPTIONS = {
	domain: process.env.COOKIE_DOMAIN,
	path: "/",
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax" as const,
};

function getDefaultAuthenticatedPath(): string {
	return "/rewardhub";
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
 * Transient-failure cooldown (60s), instantiated ONCE at module scope so the
 * memoized failure survives across requests in the server process. When the
 * API is down, the first navigation inside the skew window hits it once and
 * subsequent navigations skip — silencing the ECONNREFUSED spam in the logs.
 */
const attemptRefresh = createProxyRefreshCooldown((refreshToken: string): Promise<ProxyRefreshResult> =>
	refreshSessionFromProxy({
		apiBaseUrl: API_BASE_URL,
		refreshTokenName: REFRESH_TOKEN_COOKIE,
		accessTokenName: ACCESS_TOKEN_COOKIE,
		refreshToken,
		clientType: "web",
		clientOrigin: CLIENT_ORIGIN,
	}),
);

/** @internal Clears the module-scope refresh cooldown between tests. */
export function resetWebProxyRefreshCooldownForTests(): void {
	attemptRefresh.reset();
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

export async function proxy(request: NextRequest): Promise<NextResponse> {
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
	const { pathname } = request.nextUrl;

	const isProtectedRoute = isWebProtectedPath(pathname);
	const isAuthRoute = isWebAuthPath(pathname);
	const isPublicRoute = isWebPublicExactPath(pathname);
	const isGuestBrowsable = !isProtectedRoute && !isAuthRoute;

	let rotatedCookies: readonly string[] = [];
	let effectiveAccessToken: string | undefined = accessToken;

	const refreshResult = await resolveProxySessionRefresh({
		accessToken,
		refreshToken,
		isDocumentNavigation: isDocumentNavigation(request.headers),
		isAuthRoute,
		isPublicRoute,
		accessTokenCookieName: ACCESS_TOKEN_COOKIE,
		refreshTokenCookieName: REFRESH_TOKEN_COOKIE,
		app: "web",
		pathname,
		attemptRefresh,
	});

	rotatedCookies = refreshResult.rotatedCookies;
	effectiveAccessToken = refreshResult.effectiveAccessToken;

	if (refreshResult.sessionDead) {
		if (isProtectedRoute) {
			return redirectToLogin(request, pathname, rotatedCookies);
		}
		return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
	}

	const isAuthenticated = hasRouteSession(accessToken, refreshToken, effectiveAccessToken);

	// Allow public routes for everyone
	if (isPublicRoute) {
		return applyRotatedCookies(NextResponse.next(), rotatedCookies);
	}

	// If accessing protected route without authentication, redirect to login
	if (isProtectedRoute && !isAuthenticated) {
		return redirectToLogin(request, pathname, rotatedCookies);
	}

	if (isProtectedRoute && isAuthenticated && effectiveAccessToken !== undefined && isRestrictedSession(effectiveAccessToken) && !isEnrollmentAllowedPath(pathname)) {
		const payload = decodeJwtPayload(effectiveAccessToken);
		const enrollmentReason = payload?.isEmailVerified === false ? "email_verification" : "mfa_enrollment";
		const enrollmentPath = getEnrollmentRedirectPath("web", enrollmentReason);
		return applyRotatedCookies(NextResponse.redirect(new URL(enrollmentPath, request.url)), rotatedCookies);
	}

	// Login/signup bounce — but token flows (verify email, reset password) must
	// still run when the user already has a session (common right after signup).
	if (isAuthRoute && isAuthenticated && !isWebTokenAuthPath(pathname)) {
		const redirectPath: string | null = request.nextUrl.searchParams.get("redirect");
		const targetPath: string = redirectPath !== null && (isWebProtectedPath(redirectPath) || redirectPath === "/") ? redirectPath : getDefaultAuthenticatedPath();

		return applyRotatedCookies(NextResponse.redirect(new URL(targetPath, request.url)), rotatedCookies);
	}

	if (isAuthRoute && !isAuthenticated && accessToken !== undefined) {
		return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
	}

	if (isGuestBrowsable && !isAuthenticated && accessToken !== undefined) {
		return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
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
