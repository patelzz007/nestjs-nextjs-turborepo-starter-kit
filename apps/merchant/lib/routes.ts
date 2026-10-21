/**
 * Typed merchant route table — the single source of every internal URL
 * (links, redirects, proxy route lists, palette items, breadcrumbs).
 *
 * Conventions:
 * - Plural, kebab-case nouns. CRUD: list `/x`, create `/x/new`, view `/x/[id]`, edit `/x/[id]/edit`.
 * - Business pages live under the tenant scope `/t/[tenantSlug]`.
 *   `TENANT_ROUTES` holds those paths **relative to the tenant scope** (they are the
 *   URLs used by `data/merchant-sidebar-menu.json` and the command palette);
 *   `tenantPath(slug, path)` / `tenantRoutes(slug)` turn them into browser hrefs.
 * - Paths another process builds into URLs (the API's emails and invite links)
 *   come from `APP_LINKS` in `@workspace/shared`, so the app and the emails
 *   cannot drift.
 * - `account` is the signed-in user's PERSONAL settings (profile, password,
 *   2FA, sessions). `settings` is TENANT configuration (team, locations,
 *   business verification, banned customers).
 */

import { APP_LINKS } from "@workspace/shared";
import { isPathWithin } from "@workspace/ui/lib/core/path-match";

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

export interface TenantRewardRoutes {
	readonly list: AppPath;
	readonly new: AppPath;
	/** The reward's read-only page: what customers see, its performance and its lifecycle actions. */
	readonly detail: (rewardId: string) => AppPath;
	readonly edit: (rewardId: string) => AppPath;
}

export interface TenantSettingsRoutes {
	readonly index: AppPath;
	readonly team: AppPath;
	readonly locations: AppPath;
	readonly branding: AppPath;
	readonly verification: AppPath;
	readonly bannedCustomers: AppPath;
}

export interface TenantRouteTable {
	readonly dashboard: AppPath;
	readonly rewards: TenantRewardRoutes;
	readonly redemptions: AppPath;
	readonly analytics: AppPath;
	readonly terminals: AppPath;
	readonly apiKeys: AppPath;
	readonly account: AppPath;
	/** Every store the member belongs to (the switcher lists the first page). */
	readonly stores: AppPath;
	readonly settings: TenantSettingsRoutes;
}

export interface AuthRouteTable {
	readonly login: AppPath;
	readonly verifyEmail: AppPath;
	readonly forgotPassword: AppPath;
	/** Token link from the password-reset email (`?token=`). */
	readonly resetPassword: AppPath;
}

/** Top-level (non-tenant) routes. */
export interface AppRouteTable {
	/** Post-login entry — resolves the tenant server-side and redirects into it. */
	readonly home: AppPath;
	/** Personal-account entry — resolves the tenant server-side, then `/t/{slug}/account`. */
	readonly account: AppPath;
	readonly onboarding: AppPath;
	readonly teamInvite: AppPath;
	readonly auth: AuthRouteTable;
}

/** Prefix of every tenant-scoped route. */
export const TENANT_SCOPE_PREFIX: AppPath = "/t";

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

export const TENANT_ROUTES: TenantRouteTable = {
	dashboard: "/dashboard",
	rewards: {
		list: "/rewards",
		new: "/rewards/new",
		detail: (rewardId: string): AppPath => `/rewards/${encodeURIComponent(rewardId)}`,
		edit: (rewardId: string): AppPath => `/rewards/${encodeURIComponent(rewardId)}/edit`,
	},
	redemptions: "/redemptions",
	analytics: "/analytics",
	terminals: "/terminals",
	apiKeys: "/api-keys",
	account: "/account",
	stores: "/stores",
	settings: {
		index: "/settings",
		team: "/settings/team",
		locations: "/settings/locations",
		branding: "/settings/branding",
		verification: "/settings/verification",
		bannedCustomers: "/settings/banned-customers",
	},
};

