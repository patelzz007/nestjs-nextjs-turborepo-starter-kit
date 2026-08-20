// ============================================
// api-routes.ts - Single source of truth for all API path templates
// ============================================
// Every API endpoint path lives here. Contracts (`contracts/index.ts`) and
// controllers reference this tree instead of hardcoding path strings.
//
// Usage:
//   import { apiRoutes, buildRoute } from "@workspace/shared/api-routes";
//
//   // Static route — just a string:
//   apiRoutes.telescope.requests  // "/telescope/requests"
//
//   // Parameterized route — buildRoute enforces required params at compile time:
//   buildRoute(apiRoutes.telescope.requestDetail, { id: "abc" })
//   // → "/telescope/requests/abc"

// ── Route definition types ──────────────────────────────────────────────────

/** A route with path parameters (e.g. "/backup/:id"). */
export interface ParamRoute<ParamNames extends string[]> {
	readonly path: string;
	readonly params: ParamNames;
}

/** A static route (no params) or a parametrised route. */
export type RouteDef = string | ParamRoute<string[]>;

/** Extract the `path` string from any `RouteDef`. */
export type RoutePath<T extends RouteDef> = T extends ParamRoute<string[]> ? T["path"] : T;

// ── The route tree ─────────────────────────────────────────────────────────
// Groups mirror the contract tree (auth / email / backup / telescope).
// Static routes are bare strings; parameterized routes are ParamRoute objects.

export const apiRoutes = {
	// ── Auth ────────────────────────────────────────────────────────────
	auth: {
		me: "/auth/me",
		sessionStatus: "/session",
		login: "/auth/login",
		adminLogin: "/auth/login",
		signup: "/auth/signup",
		refresh: "/auth/refresh",
		logout: "/auth/logout",
		forgotPassword: "/auth/forgot-password",
		resetPassword: "/auth/reset-password",
		resendVerification: "/auth/resend-verification",
		verifyEmail: { path: "/auth/verify-email/:token", params: ["token"] },
		adminUsers: "/auth/admin/users",
	},

	// ── Email ───────────────────────────────────────────────────────────
	email: {
		previewList: "/notifications/email-preview",
		previewDetail: { path: "/notifications/email-preview/:key", params: ["key"] },
		previewSend: { path: "/notifications/email-preview/:key/send", params: ["key"] },
		logList: "/notifications/email-log",
	},

	// ── Backup ──────────────────────────────────────────────────────────
	backup: {
		create: "/backup",
		list: "/backup",
		status: { path: "/backup/:id", params: ["id"] },
		download: { path: "/backup/:id/download", params: ["id"] },
		remove: { path: "/backup/:id", params: ["id"] },
		options: "/backup/options",
		verify: { path: "/backup/:id/verify", params: ["id"] },
		restore: { path: "/backup/:id/restore", params: ["id"] },
		cancel: { path: "/backup/:id/cancel", params: ["id"] },
		toggleSchedule: { path: "/backup/schedules/:id/toggle", params: ["id"] },
	},

	// ── Telescope ───────────────────────────────────────────────────────
	telescope: {
		// Queries
		overview: "/telescope/overview",
		requests: "/telescope/requests",
		requestDetail: { path: "/telescope/requests/:id", params: ["id"] },
		requestSql: { path: "/telescope/requests/:id/sql", params: ["id"] },
		compare: "/telescope/compare",
		sql: "/telescope/sql",
		exceptions: "/telescope/exceptions",
		exceptionDetail: { path: "/telescope/exceptions/:id", params: ["id"] },
		mail: "/telescope/mail",
		jobs: "/telescope/jobs",
		jobDetail: { path: "/telescope/jobs/:id", params: ["id"] },
		schedules: "/telescope/schedules",
		leaderboard: "/telescope/leaderboard",
		trends: "/telescope/trends",
		logs: "/telescope/logs",
		alerts: "/telescope/alerts",
		search: "/telescope/search",
		users: "/telescope/users",
		status: "/telescope/status",
		webhookDeliveries: "/telescope/webhook-deliveries",

		// Mutations
		dump: "/telescope/dump",
		setAnnotation: { path: "/telescope/requests/:id/annotation", params: ["id"] },
		replay: { path: "/telescope/replay/:id", params: ["id"] },
		runSchedule: { path: "/telescope/schedules/:name/run", params: ["name"] },
		prune: "/telescope/admin/prune",
		clearAll: "/telescope/admin/clear",
		alertAck: { path: "/telescope/alerts/:id/ack", params: ["id"] },
		alertSnooze: { path: "/telescope/alerts/:id/snooze", params: ["id"] },
		setExceptionStatus: { path: "/telescope/exceptions/:id/status", params: ["id"] },
		retryJob: { path: "/telescope/jobs/:id/retry", params: ["id"] },
	},
} as const satisfies Record<string, Record<string, RouteDef>>;

/** The full route tree — exported for type-level access. */
export type ApiRoutes = typeof apiRoutes;

// ── buildRoute() — compile-time param enforcement ──────────────────────────

/**
 * Resolve a route definition to a concrete URL string.
 *
 * Static routes (plain strings) are returned as-is:
 *   buildRoute(apiRoutes.telescope.requests)  // "/telescope/requests"
 *
 * Parameterized routes require all params:
 *   buildRoute(apiRoutes.telescope.requestDetail, { id: "abc" })
 *   // → "/telescope/requests/abc"
 */
export function buildRoute<T extends RouteDef>(
	route: T,
	...args: T extends ParamRoute<infer P extends string[]>
		? [params: Record<P[number], string | number>]
		: []
): string {
	const params = args[0] as Record<string, string | number> | undefined;

	// Static route — return as-is.
	if (typeof route === "string") {
		return route;
	}

	// Parameterized route — substitute each :param placeholder.
	let resolved: string = route.path;
	for (const paramName of route.params) {
		const value: string | number | undefined = params?.[paramName];
		if (value === undefined) {
			throw new Error(`Missing required parameter: ${paramName}`);
		}
		resolved = resolved.replace(`:${paramName}`, String(value));
	}
	return resolved;
}

// ── Query-string builder ───────────────────────────────────────────────────

/** A value that can appear in a query string (null/undefined = omit). */
export type QueryValue = string | number | boolean;

/**
 * Append query parameters to a base path. Null/undefined values are omitted.
 *
 *   buildQuery("/telescope/requests", { sort: "duration", starred: true })
 *   // → "/telescope/requests?sort=duration&starred=true"
 */
export function buildQuery(
	base: string,
	params: Record<string, QueryValue | null | undefined>,
): string {
	const parts: string[] = [];
	for (const [key, value] of Object.entries(params)) {
		if (value !== null && value !== undefined) {
			parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
		}
	}
	if (parts.length === 0) {
		return base;
	}
	return `${base}?${parts.join("&")}`;
}
