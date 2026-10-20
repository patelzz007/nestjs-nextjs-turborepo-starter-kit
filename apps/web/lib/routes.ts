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
 *   (`data/user-sidebar-menu.json`) and is held to these paths by the guard
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

import { APP_LINKS } from "@workspace/shared";
import { routeParam } from "@workspace/ui/lib/sidebar/navigation/route-patterns";

export interface WebAuthRoutes {
	readonly login: string;
	readonly signup: string;
	readonly forgotPassword: string;
	readonly resetPassword: string;
	readonly verifyEmail: string;
}

export interface WebDashboardRoutes {
	/** Signed-in browse (the app's index). */
	readonly browse: string;
	/** The member's claimed rewards. */
	readonly wallet: string;
	/** Claim and referral activity. */
	readonly activity: string;
	/** Personal settings — email verification, password, 2FA/MFA, sessions. */
	readonly account: string;
	/** Signup referral code and referee list. */
	readonly referrals: string;
}

export interface WebRoutes {
	/** Public landing — guest-browsable catalogue. */
	readonly home: string;
	/** Sample signed-in `/auth/me` page. */
	readonly hello: string;
	readonly auth: WebAuthRoutes;
	readonly dashboard: WebDashboardRoutes;
}

export interface WebRoutePrefixes {
	/** Every auth page lives under this prefix (no page of its own). */
	readonly auth: string;
	/** The signed-in app shell; also the browse page. */
	readonly dashboard: string;
	/** Parent of the public (guest) reward detail pages. */
	readonly publicRewards: string;
	/** Parent of the signed-in reward detail pages. */
	readonly dashboardRewards: string;
}

const AUTH_PREFIX = "/auth";
const DASHBOARD_PREFIX: string = APP_LINKS.web.dashboard;

export const ROUTES: WebRoutes = {
	home: APP_LINKS.web.home,
	hello: "/hello",
	auth: {
		login: APP_LINKS.auth.login,
		signup: `${AUTH_PREFIX}/signup`,
		forgotPassword: APP_LINKS.auth.forgotPassword,
		resetPassword: APP_LINKS.auth.resetPassword,
		verifyEmail: APP_LINKS.auth.verifyEmail,
	},
	dashboard: {
		browse: DASHBOARD_PREFIX,
		wallet: APP_LINKS.web.wallet,
		activity: `${DASHBOARD_PREFIX}/activity`,
		account: APP_LINKS.web.account,
		referrals: `${DASHBOARD_PREFIX}/referrals`,
	},
};

export const ROUTE_PREFIXES: WebRoutePrefixes = {
	auth: AUTH_PREFIX,
	dashboard: DASHBOARD_PREFIX,
	publicRewards: "/rewards",
	dashboardRewards: `${DASHBOARD_PREFIX}/rewards`,
};

/**
 * Page patterns for the dynamic pages, in App Router notation
 * (`/dashboard/wallet/[claimId]`). They identify a page in the route-access
 * table and the breadcrumbs — links always come from the builders below.
 */
export interface WebRoutePatterns {
	readonly publicRewardDetail: string;
	readonly dashboardRewardDetail: string;
	readonly walletClaim: string;
	/** Legacy path-style verify-email link; redirects to the query-string form. */
	readonly verifyEmailToken: string;
}

/** `<parent>/[param]` — the pattern counterpart of `childPath`. */
function childPattern(parent: string, param: string): string {
	return `${parent}/${routeParam(param)}`;
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
	readonly rewards: string;
	readonly howItWorks: string;
}

export const LANDING_SECTION_IDS: LandingSectionIds = {
	rewards: "rewards",
	howItWorks: "how-it-works",
};

/** `<parent>/<segment>` with the segment URL-encoded — the shape of every detail page. */
export function childPath(parent: string, segment: string): string {
	return `${parent}/${encodeURIComponent(segment)}`;
}

/** Signed-in reward detail: `/dashboard/rewards/[rewardId]`. */
export function rewardDetailPath(rewardId: string): string {
	return childPath(ROUTE_PREFIXES.dashboardRewards, rewardId);
}

/** Public (guest) reward detail: `/rewards/[rewardId]`. */
export function publicRewardDetailPath(rewardId: string): string {
	return childPath(ROUTE_PREFIXES.publicRewards, rewardId);
}

/** A claimed reward's redemption QR in the wallet: `/dashboard/wallet/[claimId]`. */
export function walletClaimPath(claimId: string): string {
	return childPath(ROUTES.dashboard.wallet, claimId);
}

/** Login page, optionally returning to `redirectTo` after sign-in. */
export function loginPath(redirectTo?: string): string {
	if (redirectTo === undefined) {
		return ROUTES.auth.login;
	}
	return `${ROUTES.auth.login}?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(redirectTo)}`;
}

/** Verify-email page for a token: `/auth/verify-email?token=…`. */
export function verifyEmailPath(token: string): string {
	return `${ROUTES.auth.verifyEmail}?${VERIFY_EMAIL_TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

/** A section anchor on the landing page, e.g. `/#rewards`. */
export function landingSectionPath(sectionId: string): string {
	return `${ROUTES.home}#${sectionId}`;
}

/** Segment-aware prefix test, shared by every app (`isPathWithin(pathname, prefix)`). */
export { isPathWithin } from "@workspace/ui/lib/core/path-match";