/** Every static tenant-relative route — guarded by tests against `app/t/[tenantSlug]/**\/page.tsx`. */
export const TENANT_STATIC_ROUTES: readonly AppPath[] = [
	TENANT_ROUTES.dashboard,
	TENANT_ROUTES.rewards.list,
	TENANT_ROUTES.rewards.new,
	TENANT_ROUTES.redemptions,
	TENANT_ROUTES.analytics,
	TENANT_ROUTES.terminals,
	TENANT_ROUTES.apiKeys,
	TENANT_ROUTES.account,
	TENANT_ROUTES.stores,
	TENANT_ROUTES.settings.index,
	TENANT_ROUTES.settings.team,
	TENANT_ROUTES.settings.locations,
	TENANT_ROUTES.settings.branding,
	TENANT_ROUTES.settings.verification,
	TENANT_ROUTES.settings.bannedCustomers,
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

/** Segment-aware prefix test, shared by every app (`isPathWithin(pathname, prefix)`). */
export { isPathWithin };

/** Path portion of a URL-ish string (drops `?query` and `#hash`). */
export function stripQueryAndHash(href: string): string {
	const cut = href.search(/[?#]/);
	return cut === -1 ? href : href.slice(0, cut);
}

/** Tenant scope root: `/t/{slug}`. */
export function tenantRoot(slug: string): AppPath {
	return `${TENANT_SCOPE_PREFIX}/${encodeURIComponent(slug)}`;
}

/** Tenant-scoped browser href for an tenant-relative route: `tenantPath("acme", TENANT_ROUTES.rewards.list)` → `/t/acme/rewards`. */
export function tenantPath(slug: string, path: AppPath): AppPath {
	return path === "/" ? tenantRoot(slug) : `${tenantRoot(slug)}${path}`;
}

/** True when `pathname` is already an tenant-scoped browser path (`/t/...`). */
export function isTenantScopedPath(pathname: string): boolean {
	return pathname.startsWith(`${TENANT_SCOPE_PREFIX}/`);
}

/**
 * Tenant-relative part of an tenant-scoped browser path: `/t/acme/rewards/1/edit`
 * → `/rewards/1/edit`, `/t/acme` → `/`. `undefined` for paths outside `/t/{slug}`.
 */
export function toTenantRelativePath(pathname: string): AppPath | undefined {
	if (!isTenantScopedPath(pathname)) {
		return undefined;
	}
	const [, , slug, ...rest] = pathname.split("/");
	if (slug === undefined || slug.length === 0) {
		return undefined;
	}
	return `/${rest.join("/")}`;
}

/**
 * Href for an tenant-relative route when the tenant may not be known yet.
 * Without a slug the user is sent to the top-level entry page that resolves
 * the tenant server-side (`/account` for the personal account, `/` for
 * everything else).
 */
export function resolveTenantHref(slug: string | undefined, path: AppPath): AppPath {
	if (slug !== undefined && slug.length > 0) {
		return tenantPath(slug, path);
	}
	return isPathWithin(path, TENANT_ROUTES.account) ? ROUTES.account : ROUTES.home;
}

export interface TenantRewardHrefs {
	readonly list: AppPath;
	readonly new: AppPath;
	readonly detail: (rewardId: string) => AppPath;
	readonly edit: (rewardId: string) => AppPath;
}

export interface TenantSettingsHrefs {
	readonly index: AppPath;
	readonly team: AppPath;
	readonly locations: AppPath;
	readonly branding: AppPath;
	readonly verification: AppPath;
	readonly bannedCustomers: AppPath;
}

export interface TenantHrefs {
	readonly root: AppPath;
	readonly dashboard: AppPath;
	readonly rewards: TenantRewardHrefs;
	readonly redemptions: AppPath;
	readonly analytics: AppPath;
	readonly terminals: AppPath;
	readonly apiKeys: AppPath;
	readonly account: AppPath;
	readonly stores: AppPath;
	readonly settings: TenantSettingsHrefs;
}

/** Browser hrefs for one tenant: `tenantRoutes("acme").rewards.edit(id)` → `/t/acme/rewards/{id}/edit`. */
export function tenantRoutes(slug: string): TenantHrefs {
	return {
		root: tenantRoot(slug),
		dashboard: tenantPath(slug, TENANT_ROUTES.dashboard),
		rewards: {
			list: tenantPath(slug, TENANT_ROUTES.rewards.list),
			new: tenantPath(slug, TENANT_ROUTES.rewards.new),
			detail: (rewardId: string): AppPath => tenantPath(slug, TENANT_ROUTES.rewards.detail(rewardId)),
			edit: (rewardId: string): AppPath => tenantPath(slug, TENANT_ROUTES.rewards.edit(rewardId)),
		},
		redemptions: tenantPath(slug, TENANT_ROUTES.redemptions),
		analytics: tenantPath(slug, TENANT_ROUTES.analytics),
		// Built by the API into emails too — `APP_LINKS` is the shared source.
		terminals: toAppPath(APP_LINKS.merchant.terminals(slug)),
		apiKeys: toAppPath(APP_LINKS.merchant.apiKeys(slug)),
		account: tenantPath(slug, TENANT_ROUTES.account),
		stores: tenantPath(slug, TENANT_ROUTES.stores),
		settings: {
			index: tenantPath(slug, TENANT_ROUTES.settings.index),
			team: tenantPath(slug, TENANT_ROUTES.settings.team),
			locations: tenantPath(slug, TENANT_ROUTES.settings.locations),
			branding: tenantPath(slug, TENANT_ROUTES.settings.branding),
			verification: tenantPath(slug, TENANT_ROUTES.settings.verification),
			bannedCustomers: tenantPath(slug, TENANT_ROUTES.settings.bannedCustomers),
		},
	};
}
