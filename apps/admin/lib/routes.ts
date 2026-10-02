import { APP_LINKS } from "@workspace/shared";
import { routeParam } from "@workspace/ui/lib/sidebar/navigation/route-patterns";

/**
 * Every admin URL, in one typed module. Components, pages, the proxy, the
 * route-authorization rules, the command palette, and the menu-authorization
 * keys all build links from here — never from string literals — so renaming a
 * page is a one-line change that the compiler propagates.
 *
 * Conventions (domain-first, plural kebab-case nouns):
 * - CRUD shape: list `/x`, create `/x/new`, detail `/x/[id]`, edit `/x/[id]/edit`.
 * - A sidebar section's URL is its prefix (`/merchants`); the page there is the
 *   section index (the list) or a redirect to the default child.
 * - Separate pages use path segments; in-page selection on a list/queue page
 *   (a side panel or deep-linked template) stays in the query string.
 * - `/account` is the signed-in admin's personal settings; `/settings` is
 *   platform configuration only.
 *
 * Paths another process builds into URLs (the API's emails) come from
 * `APP_LINKS` in `@workspace/shared`, so the app and the emails cannot drift.
 */

/** Builds a path from one dynamic value (an id, a key). */
export type RouteBuilder = (value: string) => string;

/** List / create / detail / edit routes of one resource. */
export interface CrudRoutes {
	readonly list: string;
	readonly create: string;
	readonly detail: RouteBuilder;
	readonly edit: RouteBuilder;
}

export interface AuthRoutes {
	readonly login: string;
	readonly forgotPassword: string;
	readonly resetPassword: string;
	readonly verifyEmail: string;
}

export interface AnalyticsRoutes {
	/** Section prefix — redirects to `sales`. */
	readonly index: string;
	readonly sales: string;
	/** Sales analytics over the last `weeks` weeks (`?weeks=`, a shareable filter). */
	readonly salesForWeeks: RouteBuilder;
}

export interface UsersRoutes {
	/** Section prefix — the user list is the section index. */
	readonly list: string;
	readonly detail: RouteBuilder;
	/** Super-admin MFA-recovery queue (linked from API emails). */
	readonly mfaRecovery: string;
}

export interface MerchantsRoutes {
	/** Section prefix — the merchant list is the section index. */
	readonly list: string;
	readonly invites: string;
	readonly verification: string;
	/** Verification queue with one merchant selected in the side panel. */
	readonly verificationFor: RouteBuilder;
	readonly storeRequests: string;
}

export interface RewardsRoutes {
	/** Section prefix — redirects to `review`. */
	readonly index: string;
	readonly review: string;
}

export interface EmailsRoutes {
	/** Section prefix — redirects to `templates`. */
	readonly index: string;
	readonly templates: string;
	/** Template browser with one template preselected (`?key=`). */
	readonly template: RouteBuilder;
	readonly log: string;
}

export interface GeographyRoutes {
	readonly index: string;
}

export interface CatalogRoutes {
	/** Section prefix — redirects to `products.list`. */
	readonly index: string;
	readonly products: CrudRoutes;
	readonly categories: CrudRoutes;
}

export interface SettingsRoutes {
	/** Section prefix — redirects to `billing`. */
	readonly index: string;
	readonly billing: string;
	readonly access: string;
}

export interface AccountRoutes {
	/** Section prefix — where restricted sessions land; redirects to `security`. */
	readonly index: string;
	readonly profile: string;
	readonly security: string;
}

export interface AdminRoutes {
	readonly home: string;
	readonly auth: AuthRoutes;
	readonly analytics: AnalyticsRoutes;
	readonly users: UsersRoutes;
	readonly merchants: MerchantsRoutes;
	readonly rewards: RewardsRoutes;
	readonly emails: EmailsRoutes;
	readonly geography: GeographyRoutes;
	readonly catalog: CatalogRoutes;
	readonly settings: SettingsRoutes;
	readonly account: AccountRoutes;
}

/** Appends one encoded path segment to `base`. */
function childPath(base: string, segment: string): string {
	return `${base}/${encodeURIComponent(segment)}`;
}

/** `base?name=value`, with the value encoded. */
function withQuery(base: string, name: string, value: string): string {
	return `${base}?${new URLSearchParams({ [name]: value }).toString()}`;
}

/** Trailing segment of every edit page (`/x/[id]/edit`). */
const EDIT_SEGMENT = "edit";

