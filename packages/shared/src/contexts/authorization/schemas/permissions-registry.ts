import type { PermissionAction, PermissionResource } from "./permission-enums";
import type { PermissionScope } from "../../../authorization/policy-dsl.schema";
import { TENANT_PERMISSIONS } from "../../../authorization/permission";

/**
 * Canonical permission catalog for this application.
 *
 * - **Decorators / guards** use `(PermissionAction, PermissionResource)` pairs:
 *   `@RequirePermission("READ", "USER")`
 * - **Dot-notation names** (`user.read`) are stable registry identifiers for
 *   migration sync, logging, and documentation.
 * - **Database rows** are synced from here via seed + `PermissionMigrationService`
 *   on API startup — not from admin UI creates.
 *
 * Admin panel permission CRUD creates **runtime DB rows only**. Those work for RBAC
 * checks once assigned to roles, but they do not update this file. To protect new
 * routes in code, add the permission here and deploy.
 */
export interface PermissionDefinition {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
	readonly description: string;
	readonly group: string;
	readonly isSystem?: boolean;
	/**
	 * Where the permission applies (default GLOBAL). OWN rows only reach the
	 * subject's own records; LOCATION rows only apply at a location the subject
	 * holds a location role for. The same action × resource may exist once per scope.
	 */
	readonly scope?: PermissionScope;
}

/**
 * Stable dot-notation id for a permission row (`user.read` → READ:USER).
 * Non-global scopes get a suffix (`profile.update.own`, `location.read.location`).
 */
export function toPermissionRegistryName(action: PermissionAction, resource: PermissionResource, scope: PermissionScope = "GLOBAL"): string {
	const base = `${resource.toLowerCase()}.${action.toLowerCase()}`;
	return scope === "GLOBAL" ? base : `${base}.${scope.toLowerCase()}`;
}

/**
 * The platform permissions, written out. Keep this list aligned with route `@RequirePermission` usage.
 */
