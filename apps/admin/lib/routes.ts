import type { Route } from "next";
import { APP_LINKS } from "@workspace/shared";
import { routeParam } from "@workspace/ui/lib/sidebar/navigation/route-patterns";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

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
export type RouteBuilder = (value: string) => Route;

/** List / create / detail / edit routes of one resource. */
export interface CrudRoutes {
	readonly list: Route;
	readonly create: Route;
	readonly detail: RouteBuilder;
	readonly edit: RouteBuilder;
}

export interface AuthRoutes {
	readonly login: Route;
	readonly forgotPassword: Route;
	readonly resetPassword: Route;
	readonly verifyEmail: Route;
}

export interface AnalyticsRoutes {
	/** The platform dashboard; `?range=` / `?from=&to=` / `?interval=` pick the view (ANALYTICS_URL_STATE). The old `/analytics/sales` redirects here. */
	readonly index: Route;
}

export interface UsersRoutes {
	/** Section prefix — the user list is the section index. */
	readonly list: Route;
	readonly detail: RouteBuilder;
	/** Super-admin MFA-recovery queue (linked from API emails). */
	readonly mfaRecovery: Route;
	/** Super-admin just-in-time support access: request, list and revoke grants. */
	readonly supportAccess: Route;
}

export interface MerchantsRoutes {
	/** Section prefix — the merchant list is the section index. */
	readonly list: Route;
	/** One merchant's page: its lifecycle (suspend / reinstate) and appeals. */
	readonly detail: RouteBuilder;
	readonly invites: Route;
	readonly verification: Route;
	/** Verification queue with one merchant selected in the side panel. */
	readonly verificationFor: RouteBuilder;
	readonly storeRequests: Route;
}

export interface RewardsRoutes {
	/** Section prefix — redirects to `review`. */
	readonly index: Route;
	/** The moderation queue — a compact list; each row opens `reviewDetail`. */
	readonly review: Route;
	/** One reward in full, where it is approved or rejected. */
	readonly reviewDetail: RouteBuilder;
}

export interface EmailsRoutes {
	/** Section prefix — redirects to `templates`. */
	readonly index: Route;
	readonly templates: Route;
	/** Template browser with one template preselected (`?key=`). */
	readonly template: RouteBuilder;
	readonly log: Route;
	/** Broadcasts and their reports (ADR 073). */
	readonly broadcasts: Route;
	/** Write a platform broadcast. */
	readonly broadcastNew: Route;
	/** One broadcast: its message, audience, status and results. */
	readonly broadcast: RouteBuilder;
	/** A platform draft in the composer. */
	readonly broadcastEdit: RouteBuilder;
}

export interface GeographyRoutes {
	readonly index: Route;
}

export interface AuditLogsRoutes {
	/** The audit log — one timeline of every HTTP request and every database write no request made (ADR 051). */
	readonly list: Route;
	/** One complete HTTP request record (payloads included). */
	readonly detail: RouteBuilder;
	/** One complete row change (the redacted row before and after). */
	readonly change: RouteBuilder;
}

/** The log of webhooks providers sent the API (ADR 081). */
export interface WebhooksRoutes {
	/** Every received webhook, newest first; `?filter[provider]=` / `?filter[outcome]=` narrow it (RECEIVED_WEBHOOKS_URL_STATE). */
	readonly received: Route;
	/** One received webhook: its signature check, outcome and allowlisted headers. */
	readonly receivedDetail: RouteBuilder;
}

export interface CatalogRoutes {
	/** Section prefix — redirects to `products.list`. */
	readonly index: Route;
	readonly products: CrudRoutes;
	readonly categories: CrudRoutes;
}

export interface SettingsRoutes {
	/** Section prefix — redirects to `access`. */
	readonly index: Route;
	readonly access: Route;
	/** Runtime feature flags (enhancement 5.6). */
	readonly featureFlags: Route;
}

export interface ComponentsRoutes {
	/** The UI kit's low-level component gallery — sample content only, no API calls. */
	readonly index: Route;
	/** One component's page: its live demo and its worked examples (`/components/<slug>`). */
	readonly component: RouteBuilder;
}

export interface KanbanRoutes {
	/**
	 * The staff boards (in the Components section); `?board=planning|execution` picks the board and
	 * `?view=` / `?lanes=` / `?search=` / `?priority=` / `?team=` / `?type=` / `?sort=` the view (KANBAN_BOARD_URL_STATE).
	 */
	readonly board: Route;
	/** One task, read-only: its details, attachments and comments. */
	readonly task: RouteBuilder;
	/** One task's editor. */
	readonly editTask: RouteBuilder;
}

