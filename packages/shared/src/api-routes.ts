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

// ── Route definition types (Zod-validated) ─────────────────────────────────

import { z } from "zod";

/** A parameterized route: has a `path` with `:param` placeholders and a `params` tuple. */
export const ParamRouteSchema = z
	.object({
		path: z.string(),
		params: z.array(z.string()).min(1),
	})
	.strict();
export type ParamRoute = z.infer<typeof ParamRouteSchema>;

/** A static route is just a plain string (no params). Empty paths are not valid routes. */
export const StaticRouteSchema = z.string().min(1);
export type StaticRoute = z.infer<typeof StaticRouteSchema>;

/** A route is either a static string or a parameterized route object. */
export const RouteDefSchema = z.union([StaticRouteSchema, ParamRouteSchema]);
export type RouteDef = z.infer<typeof RouteDefSchema>;

/** True when `route` is a parameterized route (has `.params`). */
export function isParamRoute(route: RouteDef): route is ParamRoute {
	return ParamRouteSchema.safeParse(route).success;
}

/** Extract the `path` string from any `RouteDef`. */
export type RoutePath<T extends RouteDef> = T extends ParamRoute ? T["path"] : T;

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
} satisfies Record<string, Record<string, RouteDef>>;

/** The full route tree — exported for type-level access. */
export type ApiRoutes = typeof apiRoutes;

// ── Runtime validation (runs once at module load) ──────────────────────────
// Walks every leaf in the route tree and validates it against RouteDefSchema.
// For parameterized routes, also checks that :param placeholders match params[].
// If any route is malformed, the module fails to import.

const PLACEHOLDER_RE = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;

/** Collect all unique param names from a path string. */
function extractPlaceholders(path: string): string[] {
	return [...new Set([...path.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];
}

/** Validate a single route leaf against the Zod schema + placeholder consistency. */
function validateLeaf(routeName: string, value: unknown): void {
	const result = RouteDefSchema.safeParse(value);
	if (!result.success) {
		throw new Error(`apiRoutes: invalid route "${routeName}" — ${result.error.message}`);
	}
	// Re-parse through ParamRouteSchema — safeParse returns narrowed ParamRoute on success.
	const paramResult = ParamRouteSchema.safeParse(result.data);
	if (paramResult.success) {
		const paramRoute: ParamRoute = paramResult.data;
		const placeholders: string[] = extractPlaceholders(paramRoute.path);
		const paramSet: Set<string> = new Set<string>(paramRoute.params);
		if (placeholders.length !== paramSet.size || !placeholders.every((p) => paramSet.has(p))) {
			throw new Error(`apiRoutes: param mismatch in "${routeName}" — path placeholders [${placeholders.join(", ")}] do not match params [${paramRoute.params.join(", ")}]`);
		}
	}
}

/** Walk the route tree and validate every leaf. */
function validateRoutes(): void {
	const tree = apiRoutes satisfies Record<string, Record<string, RouteDef>>;
	for (const [group, routes] of Object.entries(tree)) {
		for (const [name, route] of Object.entries(routes)) {
			validateLeaf(`${group}.${name}`, route);
		}
	}
}

validateRoutes();

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
export function buildRoute<T extends RouteDef>(route: T, ...args: T extends ParamRoute ? [params: Record<T["params"][number], string | number>] : []): string {
	// Static route — return as-is.
	if (!isParamRoute(route)) {
		return route;
	}

	// Parameterized route — substitute each :param placeholder.
	const params: Record<string, string | number> | undefined = args[0];
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
export function buildQuery(base: string, params: Record<string, QueryValue | null | undefined>): string {
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
