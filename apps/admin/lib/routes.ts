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
	/** The platform dashboard; `?range=` / `?from=&to=` / `?interval=` pick the view (ANALYTICS_URL_STATE). The old `/analytics/sales` redirects here. */
	readonly index: string;
}

export interface UsersRoutes {
	/** Section prefix — the user list is the section index. */
	readonly list: string;
	readonly detail: RouteBuilder;
	/** Super-admin MFA-recovery queue (linked from API emails). */
	readonly mfaRecovery: string;
	/** Super-admin just-in-time support access: request, list and revoke grants. */
	readonly supportAccess: string;
}

export interface MerchantsRoutes {
	/** Section prefix — the merchant list is the section index. */
	readonly list: string;
	/** One merchant's page: its lifecycle (suspend / reinstate) and appeals. */
	readonly detail: RouteBuilder;
	readonly invites: string;
	readonly verification: string;
	/** Verification queue with one merchant selected in the side panel. */
	readonly verificationFor: RouteBuilder;
	readonly storeRequests: string;
}

export interface RewardsRoutes {
	/** Section prefix — redirects to `review`. */
	readonly index: string;
	/** The moderation queue — a compact list; each row opens `reviewDetail`. */
	readonly review: string;
	/** One reward in full, where it is approved or rejected. */
	readonly reviewDetail: RouteBuilder;
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

export interface AuditLogsRoutes {
	/** The audit log — one timeline of every HTTP request and every database write no request made (ADR 051). */
	readonly list: string;
	/** One complete HTTP request record (payloads included). */
	readonly detail: RouteBuilder;
	/** One complete row change (the redacted row before and after). */
	readonly change: RouteBuilder;
}

export interface CatalogRoutes {
	/** Section prefix — redirects to `products.list`. */
	readonly index: string;
	readonly products: CrudRoutes;
	readonly categories: CrudRoutes;
}

export interface SettingsRoutes {
	/** Section prefix — redirects to `access`. */
	readonly index: string;
	readonly access: string;
}

export interface ComponentsRoutes {
	/** The UI kit's low-level component gallery — sample content only, no API calls. */
	readonly index: string;
	/** One component's page: its live demo and its worked examples (`/components/<slug>`). */
	readonly component: RouteBuilder;
}

export interface KanbanRoutes {
	/**
	 * The staff boards (in the Components section); `?board=planning|execution` picks the board and
	 * `?view=` / `?lanes=` / `?search=` / `?priority=` / `?team=` / `?type=` / `?sort=` the view (KANBAN_BOARD_URL_STATE).
	 */
	readonly board: string;
	/** One task, read-only: its details, attachments and comments. */
	readonly task: RouteBuilder;
	/** One task's editor. */
	readonly editTask: RouteBuilder;
}

/** The operations console (ADR 068): servers, instances, dependencies, alerts, backups and load tests. */
export interface OperationsRoutes {
	/** Section index: redirects to the servers overview (the sidebar lists it as a toggle-only parent). */
	readonly index: string;
	/** The overview: every server, instance, dependency and open alert. */
	readonly servers: string;
	/** One server: its facts, live numbers and history. */
	readonly server: RouteBuilder;
	readonly alerts: string;
	/** SuperAdmin only. */
	readonly backups: string;
	readonly loadTests: string;
	/** One load test: its timeline, steps and the servers' load. */
	readonly loadTest: RouteBuilder;
	/** Two load tests side by side (`?a=&b=`). */
	readonly compare: (left: string, right: string) => string;
}

export interface AccountRoutes {
	/** Section prefix — where restricted sessions land; redirects to `security`. */
	readonly index: string;
	/** The signed-in admin's own profile (`GET`/`PATCH /auth/profile`). */
	readonly profile: string;
	readonly security: string;
	/** The signed-in admin's own GitHub token (`GET`/`PUT`/`DELETE /github/account`). */
	readonly github: string;
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
	readonly auditLogs: AuditLogsRoutes;
	readonly catalog: CatalogRoutes;
	readonly settings: SettingsRoutes;
	readonly components: ComponentsRoutes;
	readonly kanban: KanbanRoutes;
	readonly operations: OperationsRoutes;
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

/** Query parameter of the login page holding the in-app path to return to after sign-in (`/auth/login?redirect=/users`). */
export const LOGIN_REDIRECT_PARAM = "redirect";

/** Query parameter carrying the single-use token of an emailed auth link (`/auth/verify-email?token=`). */
export const AUTH_LINK_TOKEN_PARAM = "token";

// In-page selection params (lib/url-state declares how each is parsed).
/** The merchant selected in the KYB verification queue (`/merchants/verification?tenantId=`). */
export const MERCHANT_VERIFICATION_TENANT_PARAM = "tenantId";
/** The template selected in the template browser (`/emails/templates?key=`). */
export const EMAIL_TEMPLATE_KEY_PARAM = "key";
/** The request selected in a review queue (MFA recovery, store location requests). */
export const REVIEW_REQUEST_PARAM = "requestId";
/** The audit record open in the audit log's drawer (`/audit-logs?record=`). */
export const AUDIT_LOG_RECORD_PARAM = "record";
/** The row change open in the audit log's drawer (`/audit-logs?change=`). */
export const DATA_CHANGE_RECORD_PARAM = "change";
/** The active tab of the geography browser (`/geography?tab=states`). */
export const GEOGRAPHY_TAB_PARAM = "tab";

const ANALYTICS = "/analytics";
const USERS = "/users";
const MERCHANTS = "/merchants";
const MERCHANT_VERIFICATION = `${MERCHANTS}/verification`;
const REWARDS = "/rewards";
const REWARDS_REVIEW = `${REWARDS}/review`;
const EMAILS = "/emails";
const EMAIL_TEMPLATES = `${EMAILS}/templates`;
const AUDIT_LOGS = "/audit-logs";
/** Row changes live under the audit log (`/audit-logs/changes/[id]`). */
const AUDIT_LOG_CHANGES = `${AUDIT_LOGS}/changes`;
const CATALOG = "/catalog";
const SETTINGS = "/settings";
const ACCOUNT = "/account";
const COMPONENTS = "/components";
/** The board sits in the Components section (sidebar), beside the gallery, so its URL nests under it. */
const KANBAN = `${COMPONENTS}/kanban-board`;
const KANBAN_TASKS = `${KANBAN}/tasks`;
const OPERATIONS = "/operations";
const OPERATIONS_SERVERS = `${OPERATIONS}/servers`;
const OPERATIONS_LOAD_TESTS = `${OPERATIONS}/load-tests`;
/** The two runs a comparison shows (`/operations/load-tests/compare?a=&b=`). */
export const LOAD_TEST_COMPARE_PARAMS = { left: "a", right: "b" } satisfies Record<string, string>;

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
	},
	users: {
		list: USERS,
		detail: (id: string): string => childPath(USERS, id),
		mfaRecovery: APP_LINKS.admin.mfaRecoveryQueue,
		supportAccess: `${USERS}/support-access`,
	},
	merchants: {
		list: MERCHANTS,
		detail: (id: string): string => childPath(MERCHANTS, id),
		invites: `${MERCHANTS}/invites`,
		verification: MERCHANT_VERIFICATION,
		verificationFor: (tenantId: string): string => withQuery(MERCHANT_VERIFICATION, MERCHANT_VERIFICATION_TENANT_PARAM, tenantId),
		storeRequests: `${MERCHANTS}/store-requests`,
	},
	rewards: {
		index: REWARDS,
		review: REWARDS_REVIEW,
		reviewDetail: (id: string): string => childPath(REWARDS_REVIEW, id),
	},
	emails: {
		index: EMAILS,
		templates: EMAIL_TEMPLATES,
		template: (key: string): string => withQuery(EMAIL_TEMPLATES, EMAIL_TEMPLATE_KEY_PARAM, key),
		log: `${EMAILS}/log`,
	},
	geography: {
		index: "/geography",
	},
	auditLogs: {
		list: AUDIT_LOGS,
		detail: (id: string): string => childPath(AUDIT_LOGS, id),
		change: (id: string): string => childPath(AUDIT_LOG_CHANGES, id),
	},
	catalog: {
		index: CATALOG,
		products: crudRoutes(`${CATALOG}/products`),
		categories: crudRoutes(`${CATALOG}/categories`),
	},
	settings: {
		index: SETTINGS,
		access: `${SETTINGS}/access`,
	},
	components: {
		index: COMPONENTS,
		component: (slug: string): string => childPath(COMPONENTS, slug),
	},
	kanban: {
		board: KANBAN,
		task: (id: string): string => childPath(KANBAN_TASKS, id),
		editTask: (id: string): string => `${childPath(KANBAN_TASKS, id)}/${EDIT_SEGMENT}`,
	},
	operations: {
		index: OPERATIONS,
		servers: OPERATIONS_SERVERS,
		server: (id: string): string => childPath(OPERATIONS_SERVERS, id),
		alerts: `${OPERATIONS}/alerts`,
		backups: `${OPERATIONS}/backups`,
		loadTests: OPERATIONS_LOAD_TESTS,
		loadTest: (id: string): string => childPath(OPERATIONS_LOAD_TESTS, id),
		compare: (left: string, right: string): string =>
			`${OPERATIONS_LOAD_TESTS}/compare?${new URLSearchParams({ [LOAD_TEST_COMPARE_PARAMS.left]: left, [LOAD_TEST_COMPARE_PARAMS.right]: right }).toString()}`,
	},
	account: {
		index: ACCOUNT,
		profile: `${ACCOUNT}/profile`,
		security: `${ACCOUNT}/security`,
		github: `${ACCOUNT}/github`,
	},
};