/** The operations console (ADR 068): servers, instances, dependencies, alerts, backups and load tests. */
export interface OperationsRoutes {
	/** Section index: redirects to the servers overview (the sidebar lists it as a toggle-only parent). */
	readonly index: Route;
	/** The overview: every server, instance, dependency and open alert. */
	readonly servers: Route;
	/** One server: its facts, live numbers and history. */
	readonly server: RouteBuilder;
	readonly alerts: Route;
	/** SuperAdmin only. */
	readonly backups: Route;
	/** Rate limiting (ADR 071): policies, refusals, tenant overrides, penalties. */
	readonly rateLimits: Route;
	/** The distributed cache (ADR 072): per-cache numbers, Redis memory, flushes. */
	readonly cache: Route;
	/** Background job queues (enhancement 4.4): depth, failure rate, failed jobs, retry and discard. */
	readonly queues: Route;
	/** The public status page's incidents (enhancement 4.5): the list, one incident, and opening one. */
	readonly statusIncidents: Route;
	readonly statusIncident: RouteBuilder;
	readonly newStatusIncident: Route;
	readonly loadTests: Route;
	/** One load test: its timeline, steps and the servers' load. */
	readonly loadTest: RouteBuilder;
	/** Two load tests side by side (`?a=&b=`). */
	readonly compare: (left: string, right: string) => Route;
}

export interface AccountRoutes {
	/** Section prefix — where restricted sessions land; redirects to `security`. */
	readonly index: Route;
	/** The signed-in admin's own profile (`GET`/`PATCH /auth/profile`). */
	readonly profile: Route;
	readonly security: Route;
	/** The signed-in admin's own GitHub token (`GET`/`PUT`/`DELETE /github/account`). */
	readonly github: Route;
}

export interface AdminRoutes {
	readonly home: Route;
	readonly auth: AuthRoutes;
	readonly analytics: AnalyticsRoutes;
	readonly users: UsersRoutes;
	readonly merchants: MerchantsRoutes;
	readonly rewards: RewardsRoutes;
	readonly emails: EmailsRoutes;
	readonly geography: GeographyRoutes;
	readonly auditLogs: AuditLogsRoutes;
	readonly webhooks: WebhooksRoutes;
	readonly catalog: CatalogRoutes;
	readonly settings: SettingsRoutes;
	readonly components: ComponentsRoutes;
	readonly kanban: KanbanRoutes;
	readonly operations: OperationsRoutes;
	readonly account: AccountRoutes;
	/** The staff member's own inbox (ADR 070) — personal, so any admin may open it. */
	readonly notifications: Route;
}

/** Appends one encoded path segment to `base`. */
function childPath(base: string, segment: string): Route {
	return appRoute(`${base}/${encodeURIComponent(segment)}`);
}

/** `base?name=value`, with the value encoded. */
function withQuery(base: string, name: string, value: string): Route {
	return appRoute(`${base}?${new URLSearchParams({ [name]: value }).toString()}`);
}

/** Trailing segment of every edit page (`/x/[id]/edit`). */
const EDIT_SEGMENT = "edit";

