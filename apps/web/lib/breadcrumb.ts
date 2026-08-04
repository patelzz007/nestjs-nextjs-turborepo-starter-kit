import { CircleUserRound, Home } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";

/** Normalizes a pathname: collapses trailing slashes and case. */
function normalize(pathname: string): string {
	const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
	return clean.toLowerCase();
}

/**
 * Resolves the breadcrumb trail for the client-facing web app.
 *
 * The web app is intentionally small today (auth screens + the post-login
 * `/hello` page), so only authenticated content pages show a trail — auth
 * screens are full-screen and breadcrumb-free. As new routes are added, extend
 * this map; every crumb must carry an **icon** (mandatory). Unknown routes
 * still get a single current-page "Home" crumb so the trail never vanishes
 * mid-navigation.
 */
export function resolveWebTrail(pathname: string): readonly BreadcrumbItem[] {
	const normalized = normalize(pathname);

	if (normalized === "/hello") {
		return [
			{ label: "Home", href: "/hello", icon: Home },
			{ label: "Hello", icon: CircleUserRound },
		];
	}

	// Auth screens (full-screen) get no trail; anything else keeps a "Home"
	// anchor so the breadcrumb region never disappears on unknown routes.
	if (normalized === "/auth/login" || normalized === "/auth/signup" || normalized === "/auth/forgot-password") {
		return [];
	}

	return [{ label: "Home", href: "/hello", icon: Home }];
}