function crudRoutes(list: string): CrudRoutes {
	return {
		list,
		create: `${list}/new`,
		detail: (id: string): string => childPath(list, id),
		edit: (id: string): string => `${childPath(list, id)}/${EDIT_SEGMENT}`,
	};
}

/** Query parameter of the sales analytics period preset (`/analytics/sales?weeks=8`). */
export const SALES_PERIOD_WEEKS_PARAM = "weeks";

const ANALYTICS = "/analytics";
const ANALYTICS_SALES = `${ANALYTICS}/sales`;
const USERS = "/users";
const MERCHANTS = "/merchants";
const MERCHANT_VERIFICATION = `${MERCHANTS}/verification`;
const REWARDS = "/rewards";
const EMAILS = "/emails";
const EMAIL_TEMPLATES = `${EMAILS}/templates`;
const CATALOG = "/catalog";
const SETTINGS = "/settings";
const ACCOUNT = "/account";

export const ROUTES: AdminRoutes = {
	home: APP_LINKS.admin.home,
	auth: {
		login: APP_LINKS.auth.login,
		forgotPassword: APP_LINKS.auth.forgotPassword,
		resetPassword: APP_LINKS.auth.resetPassword,
		verifyEmail: APP_LINKS.auth.verifyEmail,
	},
	analytics: {
		index: ANALYTICS,
		sales: ANALYTICS_SALES,
		salesForWeeks: (weeks: string): string => withQuery(ANALYTICS_SALES, SALES_PERIOD_WEEKS_PARAM, weeks),
	},
	users: {
		list: USERS,
		detail: (id: string): string => childPath(USERS, id),
		mfaRecovery: APP_LINKS.admin.mfaRecoveryQueue,
	},
	merchants: {
		list: MERCHANTS,
		invites: `${MERCHANTS}/invites`,
		verification: MERCHANT_VERIFICATION,
		verificationFor: (organizationId: string): string => withQuery(MERCHANT_VERIFICATION, "organizationId", organizationId),
		storeRequests: `${MERCHANTS}/store-requests`,
	},
	rewards: {
		index: REWARDS,
		review: `${REWARDS}/review`,
	},
	emails: {
		index: EMAILS,
		templates: EMAIL_TEMPLATES,
		template: (key: string): string => withQuery(EMAIL_TEMPLATES, "key", key),
		log: `${EMAILS}/log`,
	},
	geography: {
		index: "/geography",
	},
	catalog: {
		index: CATALOG,
		products: crudRoutes(`${CATALOG}/products`),
		categories: crudRoutes(`${CATALOG}/categories`),
	},
	settings: {
		index: SETTINGS,
		billing: `${SETTINGS}/billing`,
		access: `${SETTINGS}/access`,
	},
	account: {
		index: ACCOUNT,
		profile: `${ACCOUNT}/profile`,
		security: `${ACCOUNT}/security`,
	},
};

/** Detail / edit page patterns of one CRUD resource (App Router notation). */
export interface CrudRoutePatterns {
	readonly detail: string;
	readonly edit: string;
}

export interface AdminRoutePatterns {
	readonly users: { readonly detail: string };
	readonly catalog: {
		readonly products: CrudRoutePatterns;
		readonly categories: CrudRoutePatterns;
	};
}

/** Name of the dynamic segment in every admin detail page (`app/(panel)/x/[id]`). */
const ID_PARAM = "id";

function crudRoutePatterns(list: string): CrudRoutePatterns {
	const detail = `${list}/${routeParam(ID_PARAM)}`;
	return { detail, edit: `${detail}/${EDIT_SEGMENT}` };
}

/**
 * Patterns of the dynamic pages (`/catalog/products/[id]/edit`) — they key
 * route-authorization rules that differ per page of a resource. Links always
 * come from the `ROUTES` builders, never from these.
 */
export const ROUTE_PATTERNS: AdminRoutePatterns = {
	users: { detail: `${USERS}/${routeParam(ID_PARAM)}` },
	catalog: {
		products: crudRoutePatterns(ROUTES.catalog.products.list),
		categories: crudRoutePatterns(ROUTES.catalog.categories.list),
	},
};

/**
 * The `/auth` section prefix. Not a page itself (so it is not in `ROUTES`);
 * used to keep post-login redirects out of the auth pages.
 */
export const AUTH_SECTION_PREFIX = "/auth";

/**
 * Segment-aware prefix match: `/merchants` covers `/merchants` and
 * `/merchants/invites`, never `/merchantsx`. `/` covers only `/`.
 */
export function isPathWithin(prefix: string, pathname: string): boolean {
	if (prefix === "/") {
		return pathname === "/";
	}
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
