import type { MembershipRole, PermissionAction, PermissionResource, PermissionScope } from "@prisma/client";
import { MembershipRoleSchema, TENANT_ROLE_TEMPLATE_NAMES, TENANT_ROLE_TEMPLATES } from "@workspace/shared";

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
	/** Set on a tenant-role TEMPLATE (ADR 067): the template every tenant copies its role of that kind from. */
	readonly template?: MembershipRole;
}

/**
 * The platform roles the code depends on by name. Created `isSystem` (API callers can never change them)
 * and flat: no role inherits another's permissions (ADR 067).
 *
 * - SuperAdmin: the full matrix (the `isSuperAdmin` flag on the user row still bypasses checks; the role is for assigned operators).
 * - Admin: the admin panel except DELETE:USER and banning merchants (SuperAdmin only), plus
 *   GitHub pull requests with their own linked token (ADR 052 — no other role gets them), plus the whole kanban board.
 * - User: customer app only, every grant OWN-scoped except READ:GITHUB (the configured repositories are shared,
 *   not owned — every signed-in person sees the same contributions), no ADMIN_DASHBOARD.
 * - Location Manager / Location Staff: per-store roles, no longer read by access decisions (ADR 067 — one role per
 *   member plus store-limited grants); removed in its Phase 4.
 * - Owner / Manager / Cashier: the tenant-role TEMPLATES (ADR 067), from `TENANT_ROLE_TEMPLATES`. Every tenant
 *   copies them when it is created; their permissions are the GLOBAL catalogue rows of each `noun.verb`.
 */
export const SYSTEM_ROLE_CATALOG: readonly SystemRoleDefinition[] = [
	{ name: "SuperAdmin", description: "Full system access (platform operator)", grants: (): boolean => true },
	{
		name: "Admin",
		description: "Admin panel — manage users, settings, and platform data",
		grants: (p: PermissionKey): boolean =>
			matches(p, "READ", "ADMIN_DASHBOARD") ||
			matchesAny(p, "USER", ["CREATE", "READ", "UPDATE", "LIST"]) ||
			matchesAny(p, "PROFILE", ["READ", "LIST"]) ||
			matchesAny(p, "ROLE", ["READ", "LIST"]) ||
			matchesAny(p, "PERMISSION", ["READ", "LIST"]) ||
			matchesAny(p, "SYSTEM_SETTINGS", ["READ", "UPDATE"]) ||
			matchesAny(p, "AUDIT_LOG", ["READ", "LIST"]) ||
			matchesAny(p, "REPORT", ["READ", "LIST"]) ||
			matchesAny(p, "ANALYTICS", ["READ", "LIST"]) ||
			matchesAny(p, "EMAIL", ["READ", "LIST", "CREATE"]) ||
			matchesAny(p, "GEO", ["READ", "LIST", "CREATE", "UPDATE", "DELETE"]) ||
			matchesAny(p, "REWARD", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "APPROVE", "REJECT"]) ||
			matchesAny(p, "MERCHANT_ORG", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "APPROVE", "REJECT", "SUSPEND", "REACTIVATE"]) ||
			matchesAny(p, "LOCATION", ["CREATE", "READ", "UPDATE", "LIST"]) ||
			matches(p, "READ", "GITHUB") ||
			matchesAny(p, "GITHUB_PULL_REQUEST", ["READ", "UPDATE"]) ||
			matchesAny(p, "KANBAN_TASK", ["CREATE", "READ", "UPDATE", "DELETE", "LIST"]) ||
			matches(p, "UPDATE", "KANBAN_BOARD"),
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
	...MembershipRoleSchema.options.map((template): SystemRoleDefinition => ({
		name: TENANT_ROLE_TEMPLATE_NAMES[template],
		description: `Tenant role template — every tenant's ${TENANT_ROLE_TEMPLATE_NAMES[template]} starts as a copy of this`,
		template,
		grants: (p: PermissionKey): boolean => p.scope === "GLOBAL" && TENANT_ROLE_TEMPLATES[template].some((held) => held.action === p.action && held.resource === p.resource),
	})),
];
