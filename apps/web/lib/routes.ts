/**
 * The single source of truth for every internal URL in the consumer web app.
 *
 * Conventions (docs: `rules/03-web-nextjs.md`, "URL state"):
 * - plural, kebab-case nouns; a detail page is `/<collection>/[id]`;
 * - the signed-in app lives under `/dashboard`; `/dashboard/account` is the
 *   member's personal settings (profile, password, 2FA/MFA, sessions);
 * - nothing outside this module spells out a route string — pages,
 *   components, `router.push`/`redirect`, the proxy route lists, the command
 *   palette and the breadcrumbs all read from here. The sidebar menu is JSON
 *   (`lib/navigation/user-sidebar-menu.json`) and is held to these paths by the guard
 *   tests in `lib/routes.test.ts`.
 *
 * `ROUTES` holds only paths that render a page; `ROUTE_PREFIXES` holds areas
 * and detail parents that are not pages themselves. Dynamic paths come from
 * the builders below, which encode their segments.
 *
 * Paths the API also builds into emails (auth pages, home, browse, wallet,
 * account) come from `APP_LINKS` in `@workspace/shared`, so the app and the
 * emails cannot drift apart.
 */

import type { Route } from "next";
import { APP_LINKS } from "@workspace/shared";
import { routeParam } from "@workspace/ui/lib/sidebar/navigation/route-patterns";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

export interface WebAuthRoutes {
	readonly login: Route;
	readonly signup: Route;
	readonly forgotPassword: Route;
	readonly resetPassword: Route;
	readonly verifyEmail: Route;
}

export interface WebDashboardRoutes {
	/** Signed-in browse (the app's index). */
	readonly browse: Route;
	/** The member's claimed rewards. */
	readonly wallet: Route;
	/** Claim and referral activity. */
	readonly activity: Route;
	/** Personal settings — email verification, password, 2FA/MFA, sessions. */
	readonly account: Route;
	/** Signup referral code and referee list. */
	readonly referrals: Route;
	/** The customer inbox (ADR 070). */
	readonly notifications: Route;
	/** What reaches the customer, and where: channels, quiet hours, consent per store, phones. */
	readonly notificationSettings: Route;
}

export interface WebRoutes {
	/** Public landing — guest-browsable catalogue. */
	readonly home: Route;
	/** Sample signed-in `/auth/me` page. */
	readonly hello: Route;
	readonly auth: WebAuthRoutes;
	readonly dashboard: WebDashboardRoutes;
	/** An email footer's one-click unsubscribe (`?token=`; no sign-in needed). */
	readonly unsubscribe: Route;
	/** The public status page (no sign-in needed). */
	readonly status: Route;
}

export interface WebRoutePrefixes {
	/** Every auth page lives under this prefix (no page of its own). */
	readonly auth: Route;
	/** The signed-in app shell; also the browse page. */
	readonly dashboard: Route;
	/** Parent of the public (guest) reward detail pages. */
	readonly publicRewards: Route;
	/** Parent of the signed-in reward detail pages. */
	readonly dashboardRewards: Route;
}

const AUTH_PREFIX = "/auth";
const DASHBOARD_PREFIX: string = APP_LINKS.web.dashboard;

export const ROUTES: WebRoutes = {
	home: appRoute(APP_LINKS.web.home),
	hello: "/hello",
	auth: {
		login: appRoute(APP_LINKS.auth.login),
		signup: `${AUTH_PREFIX}/signup`,
		forgotPassword: appRoute(APP_LINKS.auth.forgotPassword),
		resetPassword: appRoute(APP_LINKS.auth.resetPassword),
		verifyEmail: appRoute(APP_LINKS.auth.verifyEmail),
	},
	dashboard: {
		browse: appRoute(DASHBOARD_PREFIX),
		wallet: appRoute(APP_LINKS.web.wallet),
		activity: appRoute(`${DASHBOARD_PREFIX}/activity`),
		account: appRoute(APP_LINKS.web.account),
		referrals: appRoute(`${DASHBOARD_PREFIX}/referrals`),
		notifications: appRoute(APP_LINKS.web.notifications),
		notificationSettings: appRoute(`${APP_LINKS.web.notifications}/settings`),
	},
	unsubscribe: appRoute(APP_LINKS.web.unsubscribe),
	status: appRoute(APP_LINKS.web.status),
};

