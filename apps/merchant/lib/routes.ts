/**
 * Typed merchant route table — the single source of every internal URL
 * (links, redirects, proxy route lists, palette items, breadcrumbs).
 *
 * Conventions:
 * - Plural, kebab-case nouns. CRUD: list `/x`, create `/x/new`, edit `/x/[id]/edit`.
 * - Business pages live under the organization scope `/orgs/[orgSlug]`.
 *   `ORG_ROUTES` holds those paths **relative to the org scope** (they are the
 *   URLs used by `data/merchant-sidebar-menu.json` and the command palette);
 *   `orgPath(slug, path)` / `orgRoutes(slug)` turn them into browser hrefs.
 * - Paths another process builds into URLs (the API's emails and invite links)
 *   come from `APP_LINKS` in `@workspace/shared`, so the app and the emails
 *   cannot drift.
 * - `account` is the signed-in user's PERSONAL settings (profile, password,
 *   2FA, sessions). `settings` is ORGANIZATION configuration (team, locations,
 *   business verification).
 */

import { APP_LINKS } from "@workspace/shared";

/** An absolute, app-relative path (always starts with `/`). */
export type AppPath = `/${string}`;

export function isAppPath(value: string): value is AppPath {
	return value.startsWith("/");
}

/** Narrows a path from a shared constant (`APP_LINKS`) to `AppPath`, failing loudly on a malformed entry. */
export function toAppPath(value: string): AppPath {
	if (!isAppPath(value)) {
		throw new Error(`Route "${value}" must start with "/"`);
	}
	return value;
}

export interface OrgRewardRoutes {
	readonly list: AppPath;
	readonly new: AppPath;
	readonly edit: (rewardId: string) => AppPath;
}

export interface OrgSettingsRoutes {
	readonly index: AppPath;
	readonly team: AppPath;
	readonly locations: AppPath;
	readonly verification: AppPath;
}

export interface OrgRouteTable {
	readonly dashboard: AppPath;
	readonly rewards: OrgRewardRoutes;
	readonly redemptions: AppPath;
	readonly analytics: AppPath;
	readonly terminals: AppPath;
	readonly apiKeys: AppPath;
	readonly account: AppPath;
	readonly settings: OrgSettingsRoutes;
}

export interface AuthRouteTable {
	readonly login: AppPath;
	readonly verifyEmail: AppPath;
	readonly forgotPassword: AppPath;
	/** Token link from the password-reset email (`?token=`). */
	readonly resetPassword: AppPath;
}

/** Top-level (non-org) routes. */
export interface AppRouteTable {
	/** Post-login entry — resolves the organization server-side and redirects into it. */
	readonly home: AppPath;
	/** Personal-account entry — resolves the organization server-side, then `/orgs/{slug}/account`. */
	readonly account: AppPath;
	readonly onboarding: AppPath;
	readonly teamInvite: AppPath;
	readonly auth: AuthRouteTable;
}

/** Prefix of every organization-scoped route. */
export const ORG_SCOPE_PREFIX: AppPath = "/orgs";

export const ROUTES: AppRouteTable = {
	home: "/",
	account: "/account",
	onboarding: toAppPath(APP_LINKS.merchant.onboarding),
	teamInvite: toAppPath(APP_LINKS.merchant.teamInvite),
	auth: {
		login: toAppPath(APP_LINKS.auth.login),
		verifyEmail: toAppPath(APP_LINKS.auth.verifyEmail),
		forgotPassword: toAppPath(APP_LINKS.auth.forgotPassword),
		resetPassword: toAppPath(APP_LINKS.auth.resetPassword),
	},
};

export const ORG_ROUTES: OrgRouteTable = {
	dashboard: "/dashboard",
	rewards: {
		list: "/rewards",
		new: "/rewards/new",
		edit: (rewardId: string): AppPath => `/rewards/${encodeURIComponent(rewardId)}/edit`,
	},
	redemptions: "/redemptions",
	analytics: "/analytics",
	terminals: "/terminals",
	apiKeys: "/api-keys",
	account: "/account",
	settings: {
		index: "/settings",
		team: "/settings/team",
		locations: "/settings/locations",
		verification: "/settings/verification",
	},
};

/** Every static org-relative route — guarded by tests against `app/orgs/[orgSlug]/**\/page.tsx`. */
export const ORG_STATIC_ROUTES: readonly AppPath[] = [
	ORG_ROUTES.dashboard,
	ORG_ROUTES.rewards.list,
	ORG_ROUTES.rewards.new,
	ORG_ROUTES.redemptions,
	ORG_ROUTES.analytics,
	ORG_ROUTES.terminals,
	ORG_ROUTES.apiKeys,
	ORG_ROUTES.account,
	ORG_ROUTES.settings.index,
	ORG_ROUTES.settings.team,
	ORG_ROUTES.settings.locations,
	ORG_ROUTES.settings.verification,
];

