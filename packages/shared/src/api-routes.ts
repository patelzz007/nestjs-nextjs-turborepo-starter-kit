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
//   apiRoutes.geo.countries  // "/geo/countries"
//
//   // Parameterized route — buildRoute enforces required params at compile time:
//   buildRoute(apiRoutes.geo.countryDetail, { id: "42" })
//   // → "/geo/countries/42"

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

/** Nested route tree — leaves are RouteDef, branches are nested groups. */
export type RouteTree = RouteDef | { readonly [key: string]: RouteTree };

function isRouteDef(value: unknown): value is RouteDef {
	return RouteDefSchema.safeParse(value).success;
}

function isRouteTreeNode(value: unknown): value is Record<string, RouteTree> {
	return value !== null && typeof value === "object" && !Array.isArray(value) && !isRouteDef(value);
}

/** True when `route` is a parameterized route (has `.params`). */
export function isParamRoute(route: RouteDef): route is ParamRoute {
	return ParamRouteSchema.safeParse(route).success;
}

/** Extract the `path` string from any `RouteDef`. */
export type RoutePath<T extends RouteDef> = T extends ParamRoute ? T["path"] : T;

// ── The route tree ─────────────────────────────────────────────────────────
// Groups mirror the contract tree (auth / email / geo).
// Static routes are bare strings; parameterized routes are ParamRoute objects.

export const apiRoutes = {
	// ── Auth ────────────────────────────────────────────────────────────
	auth: {
		me: "/auth/me",
		permissions: "/auth/permissions",
		sessionStatus: "/session",
		login: "/auth/login",
		adminLogin: "/auth/login",
		signup: "/auth/signup",
		refresh: "/auth/refresh",
		logout: "/auth/logout",
		forgotPassword: "/auth/forgot-password",
		resetPassword: "/auth/reset-password",
		resendVerification: "/auth/resend-verification",
		verifyEmail: "/auth/verify-email",
		adminUsers: "/auth/admin/users",
		adminUserDetail: { path: "/auth/admin/users/:userId", params: ["userId"] },
		impersonate: { path: "/auth/impersonate/:userId", params: ["userId"] },
		stopImpersonation: "/auth/stop-impersonation",
		changePassword: "/auth/change-password",
		loginTwoFactor: "/auth/login/2fa",
		loginBackupCode: "/auth/login/backup-code",
		verifyLogin: "/auth/verify-login",
		validateResetToken: "/auth/validate-reset-token",
		twoFactorSetup: "/auth/2fa/setup",
		twoFactorEnable: "/auth/2fa/enable",
		twoFactorDisable: "/auth/2fa/disable",
		twoFactorVerifyBackupCode: "/auth/2fa/verify-backup-code",
	},

	// ── Generic capability catalog ──────────────────────────────────────
	capabilities: {
		catalog: "/capabilities/catalog",
	},

	// ── Email ───────────────────────────────────────────────────────────
	email: {
		previewList: "/notifications/email-preview",
		previewDetail: { path: "/notifications/email-preview/:key", params: ["key"] },
		previewSend: { path: "/notifications/email-preview/:key/send", params: ["key"] },
		logList: "/notifications/email-log",
	},

	// ── Admin RBAC ─────────────────────────────────────────────────────
	admin: {
		roles: {
			list: "/admin/roles",
			userAssign: "/admin/roles/user/assign",
			userRemove: "/admin/roles/user/remove",
			userSync: "/admin/roles/user/sync",
		},
		permissions: {
			list: "/admin/permissions",
			check: "/admin/permissions/check",
			userGrant: "/admin/permissions/user/grant",
			userRevoke: "/admin/permissions/user/revoke",
			userSync: "/admin/permissions/user/sync",
		},
	},

	// ── Geo ────────────────────────────────────────────────────────────
	geo: {
		stats: "/geo/stats",
		autocomplete: "/geo/autocomplete",
		import: "/geo/import",
		importValidate: "/geo/import/validate",
		export: "/geo/export",
		cascadePreview: "/geo/cascade-preview",
		regions: "/geo/regions",
		regionDetail: { path: "/geo/regions/:id", params: ["id"] },
		subregions: "/geo/subregions",
		subregionDetail: { path: "/geo/subregions/:id", params: ["id"] },
		countries: "/geo/countries",
		countryDetail: { path: "/geo/countries/:id", params: ["id"] },
		states: "/geo/states",
		stateDetail: { path: "/geo/states/:id", params: ["id"] },
		cities: "/geo/cities",
		cityDetail: { path: "/geo/cities/:id", params: ["id"] },
	},

	// ── Rewards platform (Phase 1) ─────────────────────────────────────
	rewards: {
		list: "/rewards",
		detail: { path: "/rewards/:rewardId", params: ["rewardId"] },
	},
	legal: {
		accept: "/legal/accept",
	},
	claims: {
		otp: "/claims/otp",
		create: "/claims",
		list: "/claims",
		analytics: "/claims/analytics",
		qr: { path: "/claims/:claimId/qr", params: ["claimId"] },
	},
	rewardNotifications: {
		list: "/reward-notifications",
		read: "/reward-notifications/read",
	},
	redemptions: {
		validate: "/redemptions/validate",
		confirm: "/redemptions/confirm",
	},
	merchant: {
		me: "/merchant/me",
		rewards: {
			list: "/merchant/rewards",
			create: "/merchant/rewards",
			update: { path: "/merchant/rewards/:rewardId", params: ["rewardId"] },
			publish: { path: "/merchant/rewards/:rewardId/publish", params: ["rewardId"] },
		},
		apiKeys: {
			list: "/merchant/api-keys",
			create: "/merchant/api-keys",
			revoke: { path: "/merchant/api-keys/:keyId/revoke", params: ["keyId"] },
		},
		redemptions: "/merchant/redemptions",
		analytics: "/merchant/analytics",
		onboarding: {
			validate: "/merchant/onboarding/validate",
			complete: "/merchant/onboarding/complete",
		},
		members: {
			create: "/merchant/members",
		},
	},
	rewardsAdmin: {
		invites: "/admin/invites",
		invitesPreviewEmail: "/admin/invites/preview-email",
		rewardsPending: "/admin/rewards/pending",
		merchants: "/admin/merchants",
		rewardApprove: { path: "/admin/rewards/:rewardId/approve", params: ["rewardId"] },
		rewardReject: { path: "/admin/rewards/:rewardId/reject", params: ["rewardId"] },
		merchantKyb: { path: "/admin/merchants/:merchantOrgId/kyb", params: ["merchantOrgId"] },
		merchantRoleCapabilities: "/admin/merchant-role-capabilities",
		merchantRoleCapabilitiesSync: { path: "/admin/merchant-role-capabilities/:role", params: ["role"] },
		merchantRoleCapabilitiesRestore: { path: "/admin/merchant-role-capabilities/:role/restore-defaults", params: ["role"] },
	},
} satisfies Record<string, RouteTree>;

