import { evaluateSidebarAuthorization } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import type { SidebarAuthorization, SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import { assertNever, type CapabilitySlug } from "@workspace/shared";
import type { SidebarTrailPage } from "@workspace/ui/lib/sidebar/navigation/resolve-sidebar-menu-trail";
import { findMostSpecificRoute } from "@workspace/ui/lib/sidebar/navigation/route-patterns";

import { ROUTE_PATTERNS, ROUTES } from "@/lib/routes";

/**
 * Who may open a page. Mirrors `proxy.ts` (`lib/auth/routes.ts`), which
 * enforces it on the server for every document request:
 * - `public` — anyone, signed in or not;
 * - `guest` — signed-out visitors only (signed-in sessions are bounced away);
 * - `signed-in` — a session is required (guests are redirected to login).
 */
export type WebRouteAudience = "public" | "guest" | "signed-in";

/** The access rule of one page of the web app. */
export interface WebRouteAccessRule {
	/** The page, in App Router notation (`/rewardhub/wallet/[claimId]`). */
	readonly pattern: string;
	readonly audience: WebRouteAudience;
	/**
	 * Capabilities the API routes the page calls require (`@RequirePermission`).
	 * Omitted → every session of the audience may use the page. The sidebar,
	 * the command palette and `WebRouteAccessGuard` all read it from here.
	 */
	readonly authorization?: SidebarAuthorization | undefined;
	/** Breadcrumb label for a page that has no menu entry of its own. */
	readonly breadcrumbLabel?: string | undefined;
}

/**
 * Every page of the web app → its access rule. One entry per `app/**\/page.tsx`
 * (a guard test fails when a page is missing or an entry has no page), each
 * commented with the API route it mirrors. UX only — the API stays
 * authoritative and `proxy.ts` enforces the audience server-side.
 */
export const WEB_ROUTE_ACCESS: readonly WebRouteAccessRule[] = [
	// GET /rewards — @Public
	{ pattern: ROUTES.home, audience: "public" },
	// GET /rewards/:rewardId — @Public
	{ pattern: ROUTE_PATTERNS.publicRewardDetail, audience: "public" },
	// GET /auth/me — any session
	{ pattern: ROUTES.hello, audience: "signed-in" },
	// POST /auth/login, /auth/register, /auth/forgot-password — signed-out visitors only
	{ pattern: ROUTES.auth.login, audience: "guest" },
	{ pattern: ROUTES.auth.signup, audience: "guest" },
	{ pattern: ROUTES.auth.forgotPassword, audience: "guest" },
	// Token flows run with or without a session (e.g. right after signup).
	{ pattern: ROUTES.auth.resetPassword, audience: "public" },
	{ pattern: ROUTES.auth.verifyEmail, audience: "public" },
	{ pattern: ROUTE_PATTERNS.verifyEmailToken, audience: "public" },
	// GET /rewards — @Public, shown inside the signed-in shell
	{ pattern: ROUTES.rewardHub.browse, audience: "signed-in" },
	// GET /rewards/:rewardId (@Public) · POST /claims/otp, POST /claims — any session
	{ pattern: ROUTE_PATTERNS.rewardHubRewardDetail, audience: "signed-in", breadcrumbLabel: "Reward" },
	// GET /claims — any session (own claims only)
	{ pattern: ROUTES.rewardHub.wallet, audience: "signed-in" },
	// GET /claims/:claimId/qr — any session (own claims only). The label matches the
	// page heading; the QR response carries no reward title to name the crumb with.
	{ pattern: ROUTE_PATTERNS.walletClaim, audience: "signed-in", breadcrumbLabel: "Show at checkout" },
	// GET /claims/analytics — any session
	{ pattern: ROUTES.rewardHub.activity, audience: "signed-in" },
	// GET /auth/me, password and MFA endpoints — any session (restricted sessions included)
	{ pattern: ROUTES.rewardHub.account, audience: "signed-in" },
];

/** The session facts a route rule is evaluated against. */
export interface WebRouteSession {
	readonly isAuthenticated: boolean;
	readonly isGranted: (permission: CapabilitySlug) => boolean;
}

/** The rule of the page at `pathname` (exact page match), or `null` when no page lives there. */
export function resolveWebRouteAccess(pathname: string, rules: readonly WebRouteAccessRule[] = WEB_ROUTE_ACCESS): WebRouteAccessRule | null {
	return findMostSpecificRoute(rules, (rule) => rule.pattern, pathname, "exact");
}

function isAudienceAllowed(audience: WebRouteAudience, isAuthenticated: boolean): boolean {
	switch (audience) {
		case "public":
			return true;
		case "guest":
			return !isAuthenticated;
		case "signed-in":
			return isAuthenticated;
		default:
			return assertNever(audience, "route audience");
	}
}

/** True when `session` may open a page governed by `rule` (audience AND capabilities). */
export function isWebRouteAllowed(rule: WebRouteAccessRule, session: WebRouteSession): boolean {
	if (!isAudienceAllowed(rule.audience, session.isAuthenticated)) {
		return false;
	}
	if (rule.authorization === undefined) {
		return true;
	}
	return evaluateSidebarAuthorization(rule.authorization, session.isGranted);
}

/** True when `href` is a page `session` may open. Unknown URLs are denied (fail closed). */
export function canAccessWebPath(href: string, session: WebRouteSession, rules: readonly WebRouteAccessRule[] = WEB_ROUTE_ACCESS): boolean {
	const rule = resolveWebRouteAccess(href, rules);
	return rule !== null && isWebRouteAllowed(rule, session);
}

/** Breadcrumb page lookup for `resolveSidebarMenuTrail`: a page (with its label) or `null`. */
export function resolveWebTrailPage(pathname: string): SidebarTrailPage | null {
	const rule = resolveWebRouteAccess(pathname);
	if (rule === null) {
		return null;
	}
	return { label: rule.breadcrumbLabel };
}

function applyToItem(item: SidebarMenuItem, rules: readonly WebRouteAccessRule[]): SidebarMenuItem {
	const rule = resolveWebRouteAccess(item.url, rules);
	const authorization = rule !== null ? rule.authorization : item.authorization;
	const children = item.children?.map((child) => applyToItem(child, rules));
	return {
		title: item.title,
		url: item.url,
		icon: item.icon,
		disabled: item.disabled,
		authorization,
		featureFlag: item.featureFlag,
		children,
	};
}

/**
 * Returns `menu` with each item that links to a page carrying that page's
 * `authorization` from `rules`, so the capability filter hides exactly the
 * items whose page the session may not open — the menu can never disagree
 * with the route table.
 */
export function applyWebRouteAuthorization(menu: SidebarMenuData, rules: readonly WebRouteAccessRule[] = WEB_ROUTE_ACCESS): SidebarMenuData {
	return {
		header: menu.header,
		sections: menu.sections.map((section) => ({ title: section.title, color: section.color, items: section.items.map((item) => applyToItem(item, rules)) })),
		bottomItems: menu.bottomItems.map((item) => applyToItem(item, rules)),
	};
}