export const ROUTE_PREFIXES: WebRoutePrefixes = {
	auth: appRoute(AUTH_PREFIX),
	dashboard: appRoute(DASHBOARD_PREFIX),
	publicRewards: appRoute("/rewards"),
	dashboardRewards: appRoute(`${DASHBOARD_PREFIX}/rewards`),
};

/**
 * Page patterns for the dynamic pages, in App Router notation
 * (`/dashboard/wallet/[claimId]`). They identify a page in the route-access
 * table and the breadcrumbs — links always come from the builders below.
 */
export interface WebRoutePatterns {
	readonly publicRewardDetail: Route;
	readonly dashboardRewardDetail: Route;
	readonly walletClaim: Route;
	/** Legacy path-style verify-email link; redirects to the query-string form. */
	readonly verifyEmailToken: Route;
}

/** `<parent>/[param]` — the pattern counterpart of `childPath`. */
function childPattern(parent: string, param: string): Route {
	return appRoute(`${parent}/${routeParam(param)}`);
}

export const ROUTE_PATTERNS: WebRoutePatterns = {
	publicRewardDetail: childPattern(ROUTE_PREFIXES.publicRewards, "rewardId"),
	dashboardRewardDetail: childPattern(ROUTE_PREFIXES.dashboardRewards, "rewardId"),
	walletClaim: childPattern(ROUTES.dashboard.wallet, "claimId"),
	verifyEmailToken: childPattern(ROUTES.auth.verifyEmail, "token"),
};

/** Query parameter the login page reads to send the visitor back after signing in. */
export const LOGIN_REDIRECT_PARAM = "redirect";

/** Query parameter carrying a verify-email token. */
const VERIFY_EMAIL_TOKEN_PARAM = "token";

/** In-page anchors on the landing page (`/`). Components use these as element ids too. */
export interface LandingSectionIds {
	readonly rewards: Route;
	readonly howItWorks: Route;
}

export const LANDING_SECTION_IDS: LandingSectionIds = {
	rewards: appRoute("rewards"),
	howItWorks: appRoute("how-it-works"),
};

/** `<parent>/<segment>` with the segment URL-encoded — the shape of every detail page. */
export function childPath(parent: string, segment: string): Route {
	return appRoute(`${parent}/${encodeURIComponent(segment)}`);
}

/** Signed-in reward detail: `/dashboard/rewards/[rewardId]`. */
export function rewardDetailPath(rewardId: string): Route {
	return childPath(ROUTE_PREFIXES.dashboardRewards, rewardId);
}

/** Public (guest) reward detail: `/rewards/[rewardId]`. */
export function publicRewardDetailPath(rewardId: string): Route {
	return childPath(ROUTE_PREFIXES.publicRewards, rewardId);
}

/** A claimed reward's redemption QR in the wallet: `/dashboard/wallet/[claimId]`. */
export function walletClaimPath(claimId: string): Route {
	return childPath(ROUTES.dashboard.wallet, claimId);
}

/** Login page, optionally returning to `redirectTo` after sign-in. */
export function loginPath(redirectTo?: string): Route {
	if (redirectTo === undefined) {
		return ROUTES.auth.login;
	}
	return `${ROUTES.auth.login}?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(redirectTo)}`;
}

/** Verify-email page for a token: `/auth/verify-email?token=…`. */
export function verifyEmailPath(token: string): Route {
	return `${ROUTES.auth.verifyEmail}?${VERIFY_EMAIL_TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

/** A section anchor on the landing page, e.g. `/#rewards`. */
export function landingSectionPath(sectionId: string): Route {
	return `${ROUTES.home}#${sectionId}`;
}

/** Segment-aware prefix test, shared by every app (`isPathWithin(pathname, prefix)`). */
export { isPathWithin } from "@workspace/ui/lib/core/path-match";
