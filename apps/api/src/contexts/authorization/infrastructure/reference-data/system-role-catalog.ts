import type { PermissionAction, PermissionResource, PermissionScope } from "@prisma/client";

import { LOCATION_MANAGER_ROLE_NAME, LOCATION_STAFF_ROLE_NAME } from "../../domain/rbac-catalog";

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
 * and flat (no parent): hierarchy is for extension patterns, never a tenant rank.
 *
 * - SuperAdmin: the full matrix (the `isSuperAdmin` flag on the user row still bypasses checks; the role is for assigned operators).
 * - Admin: the admin panel except DELETE:USER and MANAGE:SYSTEM_SETTINGS (granted directly where needed), plus
 *   GitHub pull requests with their own linked token (ADR 052 — no other role gets them), plus the whole kanban board.
 * - Manager: a limited admin panel (team lead): no RBAC, system settings, geo or email tools; works the kanban board
 *   (create, edit, move, comment, attach) but neither deletes tasks nor rearranges columns.
 * - User: customer app only, every grant OWN-scoped except READ:GITHUB (the configured repositories are shared,
 *   not owned — every signed-in person sees the same contributions), no ADMIN_DASHBOARD.
 * - Location Manager / Location Staff: LOCATION-scoped rows, applied only at the locations a member's location
 *   scope gives them the role for.
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
			matchesAny(p, "AUDIT_LOG", ["READ", "LIST"]) ||
			matchesAny(p, "REPORT", ["READ", "LIST"]) ||
			matchesAny(p, "ANALYTICS", ["READ", "LIST"]) ||
			matchesAny(p, "EMAIL", ["READ", "LIST", "CREATE"]) ||
			matches(p, "MANAGE", "GEO") ||
			matchesAny(p, "GEO", ["READ", "LIST", "CREATE", "UPDATE", "DELETE"]) ||
			matchesAny(p, "REWARD", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"]) ||
			matchesAny(p, "MERCHANT_ORG", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"]) ||
			matchesAny(p, "LOCATION", ["CREATE", "READ", "UPDATE", "LIST"]) ||
			matches(p, "READ", "GITHUB") ||
			matchesAny(p, "GITHUB_PULL_REQUEST", ["READ", "UPDATE"]) ||
			matchesAny(p, "KANBAN_TASK", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"]),
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
			matchesAny(p, "AUDIT_LOG", ["READ", "LIST"]) ||
			matches(p, "READ", "GITHUB") ||
			matchesAny(p, "KANBAN_TASK", ["CREATE", "READ", "UPDATE", "LIST"]),
	},
	{
		name: "User",
		description: "Customer app — own profile and own analytics (no admin panel)",
		grants: (p: PermissionKey): boolean =>
			matchesAny(p, "PROFILE", ["READ", "UPDATE"], "OWN") || matchesAny(p, "ANALYTICS", ["READ", "LIST"], "OWN") || matches(p, "READ", "GITHUB"),
	},
	{
		name: LOCATION_MANAGER_ROLE_NAME,
		description: "Location role — runs a location (details, rewards, redemptions)",
		grants: (p: PermissionKey): boolean =>
			matchesAny(p, "LOCATION", ["READ", "UPDATE"], "LOCATION") ||
			matchesAny(p, "REWARD", ["READ", "LIST"], "LOCATION") ||
			matchesAny(p, "REDEMPTION", ["CREATE", "READ", "LIST"], "LOCATION"),
	},
	{
		name: LOCATION_STAFF_ROLE_NAME,
		description: "Location role — front-of-house redemptions at a location",
		grants: (p: PermissionKey): boolean =>
			matches(p, "READ", "LOCATION", "LOCATION") || matchesAny(p, "REWARD", ["READ", "LIST"], "LOCATION") || matches(p, "CREATE", "REDEMPTION", "LOCATION"),
	},
];