/** Detail / edit page patterns of one CRUD resource (App Router notation). */
export interface CrudRoutePatterns {
	readonly detail: string;
	readonly edit: string;
}

export interface AdminRoutePatterns {
	readonly users: { readonly detail: string };
	readonly merchants: { readonly detail: string };
	readonly auditLogs: { readonly detail: string; readonly change: string };
	readonly rewards: { readonly reviewDetail: string };
	readonly catalog: {
		readonly products: CrudRoutePatterns;
		readonly categories: CrudRoutePatterns;
	};
	readonly kanban: { readonly task: string; readonly editTask: string };
	readonly operations: { readonly server: string; readonly loadTest: string; readonly compare: string };
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
	merchants: { detail: `${MERCHANTS}/${routeParam(ID_PARAM)}` },
	auditLogs: { detail: `${AUDIT_LOGS}/${routeParam(ID_PARAM)}`, change: `${AUDIT_LOG_CHANGES}/${routeParam(ID_PARAM)}` },
	rewards: { reviewDetail: `${REWARDS_REVIEW}/${routeParam(ID_PARAM)}` },
	catalog: {
		products: crudRoutePatterns(ROUTES.catalog.products.list),
		categories: crudRoutePatterns(ROUTES.catalog.categories.list),
	},
	kanban: { task: `${KANBAN_TASKS}/${routeParam(ID_PARAM)}`, editTask: `${KANBAN_TASKS}/${routeParam(ID_PARAM)}/${EDIT_SEGMENT}` },
	operations: {
		server: `${OPERATIONS_SERVERS}/${routeParam(ID_PARAM)}`,
		loadTest: `${OPERATIONS_LOAD_TESTS}/${routeParam(ID_PARAM)}`,
		compare: `${OPERATIONS_LOAD_TESTS}/compare`,
	},
};

/**
 * The `/auth` section prefix. Not a page itself (so it is not in `ROUTES`);
 * used to keep post-login redirects out of the auth pages.
 */
export const AUTH_SECTION_PREFIX = "/auth";

/** Segment-aware prefix test, shared by every app (`isPathWithin(pathname, prefix)` — pathname FIRST). */
export { isPathWithin } from "@workspace/ui/lib/core/path-match";
