import { API_BASE_URL } from "@workspace/client/lib/api/config";
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

const ACCESS_TOKEN_COOKIE = "merchantAccessToken";
const REFRESH_TOKEN_COOKIE = "merchantRefreshToken";
const PROTECTED_ROUTE_PREFIXES: readonly string[] = ["/analytics", "/rewards", "/redemptions", "/api-keys"];
const AUTH_ROUTES: readonly string[] = ["/auth/login"];

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

export async function proxy(request: NextRequest): Promise<NextResponse> {
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
	const { pathname } = request.nextUrl;

	const isProtectedRouteMatch = isProtectedRoute(pathname);
	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

	let rotatedCookies: readonly string[] = [];
	let effectiveAccessToken: string | undefined = accessToken;

	if (accessToken !== undefined && refreshToken !== undefined && isDocumentNavigation(request.headers) && isAccessTokenExpired(accessToken)) {
		const refreshStartedAt: number = Date.now();
		const result = await attemptRefresh(refreshToken);
		const elapsedMs: number = Date.now() - refreshStartedAt;
		if (result.ok) {
			rotatedCookies = result.setCookies;
			const newAccessToken: string | undefined = extractRotatedAccessToken(result.setCookies, ACCESS_TOKEN_COOKIE);
			if (newAccessToken !== undefined) effectiveAccessToken = newAccessToken;
			logProxyRefresh({ app: "merchant", pathname, status: result.status, elapsedMs, outcome: "refreshed", rotatedCookieCount: result.setCookies.length });
		} else if (result.status === 401 || result.status === 403) {
			const loginUrl = new URL("/auth/login", request.url);
			loginUrl.searchParams.set("redirect", pathname);
			return clearCookies(NextResponse.redirect(loginUrl), [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]);
		}
	}

	const isAuthenticated = hasRouteSession(accessToken, refreshToken, effectiveAccessToken);

	if (isProtectedRouteMatch && !isAuthenticated) {
		const loginUrl = new URL("/auth/login", request.url);
		loginUrl.searchParams.set("redirect", pathname);
		return clearCookies(applyRotatedCookies(NextResponse.redirect(loginUrl), rotatedCookies), [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]);
	}

	if (isAuthRoute && isAuthenticated) {
		const redirect = request.nextUrl.searchParams.get("redirect");
		const target = redirect !== null && isAllowedPostLoginRedirect(redirect) ? redirect : "/";
		return applyRotatedCookies(NextResponse.redirect(new URL(target, request.url)), rotatedCookies);
	}

	return applyRotatedCookies(NextResponse.next(), rotatedCookies);
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)"],
};
