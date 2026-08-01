// ============================================
// proxy.ts - Admin App Route Protection
// Next.js 16+ convention (replaces middleware.ts)
// ============================================

import { decodeJwtPayload } from "@workspace/client/lib/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Cookie names are isolated from web app ─────────────────────────────
// The admin panel uses separate cookie names (adminAccessToken,
// adminRefreshToken) so that a user logged in at the web app does not
// have their cookies recognized by the admin app.
const ACCESS_TOKEN_COOKIE = "adminAccessToken";
const REFRESH_TOKEN_COOKIE = "adminRefreshToken";

// Routes that require authentication + admin access
const PROTECTED_ROUTES: readonly string[] = ["/dashboard", "/users", "/roles", "/permissions", "/settings", "/audit-log", "/environments"];

// Routes that should redirect to /dashboard if already authenticated
const AUTH_ROUTES: readonly string[] = ["/auth/forgot-password"];

// Routes accessible without authentication
const PUBLIC_ROUTES: readonly string[] = [];

export function proxy(request: NextRequest): NextResponse {
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
	const { pathname } = request.nextUrl;

	const isAuthenticated = !!(accessToken && refreshToken);

	// Decode JWT to check the hasAdminAccess claim for route-level protection
	const payload = accessToken ? decodeJwtPayload(accessToken) : null;
	const hasAdminAccess: boolean = payload?.hasAdminAccess === true;

	const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
	const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route);

	// Allow public routes for everyone
	if (isPublicRoute) {
		return NextResponse.next();
	}

	// Protected routes: must be authenticated AND have admin access
	if (isProtectedRoute) {
		if (!isAuthenticated) {
			const loginUrl = new URL("/auth/login", request.url);
			loginUrl.searchParams.set("redirect", pathname);
			return NextResponse.redirect(loginUrl);
		}
		// Authenticated but not an admin — redirect to login
		if (!hasAdminAccess) {
			const loginUrl = new URL("/auth/login", request.url);
			return NextResponse.redirect(loginUrl);
		}
		// Authenticated + has admin access — proceed
		return NextResponse.next();
	}

	// Auth routes (forgot-password only): redirect to dashboard if admin
	if (isAuthRoute && isAuthenticated && hasAdminAccess) {
		const redirect = request.nextUrl.searchParams.get("redirect");
		const targetUrl = redirect && PROTECTED_ROUTES.some((route) => redirect.startsWith(route)) ? redirect : "/dashboard";
		return NextResponse.redirect(new URL(targetUrl, request.url));
	}

	// Root path: redirect admin users to dashboard
	if (pathname === "/") {
		if (isAuthenticated && hasAdminAccess) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}
		// Unauthenticated or non-admin users see the login page
	}

	return NextResponse.next();
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