const PLATFORM_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
	// User Management
	{ action: "CREATE", resource: "USER", description: "Create new users", group: "User Management" },
	{ action: "READ", resource: "USER", description: "View user details", group: "User Management" },
	{ action: "UPDATE", resource: "USER", description: "Update user information", group: "User Management" },
	{ action: "DELETE", resource: "USER", description: "Delete users", group: "User Management" },
	{ action: "LIST", resource: "USER", description: "List all users", group: "User Management" },

	// Profile Management
	{ action: "CREATE", resource: "PROFILE", description: "Create user profiles", group: "Profile Management" },
	{ action: "READ", resource: "PROFILE", description: "View user profiles", group: "Profile Management" },
	{ action: "UPDATE", resource: "PROFILE", description: "Update user profiles", group: "Profile Management" },
	{ action: "DELETE", resource: "PROFILE", description: "Delete user profiles", group: "Profile Management" },
	{ action: "LIST", resource: "PROFILE", description: "List user profiles", group: "Profile Management" },

	// Role Management
	{ action: "CREATE", resource: "ROLE", description: "Create new roles", group: "Role Management", isSystem: true },
	{ action: "READ", resource: "ROLE", description: "View role details", group: "Role Management" },
	{ action: "UPDATE", resource: "ROLE", description: "Update role information", group: "Role Management", isSystem: true },
	{ action: "DELETE", resource: "ROLE", description: "Delete roles", group: "Role Management", isSystem: true },
	{ action: "LIST", resource: "ROLE", description: "List all roles", group: "Role Management" },

	// Permission Management
	{ action: "CREATE", resource: "PERMISSION", description: "Create new permissions", group: "Permission Management", isSystem: true },
	{ action: "READ", resource: "PERMISSION", description: "View permission details", group: "Permission Management" },
	{ action: "UPDATE", resource: "PERMISSION", description: "Update permission information", group: "Permission Management", isSystem: true },
	{ action: "DELETE", resource: "PERMISSION", description: "Delete permissions", group: "Permission Management", isSystem: true },
	{ action: "LIST", resource: "PERMISSION", description: "List all permissions", group: "Permission Management" },

	// Admin Dashboard
	{ action: "READ", resource: "ADMIN_DASHBOARD", description: "Access admin dashboard", group: "Admin Dashboard" },

	// System Settings
	{ action: "READ", resource: "SYSTEM_SETTINGS", description: "View system settings", group: "System Settings" },
	{ action: "UPDATE", resource: "SYSTEM_SETTINGS", description: "Update system settings", group: "System Settings" },

	// Audit
	{ action: "READ", resource: "AUDIT_LOG", description: "View audit logs", group: "Audit" },
	{ action: "LIST", resource: "AUDIT_LOG", description: "List audit logs", group: "Audit" },

	// Analytics
	{ action: "READ", resource: "ANALYTICS", description: "View analytics data", group: "Analytics" },
	{ action: "LIST", resource: "ANALYTICS", description: "List analytics records", group: "Analytics" },

	// Reports
	{ action: "READ", resource: "REPORT", description: "View reports", group: "Reports" },
	{ action: "LIST", resource: "REPORT", description: "List reports", group: "Reports" },

	// Email
	{ action: "READ", resource: "EMAIL", description: "View email logs and template previews", group: "Email" },
	{ action: "LIST", resource: "EMAIL", description: "List email logs", group: "Email" },
	{ action: "CREATE", resource: "EMAIL", description: "Send test emails via template preview", group: "Email" },

	// Geo
	{ action: "READ", resource: "GEO", description: "View geographic data (regions, countries, states, cities)", group: "Geo" },
	{ action: "LIST", resource: "GEO", description: "List geographic data", group: "Geo" },
	{ action: "CREATE", resource: "GEO", description: "Create geographic entries", group: "Geo" },
	{ action: "UPDATE", resource: "GEO", description: "Update geographic entries", group: "Geo" },
	{ action: "DELETE", resource: "GEO", description: "Delete geographic entries", group: "Geo" },

	// Rewards
	{ action: "CREATE", resource: "REWARD", description: "Create rewards", group: "Rewards" },
	{ action: "READ", resource: "REWARD", description: "View reward details", group: "Rewards" },
	{ action: "UPDATE", resource: "REWARD", description: "Update rewards", group: "Rewards" },
	{ action: "DELETE", resource: "REWARD", description: "Delete rewards", group: "Rewards" },
	{ action: "LIST", resource: "REWARD", description: "List rewards", group: "Rewards" },
	{
		action: "APPROVE",
		resource: "REWARD",
		description: "Review merchants' rewards: the pending queue, a reward in full with its original images, and approving it",
		group: "Rewards",
	},
	{ action: "REJECT", resource: "REWARD", description: "Reject a pending reward with a reason the merchant sees", group: "Rewards" },

	// GitHub contributions (read-only views of the server-configured repositories)
	{ action: "READ", resource: "GITHUB", description: "View contributions of the configured GitHub repositories", group: "GitHub" },
	// GitHub pull requests (each admin's own linked token — ADR 052)
	{ action: "READ", resource: "GITHUB_PULL_REQUEST", description: "View GitHub pull requests with your own linked token", group: "GitHub" },
	{
		action: "UPDATE",
		resource: "GITHUB_PULL_REQUEST",
		description: "Link your GitHub token; comment on, review, close and reopen pull requests as yourself",
		group: "GitHub",
	},

	// Merchant tenants
	{ action: "CREATE", resource: "MERCHANT_ORG", description: "Create merchant tenants", group: "Merchant" },
	{ action: "READ", resource: "MERCHANT_ORG", description: "View merchant tenant details", group: "Merchant" },
	{ action: "UPDATE", resource: "MERCHANT_ORG", description: "Update merchant tenants", group: "Merchant" },
	{ action: "DELETE", resource: "MERCHANT_ORG", description: "Delete merchant tenants", group: "Merchant" },
	{ action: "LIST", resource: "MERCHANT_ORG", description: "List merchant tenants", group: "Merchant" },
	{ action: "APPROVE", resource: "MERCHANT_ORG", description: "Decide a merchant's business verification (KYB) and its store requests", group: "Merchant" },
	{ action: "REJECT", resource: "MERCHANT_ORG", description: "Reject a merchant's appeal against its suspension", group: "Merchant" },
	{ action: "SUSPEND", resource: "MERCHANT_ORG", description: "Suspend a merchant", group: "Merchant" },
	{ action: "REACTIVATE", resource: "MERCHANT_ORG", description: "Reinstate a suspended merchant", group: "Merchant" },
	{ action: "BAN", resource: "MERCHANT_ORG", description: "Ban a merchant (SuperAdmin only)", group: "Merchant", isSystem: true },
	{ action: "UNBAN", resource: "MERCHANT_ORG", description: "Lift a merchant's ban (SuperAdmin only)", group: "Merchant", isSystem: true },

	// Redemptions
	{ action: "CREATE", resource: "REDEMPTION", description: "Confirm redemptions at POS", group: "Redemptions" },
	{ action: "READ", resource: "REDEMPTION", description: "View redemption details", group: "Redemptions" },
	{ action: "LIST", resource: "REDEMPTION", description: "List redemptions", group: "Redemptions" },

	// Locations (platform administration — any tenant's locations)
	{ action: "CREATE", resource: "LOCATION", description: "Create locations", group: "Locations" },
	{ action: "READ", resource: "LOCATION", description: "View any location", group: "Locations" },
	{ action: "UPDATE", resource: "LOCATION", description: "Update any location", group: "Locations" },
	{ action: "DELETE", resource: "LOCATION", description: "Delete locations", group: "Locations" },
	{ action: "LIST", resource: "LOCATION", description: "List locations", group: "Locations" },

	// Location-scoped (granted through a location role on a membership's location scope; valid only at that location)
	{ action: "READ", resource: "LOCATION", scope: "LOCATION", description: "View own location", group: "Location Operations" },
	{ action: "UPDATE", resource: "LOCATION", scope: "LOCATION", description: "Update own location details", group: "Location Operations" },
	{ action: "READ", resource: "REWARD", scope: "LOCATION", description: "View rewards at own location", group: "Location Operations" },
	{ action: "LIST", resource: "REWARD", scope: "LOCATION", description: "List rewards at own location", group: "Location Operations" },
	{ action: "CREATE", resource: "REDEMPTION", scope: "LOCATION", description: "Redeem rewards at own location", group: "Location Operations" },
	{ action: "READ", resource: "REDEMPTION", scope: "LOCATION", description: "View redemptions at own location", group: "Location Operations" },
	{ action: "LIST", resource: "REDEMPTION", scope: "LOCATION", description: "List redemptions at own location", group: "Location Operations" },

	// Own records (customer app — only the subject's own rows)
	{ action: "READ", resource: "PROFILE", scope: "OWN", description: "View own profile", group: "Own Records" },
	{ action: "UPDATE", resource: "PROFILE", scope: "OWN", description: "Update own profile", group: "Own Records" },
	{ action: "READ", resource: "ANALYTICS", scope: "OWN", description: "View analytics for own links", group: "Own Records" },
	{ action: "LIST", resource: "ANALYTICS", scope: "OWN", description: "List analytics for own links", group: "Own Records" },

	// Sample resources (SuperAdmin-only; hidden from production navigation)
	{ action: "CREATE", resource: "SAMPLE_CATEGORY", description: "Create sample categories", group: "Platform Samples", isSystem: true },
	{ action: "READ", resource: "SAMPLE_CATEGORY", description: "View sample categories", group: "Platform Samples", isSystem: true },
	{ action: "UPDATE", resource: "SAMPLE_CATEGORY", description: "Update sample categories", group: "Platform Samples", isSystem: true },
	{ action: "DELETE", resource: "SAMPLE_CATEGORY", description: "Delete sample categories", group: "Platform Samples", isSystem: true },
	{ action: "LIST", resource: "SAMPLE_CATEGORY", description: "List sample categories", group: "Platform Samples", isSystem: true },
	{ action: "CREATE", resource: "PRODUCT", description: "Create products", group: "Platform Samples", isSystem: true },
	{ action: "READ", resource: "PRODUCT", description: "View products", group: "Platform Samples", isSystem: true },
	{ action: "UPDATE", resource: "PRODUCT", description: "Update products", group: "Platform Samples", isSystem: true },
	{ action: "DELETE", resource: "PRODUCT", description: "Delete products", group: "Platform Samples", isSystem: true },
	{ action: "LIST", resource: "PRODUCT", description: "List products", group: "Platform Samples", isSystem: true },
	// Kanban board (platform staff: one shared board of task cards)
	{ action: "LIST", resource: "KANBAN_TASK", description: "View the kanban board and task comments", group: "Kanban Board", isSystem: true },
	{ action: "READ", resource: "KANBAN_TASK", description: "View a task and download its attachments", group: "Kanban Board", isSystem: true },
	{ action: "CREATE", resource: "KANBAN_TASK", description: "Create tasks", group: "Kanban Board", isSystem: true },
	{ action: "UPDATE", resource: "KANBAN_TASK", description: "Edit and move tasks, comment on them and attach files", group: "Kanban Board", isSystem: true },
	{ action: "DELETE", resource: "KANBAN_TASK", description: "Delete tasks", group: "Kanban Board", isSystem: true },
	{ action: "UPDATE", resource: "KANBAN_BOARD", description: "Rearrange the board's columns and set their WIP limits", group: "Kanban Board", isSystem: true },
	{ action: "LIST", resource: "SERVER_METRIC", description: "See the servers, instances, dependencies and alerts of the platform", group: "Operations", isSystem: true },
	{ action: "READ", resource: "SERVER_METRIC", description: "Open a server, instance or dependency and its history", group: "Operations", isSystem: true },
	{ action: "LIST", resource: "DATABASE_BACKUP", description: "See the database backups", group: "Operations", isSystem: true },
	{ action: "CREATE", resource: "DATABASE_BACKUP", description: "Back the database up now, and change the backup schedule", group: "Operations", isSystem: true },
	{ action: "READ", resource: "DATABASE_BACKUP", description: "Download a database backup", group: "Operations", isSystem: true },
	{ action: "UPDATE", resource: "DATABASE_BACKUP", description: "Pin or unpin a database backup", group: "Operations", isSystem: true },
	{ action: "DELETE", resource: "DATABASE_BACKUP", description: "Delete a database backup", group: "Operations", isSystem: true },
	{ action: "LIST", resource: "LOAD_TEST", description: "See the load tests and their results", group: "Operations", isSystem: true },
	{ action: "READ", resource: "LOAD_TEST", description: "Open a load test, its live results and comparisons", group: "Operations", isSystem: true },
	{ action: "CREATE", resource: "LOAD_TEST", description: "Start a load test", group: "Operations", isSystem: true },
	{ action: "UPDATE", resource: "LOAD_TEST", description: "Abort a running load test", group: "Operations", isSystem: true },
	{ action: "DELETE", resource: "LOAD_TEST", description: "Purge every row the load tests created", group: "Operations", isSystem: true },
];

