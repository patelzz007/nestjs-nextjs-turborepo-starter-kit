// API path templates owned by the `authorization` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

// ── Generic capability catalog ──────────────────────────────────────

/** Path templates composed into `apiRoutes.capabilities`. */
export const capabilitiesRoutes = {
	catalog: "/capabilities/catalog",
} satisfies Record<string, RouteTree>;

// ── Admin RBAC ─────────────────────────────────────────────────────

/** Path templates composed into `apiRoutes.admin`. */
export const adminRbacRoutes = {
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
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.supportAccess`. */
export const supportAccessRoutes = {
	request: "/support-access/request",
	approve: "/support-access/:grantId/approve",
	revoke: "/support-access/:grantId/revoke",
} satisfies Record<string, RouteTree>;
