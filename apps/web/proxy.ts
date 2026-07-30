// ============================================
// proxy.ts - Web App Route Protection
// Next.js 16+ convention (replaces middleware.ts)
// ============================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";

// Routes that require authentication
const PROTECTED_ROUTES: readonly string[] = ["/hello", "/dashboard", "/profile", "/welcome", "/settings"];

// Routes that should redirect to /hello if already authenticated
const AUTH_ROUTES: readonly string[] = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

// Routes accessible without authentication (but still respects auth status)
const PUBLIC_ROUTES: readonly string[] = ["/about", "/contact"];

export function proxy(request: NextRequest): NextResponse {
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
	const { pathname } = request.nextUrl;

	// Check if user is authenticated (has both tokens)
	const isAuthenticated = !!(accessToken && refreshToken);

	// Check route types
	const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
	const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route);

	// Allow public routes for everyone
	if (isPublicRoute) {
		return NextResponse.next();
	}

	// If accessing protected route without authentication, redirect to login
	if (isProtectedRoute && !isAuthenticated) {
		const loginUrl = new URL("/auth/login", request.url);
		loginUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(loginUrl);
	}

	// If accessing auth routes while authenticated, redirect to /hello
	if (isAuthRoute && isAuthenticated) {
		// Check if there's a redirect parameter
		const redirect = request.nextUrl.searchParams.get("redirect");
		const targetUrl = redirect && PROTECTED_ROUTES.some((route) => redirect.startsWith(route)) ? redirect : "/hello";

		return NextResponse.redirect(new URL(targetUrl, request.url));
	}

	// For root path, redirect authenticated users to their landing page
	if (pathname === "/") {
		if (isAuthenticated) {
			return NextResponse.redirect(new URL("/hello", request.url));
		}
		// Unauthenticated users see the login page (NextResponse.next())
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