/**
 * The tenant permissions (ADR 067) the platform list does not already define, generated from the one
 * `TENANT_PERMISSIONS` list so a tenant permission is declared exactly once.
 */
const TENANT_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = TENANT_PERMISSIONS.filter(
	(permission) =>
		!PLATFORM_PERMISSION_DEFINITIONS.some(
			(defined) => (defined.scope ?? "GLOBAL") === "GLOBAL" && defined.action === permission.action && defined.resource === permission.resource,
		),
).map((permission) => ({
	action: permission.action,
	resource: permission.resource,
	description: `Tenant permission ${toPermissionRegistryName(permission.action, permission.resource)}`,
	group: "Tenant",
}));

/** Every permission seeded and synced to the database: the platform's, then the tenant-only ones. */
export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [...PLATFORM_PERMISSION_DEFINITIONS, ...TENANT_PERMISSION_DEFINITIONS];

type PermissionActionMap = Partial<Record<PermissionAction, string>>;

/** Nested registry for documentation and stable string constants. */
export const PERMISSIONS: Partial<Record<PermissionResource, PermissionActionMap>> = buildPermissionTree(PERMISSION_DEFINITIONS);

function buildPermissionTree(definitions: readonly PermissionDefinition[]): Partial<Record<PermissionResource, PermissionActionMap>> {
	const tree: Partial<Record<PermissionResource, PermissionActionMap>> = {};
	for (const definition of definitions) {
		if ((definition.scope ?? "GLOBAL") !== "GLOBAL") {
			continue;
		}
		let bucket: PermissionActionMap = tree[definition.resource] ?? {};
		bucket = { ...bucket, [definition.action]: toPermissionRegistryName(definition.action, definition.resource) };
		tree[definition.resource] = bucket;
	}
	return tree;
}

/** Full catalog rows for seed + DB migration sync. */
export function getPermissionDefinitions(): readonly PermissionDefinition[] {
	return PERMISSION_DEFINITIONS;
}

/**
 * Flatten the nested registry into a single array of permission name strings.
 * Useful for migration sync and validation.
 */
export function getAllPermissionNames(): readonly string[] {
	return PERMISSION_DEFINITIONS.map((definition) => toPermissionRegistryName(definition.action, definition.resource, definition.scope));
}

/** Every dot-notation permission id in the registry. */
export type PermissionName = ReturnType<typeof getAllPermissionNames>[number];