/** Every static top-level route — guarded by tests against `app/**\/page.tsx`. */
export const APP_STATIC_ROUTES: readonly AppPath[] = [
	ROUTES.home,
	ROUTES.account,
	ROUTES.onboarding,
	ROUTES.teamInvite,
	ROUTES.auth.login,
	ROUTES.auth.verifyEmail,
	ROUTES.auth.forgotPassword,
	ROUTES.auth.resetPassword,
];

/** Segment-aware prefix match: `/settings` matches `/settings` and `/settings/team`, never `/settings-old`. */
export function isPathWithin(pathname: string, prefix: string): boolean {
	if (prefix === "/") {
		return pathname === "/";
	}
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Path portion of a URL-ish string (drops `?query` and `#hash`). */
export function stripQueryAndHash(href: string): string {
	const cut = href.search(/[?#]/);
	return cut === -1 ? href : href.slice(0, cut);
}

/** Organization scope root: `/orgs/{slug}`. */
export function orgRoot(slug: string): AppPath {
	return `${ORG_SCOPE_PREFIX}/${encodeURIComponent(slug)}`;
}

/** Org-scoped browser href for an org-relative route: `orgPath("acme", ORG_ROUTES.rewards.list)` → `/orgs/acme/rewards`. */
export function orgPath(slug: string, path: AppPath): AppPath {
	return path === "/" ? orgRoot(slug) : `${orgRoot(slug)}${path}`;
}

/** True when `pathname` is already an org-scoped browser path (`/orgs/...`). */
export function isOrgScopedPath(pathname: string): boolean {
	return pathname.startsWith(`${ORG_SCOPE_PREFIX}/`);
}

/**
 * Org-relative part of an org-scoped browser path: `/orgs/acme/rewards/1/edit`
 * → `/rewards/1/edit`, `/orgs/acme` → `/`. `undefined` for paths outside `/orgs/{slug}`.
 */
export function toOrgRelativePath(pathname: string): AppPath | undefined {
	if (!isOrgScopedPath(pathname)) {
		return undefined;
	}
	const [, , slug, ...rest] = pathname.split("/");
	if (slug === undefined || slug.length === 0) {
		return undefined;
	}
	return `/${rest.join("/")}`;
}

/**
 * Href for an org-relative route when the organization may not be known yet.
 * Without a slug the user is sent to the top-level entry page that resolves
 * the organization server-side (`/account` for the personal account, `/` for
 * everything else).
 */
export function resolveOrgHref(slug: string | undefined, path: AppPath): AppPath {
	if (slug !== undefined && slug.length > 0) {
		return orgPath(slug, path);
	}
	return isPathWithin(path, ORG_ROUTES.account) ? ROUTES.account : ROUTES.home;
}

export interface OrgRewardHrefs {
	readonly list: AppPath;
	readonly new: AppPath;
	readonly edit: (rewardId: string) => AppPath;
}

export interface OrgSettingsHrefs {
	readonly index: AppPath;
	readonly team: AppPath;
	readonly locations: AppPath;
	readonly verification: AppPath;
}

export interface OrgHrefs {
	readonly root: AppPath;
	readonly dashboard: AppPath;
	readonly rewards: OrgRewardHrefs;
	readonly redemptions: AppPath;
	readonly analytics: AppPath;
	readonly terminals: AppPath;
	readonly apiKeys: AppPath;
	readonly account: AppPath;
	readonly settings: OrgSettingsHrefs;
}

/** Browser hrefs for one organization: `orgRoutes("acme").rewards.edit(id)` → `/orgs/acme/rewards/{id}/edit`. */
export function orgRoutes(slug: string): OrgHrefs {
	return {
		root: orgRoot(slug),
		dashboard: orgPath(slug, ORG_ROUTES.dashboard),
		rewards: {
			list: orgPath(slug, ORG_ROUTES.rewards.list),
			new: orgPath(slug, ORG_ROUTES.rewards.new),
			edit: (rewardId: string): AppPath => orgPath(slug, ORG_ROUTES.rewards.edit(rewardId)),
		},
		redemptions: orgPath(slug, ORG_ROUTES.redemptions),
		analytics: orgPath(slug, ORG_ROUTES.analytics),
		// Built by the API into emails too — `APP_LINKS` is the shared source.
		terminals: toAppPath(APP_LINKS.merchant.terminals(slug)),
		apiKeys: toAppPath(APP_LINKS.merchant.apiKeys(slug)),
		account: orgPath(slug, ORG_ROUTES.account),
		settings: {
			index: orgPath(slug, ORG_ROUTES.settings.index),
			team: orgPath(slug, ORG_ROUTES.settings.team),
			locations: orgPath(slug, ORG_ROUTES.settings.locations),
			verification: orgPath(slug, ORG_ROUTES.settings.verification),
		},
	};
}
