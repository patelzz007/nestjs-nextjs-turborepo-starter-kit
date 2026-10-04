import type { PermissionAction, PermissionResource, PermissionScope } from "@prisma/client";

/** What identifies one permission in the catalog (`@@unique([action, resource, scope])`). */
export interface PermissionKey {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
	readonly scope: PermissionScope;
}

/** Selects the permissions one role is granted from the full catalog. */
export type PermissionSelector = (permission: PermissionKey) => boolean;

function matches(permission: PermissionKey, action: PermissionAction, resource: PermissionResource, scope: PermissionScope = "GLOBAL"): boolean {
	return permission.action === action && permission.resource === resource && permission.scope === scope;
}

function matchesAny(permission: PermissionKey, resource: PermissionResource, actions: readonly PermissionAction[], scope: PermissionScope = "GLOBAL"): boolean {
	return permission.resource === resource && permission.scope === scope && actions.includes(permission.action);
}

/** The platform role definition. */
export interface SystemRoleDefinition {
	readonly name: string;
	readonly description: string;
	/** Which permissions of the whole catalog the role is granted. */
	readonly grants: PermissionSelector;
}

/**
 * The platform roles the code depends on by name. Created `isSystem` (API callers can never change them)
 * and flat (no parent): hierarchy is for extension patterns, never organisational rank.
 *
 * - SuperAdmin: the full matrix (the `isSuperAdmin` flag on the user row still bypasses checks; the role is for assigned operators).
 * - Admin: the admin panel except DELETE:USER and MANAGE:SYSTEM_SETTINGS (granted directly where needed).
 * - Manager: a limited admin panel (team lead): no RBAC, system settings, geo or email tools.
 * - User: customer app only, every grant OWN-scoped, no ADMIN_DASHBOARD.
 * - Store Manager / Store Staff: STORE-scoped rows, applied only inside the member's store.
 */
export const SYSTEM_ROLE_CATALOG: readonly SystemRoleDefinition[] = [
	{ name: "SuperAdmin", description: "Full system access (platform operator)", grants: (): boolean => true },
	{
		name: "Admin",
		description: "Admin panel — manage users, settings, and platform data",
		grants: (p: PermissionKey): boolean =>
			matchesAny(p, "ADMIN_DASHBOARD", ["READ", "MANAGE"]) ||
			matchesAny(p, "USER", ["CREATE", "READ", "UPDATE", "LIST"]) ||
			matchesAny(p, "PROFILE", ["READ", "LIST"]) ||
			matchesAny(p, "ROLE", ["READ", "LIST"]) ||
			matchesAny(p, "PERMISSION", ["READ", "LIST"]) ||
			matchesAny(p, "SYSTEM_SETTINGS", ["READ", "UPDATE"]) ||
			matchesAny(p, "URL", ["LIST", "READ"]) ||
			matchesAny(p, "API_KEY", ["LIST", "READ"]) ||
			matchesAny(p, "AUDIT_LOG", ["READ", "LIST"]) ||
			matchesAny(p, "REPORT", ["READ", "LIST"]) ||
			matchesAny(p, "TAG", ["LIST", "READ"]) ||
			matchesAny(p, "ANALYTICS", ["READ", "LIST"]) ||
			matchesAny(p, "EMAIL", ["READ", "LIST", "CREATE"]) ||
			matches(p, "MANAGE", "GEO") ||
			matchesAny(p, "GEO", ["READ", "LIST", "CREATE", "UPDATE", "DELETE"]) ||
			matchesAny(p, "REWARD", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"]) ||
			matchesAny(p, "MERCHANT_ORG", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"]) ||
			matchesAny(p, "STORE", ["CREATE", "READ", "UPDATE", "LIST"]),
	},
	{
		name: "Manager",
		description: "Admin panel — read/update users and reports (no RBAC or system settings)",
		grants: (p: PermissionKey): boolean =>
			matches(p, "READ", "ADMIN_DASHBOARD") ||
			matchesAny(p, "USER", ["READ", "LIST", "UPDATE"]) ||
			matchesAny(p, "PROFILE", ["READ", "LIST"]) ||
			matchesAny(p, "REPORT", ["READ", "LIST"]) ||
			matchesAny(p, "ANALYTICS", ["READ", "LIST"]) ||
			matchesAny(p, "AUDIT_LOG", ["READ", "LIST"]),
	},
	{
		name: "User",
		description: "Customer app — own profile, links, tags, and API keys (no admin panel)",
		grants: (p: PermissionKey): boolean =>
			matchesAny(p, "PROFILE", ["READ", "UPDATE"], "OWN") ||
			matchesAny(p, "URL", ["CREATE", "READ", "UPDATE", "DELETE", "LIST"], "OWN") ||
			matchesAny(p, "TAG", ["CREATE", "READ", "UPDATE", "DELETE", "LIST"], "OWN") ||
			matchesAny(p, "API_KEY", ["CREATE", "READ", "UPDATE", "DELETE", "LIST"], "OWN") ||
			matchesAny(p, "ANALYTICS", ["READ", "LIST"], "OWN"),
	},
	{
		name: "Store Manager",
		description: "Store membership role — runs one store (details, rewards, redemptions)",
		grants: (p: PermissionKey): boolean =>
			matchesAny(p, "STORE", ["READ", "UPDATE"], "STORE") ||
			matchesAny(p, "REWARD", ["READ", "LIST"], "STORE") ||
			matchesAny(p, "REDEMPTION", ["CREATE", "READ", "LIST"], "STORE"),
	},
	{
		name: "Store Staff",
		description: "Store membership role — front-of-house redemptions at one store",
		grants: (p: PermissionKey): boolean =>
			matches(p, "READ", "STORE", "STORE") || matchesAny(p, "REWARD", ["READ", "LIST"], "STORE") || matches(p, "CREATE", "REDEMPTION", "STORE"),
	},
];
