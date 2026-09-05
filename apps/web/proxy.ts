// ============================================
// proxy.ts - Web App Route Protection
// Next.js 16+ convention (replaces middleware.ts)
// Next.js 16 runs `proxy.ts` on the **Node.js** runtime by design (only the
// legacy `middleware.ts` convention can opt into Edge), so no Edge runtime
// setup is needed on Node hosts (DigitalOcean / Linode droplets, etc.).
// ============================================

import { API_BASE_URL } from "@workspace/client/lib/api/config";
import { isWebAuthPath, isWebProtectedPath, isWebPublicExactPath, isWebTokenAuthPath } from "@/lib/auth-routes";
import {
	createProxyRefreshCooldown,
	extractRotatedAccessToken,
	hasRouteSession,
	isAccessTokenExpired,
	isDocumentNavigation,
	logProxyRefresh,
	parseSetCookie,
	refreshSessionFromProxy,
	type ParsedCookie,
	type ProxyRefreshResult,
} from "@workspace/client/lib/auth/proxy-refresh";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";

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
		refreshToken,
		clientType: "web",
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
			// Faithful forwarding: the API's session cookies carry no lifetime,
			// so maxAge/expires are null and omitted — preserving the exact
			// cookie the browser would have received on a direct refresh.
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

	const isProtectedRoute = isWebProtectedPath(pathname);
	const isAuthRoute = isWebAuthPath(pathname);
	const isPublicRoute = isWebPublicExactPath(pathname);
	const isGuestBrowsable = !isProtectedRoute && !isAuthRoute;

	// ── Proxy-side silent refresh ──────────────────────────────────────────
	// The proxy runs server-side, so it CAN read the httpOnly cookies (unlike
	// browser JS). On a document navigation with an expired access token it
	// rotates the tokens BEFORE serving the page — the first API call (e.g.
	// /auth/me) then never 401s. If the refresh token is dead too, it clears
	// the stale cookies and sends the user to login, breaking the dead-session
	// bounce loop that neither the client nor the API guard could break.
	//
	// NOTE: this refresh and the client's 401-refresh are independent
	// single-flight domains — a rotation here can invalidate an in-flight
	// rotation from another tab. That is a deliberate trade-off (worst case:
	// a spurious re-login) kept in exchange for no cross-tab coordination.
	let rotatedCookies: readonly string[] = [];
	let effectiveAccessToken: string | undefined = accessToken;

	if (!isPublicRoute && accessToken !== undefined && refreshToken !== undefined && isDocumentNavigation(request.headers) && isAccessTokenExpired(accessToken)) {
		const refreshStartedAt: number = Date.now();
		const result = await attemptRefresh(refreshToken);
		const elapsedMs: number = Date.now() - refreshStartedAt;
		if (result.ok) {
			rotatedCookies = result.setCookies;
			const newAccessToken: string | undefined = extractRotatedAccessToken(result.setCookies, ACCESS_TOKEN_COOKIE);
			if (newAccessToken !== undefined) effectiveAccessToken = newAccessToken;
			logProxyRefresh({ app: "web", pathname, status: result.status, elapsedMs, outcome: "refreshed", rotatedCookieCount: result.setCookies.length });
		} else if (result.status === 401 || result.status === 403) {
			logProxyRefresh({ app: "web", pathname, status: result.status, elapsedMs, outcome: "dead-session", rotatedCookieCount: 0 });
			if (isProtectedRoute) {
				return redirectToLogin(request, pathname, rotatedCookies);
			}
			return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
		} else if (result.skipped === true) {
			// A transient failure happened recently — skip the re-attempt so a
			// dead API isn't hammered on every navigation. Serve the stale page.
			logProxyRefresh({ app: "web", pathname, status: result.status, elapsedMs, outcome: "cooldown-active", rotatedCookieCount: 0 });
		} else {
			// Network error / 5xx: fall through without clearing — don't log the
			// user out because of a temporary API blip.
			logProxyRefresh({ app: "web", pathname, status: result.status, elapsedMs, outcome: "transient-failure", rotatedCookieCount: 0, errorDetail: result.errorDetail });
		}
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

	// Login/signup bounce — but token flows (verify email, reset password) must
	// still run when the user already has a session (common right after signup).
	if (isAuthRoute && isAuthenticated && !isWebTokenAuthPath(pathname)) {
		const redirectPath: string | null = request.nextUrl.searchParams.get("redirect");
		const targetPath: string = redirectPath !== null && (isWebProtectedPath(redirectPath) || redirectPath === "/") ? redirectPath : getDefaultAuthenticatedPath();

		return applyRotatedCookies(NextResponse.redirect(new URL(targetPath, request.url)), rotatedCookies);
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