function crudRoutes(list: string): CrudRoutes {
	return {
		list: appRoute(list),
		create: appRoute(`${list}/new`),
		detail: (id: string): Route => childPath(list, id),
		edit: (id: string): Route => appRoute(`${childPath(list, id)}/${EDIT_SEGMENT}`),
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
const EMAIL_BROADCASTS = `${EMAILS}/broadcasts`;
const AUDIT_LOGS = "/audit-logs";
/** Row changes live under the audit log (`/audit-logs/changes/[id]`). */
const AUDIT_LOG_CHANGES = `${AUDIT_LOGS}/changes`;
/** Received webhooks sit under `/webhooks` (`/webhooks/received/[id]`). */
const WEBHOOKS_RECEIVED = "/webhooks/received";
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
const OPERATIONS_STATUS = `${OPERATIONS}/status`;
/** The two runs a comparison shows (`/operations/load-tests/compare?a=&b=`). */
export const LOAD_TEST_COMPARE_PARAMS = { left: "a", right: "b" } satisfies Record<string, string>;

export const ROUTES: AdminRoutes = {
	home: appRoute(APP_LINKS.admin.home),
	auth: {
		login: appRoute(APP_LINKS.auth.login),
		forgotPassword: appRoute(APP_LINKS.auth.forgotPassword),
		resetPassword: appRoute(APP_LINKS.auth.resetPassword),
		verifyEmail: appRoute(APP_LINKS.auth.verifyEmail),
	},
	analytics: {
		index: ANALYTICS,
	},
	users: {
		list: USERS,
		detail: (id: string): Route => childPath(USERS, id),
		mfaRecovery: appRoute(APP_LINKS.admin.mfaRecoveryQueue),
		supportAccess: `${USERS}/support-access`,
	},
	merchants: {
		list: MERCHANTS,
		detail: (id: string): Route => childPath(MERCHANTS, id),
		invites: `${MERCHANTS}/invites`,
		verification: MERCHANT_VERIFICATION,
		verificationFor: (tenantId: string): Route => withQuery(MERCHANT_VERIFICATION, MERCHANT_VERIFICATION_TENANT_PARAM, tenantId),
		storeRequests: `${MERCHANTS}/store-requests`,
	},
	rewards: {
		index: REWARDS,
		review: REWARDS_REVIEW,
		reviewDetail: (id: string): Route => childPath(REWARDS_REVIEW, id),
	},
	emails: {
		index: EMAILS,
		templates: EMAIL_TEMPLATES,
		template: (key: string): Route => withQuery(EMAIL_TEMPLATES, EMAIL_TEMPLATE_KEY_PARAM, key),
		log: `${EMAILS}/log`,
		broadcasts: EMAIL_BROADCASTS,
		broadcastNew: `${EMAIL_BROADCASTS}/new`,
		broadcast: (id: string): Route => childPath(EMAIL_BROADCASTS, id),
		broadcastEdit: (id: string): Route => appRoute(`${childPath(EMAIL_BROADCASTS, id)}/${EDIT_SEGMENT}`),
	},
	geography: {
		index: "/geography",
	},
	auditLogs: {
		list: AUDIT_LOGS,
		detail: (id: string): Route => childPath(AUDIT_LOGS, id),
		change: (id: string): Route => childPath(AUDIT_LOG_CHANGES, id),
	},
	webhooks: {
		received: WEBHOOKS_RECEIVED,
		receivedDetail: (id: string): Route => childPath(WEBHOOKS_RECEIVED, id),
	},
	catalog: {
		index: CATALOG,
		products: crudRoutes(`${CATALOG}/products`),
		categories: crudRoutes(`${CATALOG}/categories`),
	},
	settings: {
		index: SETTINGS,
		access: `${SETTINGS}/access`,
		featureFlags: `${SETTINGS}/feature-flags`,
	},
	components: {
		index: COMPONENTS,
		component: (slug: string): Route => childPath(COMPONENTS, slug),
	},
	kanban: {
		board: KANBAN,
		task: (id: string): Route => childPath(KANBAN_TASKS, id),
		editTask: (id: string): Route => appRoute(`${childPath(KANBAN_TASKS, id)}/${EDIT_SEGMENT}`),
	},
	operations: {
		index: OPERATIONS,
		servers: OPERATIONS_SERVERS,
		server: (id: string): Route => childPath(OPERATIONS_SERVERS, id),
		alerts: `${OPERATIONS}/alerts`,
		backups: `${OPERATIONS}/backups`,
		rateLimits: `${OPERATIONS}/rate-limits`,
		cache: `${OPERATIONS}/cache`,
		queues: `${OPERATIONS}/queues`,
		statusIncidents: OPERATIONS_STATUS,
		statusIncident: (id: string): Route => childPath(OPERATIONS_STATUS, id),
		newStatusIncident: `${OPERATIONS_STATUS}/new`,
		loadTests: OPERATIONS_LOAD_TESTS,
		loadTest: (id: string): Route => childPath(OPERATIONS_LOAD_TESTS, id),
		compare: (left: string, right: string): Route =>
			`${OPERATIONS_LOAD_TESTS}/compare?${new URLSearchParams({ [LOAD_TEST_COMPARE_PARAMS.left]: left, [LOAD_TEST_COMPARE_PARAMS.right]: right }).toString()}`,
	},
	account: {
		index: ACCOUNT,
		profile: `${ACCOUNT}/profile`,
		security: `${ACCOUNT}/security`,
		github: `${ACCOUNT}/github`,
	},
	notifications: appRoute(APP_LINKS.admin.notifications),
};

/** Detail / edit page patterns of one CRUD resource (App Router notation). */
export interface CrudRoutePatterns {
	readonly detail: Route;
	readonly edit: Route;
}

export interface AdminRoutePatterns {
	readonly users: { readonly detail: string };
	readonly merchants: { readonly detail: string };
	readonly auditLogs: { readonly detail: string; readonly change: string };
	readonly webhooks: { readonly receivedDetail: string };
	readonly rewards: { readonly reviewDetail: string };
	readonly catalog: {
		readonly products: CrudRoutePatterns;
		readonly categories: CrudRoutePatterns;
	};
	readonly kanban: { readonly task: string; readonly editTask: string };
	readonly operations: { readonly server: string; readonly loadTest: string; readonly compare: string };
	readonly emails: { readonly broadcast: string; readonly broadcastEdit: string };
}

/** Name of the dynamic segment in every admin detail page (`app/(panel)/x/[id]`). */
const ID_PARAM = "id";

function crudRoutePatterns(list: string): CrudRoutePatterns {
	const detail = `${list}/${routeParam(ID_PARAM)}`;
	return { detail: appRoute(detail), edit: appRoute(`${detail}/${EDIT_SEGMENT}`) };
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
	webhooks: { receivedDetail: `${WEBHOOKS_RECEIVED}/${routeParam(ID_PARAM)}` },
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
	emails: { broadcast: `${EMAIL_BROADCASTS}/${routeParam(ID_PARAM)}`, broadcastEdit: `${EMAIL_BROADCASTS}/${routeParam(ID_PARAM)}/${EDIT_SEGMENT}` },
};

/**
 * The `/auth` section prefix. Not a page itself (so it is not in `ROUTES`);
 * used to keep post-login redirects out of the auth pages.
 */
export const AUTH_SECTION_PREFIX = "/auth";

/** Segment-aware prefix test, shared by every app (`isPathWithin(pathname, prefix)` — pathname FIRST). */
export { isPathWithin } from "@workspace/ui/lib/core/path-match";