/** The full route tree — exported for type-level access. */
export type ApiRoutes = typeof apiRoutes;

// ── Runtime validation (runs once at module load) ──────────────────────────
// Walks every leaf in the route tree and validates it against RouteDefSchema.
// For parameterized routes, also checks that :param placeholders match params[].
// If any route is malformed, the module fails to import.

const PLACEHOLDER_RE = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;

/** Collect all unique param names from a path string. */
function extractPlaceholders(path: string): string[] {
	return [...new Set([...path.matchAll(PLACEHOLDER_RE)].map((m) => m[1]).filter((segment): segment is string => segment !== undefined && segment.length > 0))];
}

/** Validate a single route leaf against the Zod schema + placeholder consistency. */
function validateLeaf(routeName: string, value: unknown): void {
	const result = RouteDefSchema.safeParse(value);
	if (!result.success) {
		throw new Error(`apiRoutes: Invalid route "${routeName}" — ${result.error.message}`);
	}
	// Re-parse through ParamRouteSchema — safeParse returns narrowed ParamRoute on success.
	const paramResult = ParamRouteSchema.safeParse(result.data);
	if (paramResult.success) {
		const paramRoute: ParamRoute = paramResult.data;
		const placeholders: string[] = extractPlaceholders(paramRoute.path);
		const paramSet: Set<string> = new Set<string>(paramRoute.params);
		if (placeholders.length !== paramSet.size || !placeholders.every((p) => paramSet.has(p))) {
			throw new Error(`apiRoutes: Param mismatch in "${routeName}" — path placeholders [${placeholders.join(", ")}] do not match params [${paramRoute.params.join(", ")}]`);
		}
	}
}

/** Walk the route tree and validate every leaf (supports nested groups). */
function validateRoutes(): void {
	function walk(node: Record<string, RouteTree>, prefix: string): void {
		for (const [name, value] of Object.entries(node)) {
			const routeName = prefix.length > 0 ? `${prefix}.${name}` : name;
			if (isRouteDef(value)) {
				validateLeaf(routeName, value);
			} else if (isRouteTreeNode(value)) {
				walk(value, routeName);
			} else {
				throw new Error(`apiRoutes: Invalid route node "${routeName}"`);
			}
		}
	}
	walk(apiRoutes, "");
}

// ⚠️ RUNTIME VALIDATION — runs once at module load.
// If you see "apiRoutes: invalid route" in your logs, a route definition in this file is malformed.
// See docs/api-routes.md for the route schema and how to fix it.
validateRoutes();

// ── buildRoute() — compile-time param enforcement ──────────────────────────
// Resolves a route definition to a concrete URL string.
// For static routes: just returns the path.
// For parameterized routes: replaces :param placeholders with provided values.
// Missing required params throw at runtime. Extra params are silently ignored.
// See docs/api-routes.md §3 for the full API reference.

/**
 * Resolve a route definition to a concrete URL string.
 *
 * Static routes (plain strings) are returned as-is:
 *   buildRoute(apiRoutes.geo.countries)  // "/geo/countries"
 *
 * Parameterized routes require all params:
 *   buildRoute(apiRoutes.geo.countryDetail, { id: "42" })
 *   // → "/geo/countries/42"
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
 *   buildQuery("/geo/countries", { search: "united", limit: 10 })
 *   // → "/geo/countries?search=united&limit=10"
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
