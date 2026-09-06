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

const ACCESS_TOKEN_COOKIE = "merchantAccessToken";
const REFRESH_TOKEN_COOKIE = "merchantRefreshToken";
const PROTECTED_ROUTE_PREFIXES: readonly string[] = ["/analytics", "/rewards", "/redemptions", "/api-keys", "/settings"];
const AUTH_ROUTES: readonly string[] = ["/auth/login", "/auth/verify-email", "/auth/reset-password"];

/** Token links must run even when the merchant session cookie is already set. */
const TOKEN_AUTH_ROUTE_PREFIXES: readonly string[] = ["/auth/verify-email", "/auth/reset-password"];

function isTokenAuthRoute(pathname: string): boolean {
	return TOKEN_AUTH_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}

function isProtectedRoute(pathname: string): boolean {
	return pathname === "/" || PROTECTED_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}

function isAllowedPostLoginRedirect(pathname: string): boolean {
	return isProtectedRoute(pathname);
}

const attemptRefresh = createProxyRefreshCooldown((refreshToken: string): Promise<ProxyRefreshResult> =>
	refreshSessionFromProxy({
		apiBaseUrl: API_BASE_URL,
		refreshTokenName: REFRESH_TOKEN_COOKIE,
		refreshToken,
		clientType: "merchant",
	}),
);

function clearCookies(response: NextResponse, names: readonly string[]): NextResponse {
	for (const name of names) {
		response.cookies.set(name, "", { maxAge: 0, path: "/" });
	}
	return response;
}

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

/** @internal Clears the module-scope refresh cooldown between tests. */
export function resetMerchantProxyRefreshCooldownForTests(): void {
	attemptRefresh.reset();
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
	const { pathname } = request.nextUrl;

	const isProtectedRouteMatch = isProtectedRoute(pathname);
	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

	let rotatedCookies: readonly string[] = [];
	let effectiveAccessToken: string | undefined = accessToken;

	const refreshResult = await resolveProxySessionRefresh({
		accessToken,
		refreshToken,
		isDocumentNavigation: isDocumentNavigation(request.headers),
		isAuthRoute,
		isPublicRoute: false,
		accessTokenCookieName: ACCESS_TOKEN_COOKIE,
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
		return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
	}

	const isAuthenticated = hasRouteSession(accessToken, refreshToken, effectiveAccessToken);

	if (isProtectedRouteMatch && !isAuthenticated) {
		return redirectToLogin(request, pathname, rotatedCookies);
	}

	if (isProtectedRouteMatch && isAuthenticated && effectiveAccessToken !== undefined && isRestrictedSession(effectiveAccessToken) && !isEnrollmentAllowedPath(pathname)) {
		const payload = decodeJwtPayload(effectiveAccessToken);
		const enrollmentReason = payload?.isEmailVerified === false ? "email_verification" : "mfa_enrollment";
		const enrollmentPath = getEnrollmentRedirectPath("merchant", enrollmentReason);
		return applyRotatedCookies(NextResponse.redirect(new URL(enrollmentPath, request.url)), rotatedCookies);
	}

	if (isAuthRoute && isAuthenticated && !isTokenAuthRoute(pathname)) {
		const redirect = request.nextUrl.searchParams.get("redirect");
		const target = redirect !== null && isAllowedPostLoginRedirect(redirect) ? redirect : "/";
		return applyRotatedCookies(NextResponse.redirect(new URL(target, request.url)), rotatedCookies);
	}

	if (isAuthRoute && !isAuthenticated && accessToken !== undefined) {
		return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
	}

	if (!isProtectedRouteMatch && !isAuthRoute && !isAuthenticated && accessToken !== undefined) {
		return serveGuestResponse(NextResponse.next(), rotatedCookies, accessToken);
	}

	return applyRotatedCookies(NextResponse.next(), rotatedCookies);
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)"],
};
