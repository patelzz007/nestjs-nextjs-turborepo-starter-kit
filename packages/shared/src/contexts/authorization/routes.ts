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
	/** Platform admins: every grant (newest first). */
	list: "/support-access",
	/** The tenant owner: their tenant's grants, to approve the pending ones. */
	tenantList: "/tenants/:tenantSlug/support-access",
	request: "/support-access/request",
	approve: "/support-access/:grantId/approve",
	revoke: "/support-access/:grantId/revoke",
} satisfies Record<string, RouteTree>;

/**
 * Path templates composed into `apiRoutes.tenantAccess`: a tenant administers its own roles, members'
 * roles, grants and shares (ADR 067).
 */
export const tenantAccessRoutes = {
	roles: "/tenants/:tenantSlug/access/roles",
	role: "/tenants/:tenantSlug/access/roles/:roleId",
	roleHolders: "/tenants/:tenantSlug/access/roles/:roleId/holders",
	roleReassign: "/tenants/:tenantSlug/access/roles/:roleId/reassign",
	roleReset: "/tenants/:tenantSlug/access/roles/:roleId/reset",
	member: "/tenants/:tenantSlug/access/members/:membershipId",
	memberRole: "/tenants/:tenantSlug/access/members/:membershipId/role",
	memberGrants: "/tenants/:tenantSlug/access/members/:membershipId/grants",
	grant: "/tenants/:tenantSlug/access/grants/:grantId",
	shares: "/tenants/:tenantSlug/access/shares",
	share: "/tenants/:tenantSlug/access/shares/:shareId",
} satisfies Record<string, RouteTree>;
