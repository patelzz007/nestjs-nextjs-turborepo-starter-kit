import type { PermissionAction, PermissionResource } from "./enums";

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
}

/** Stable dot-notation id for a permission row (`user.read` → READ:USER). */
export function toPermissionRegistryName(action: PermissionAction, resource: PermissionResource): string {
	return `${resource.toLowerCase()}.${action.toLowerCase()}`;
}

/**
 * Every permission seeded and synced to the database.
 * Keep this list aligned with route `@RequirePermission` usage.
 */
export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
	// User Management
	{ action: "CREATE", resource: "USER", description: "Create new users", group: "User Management" },
	{ action: "READ", resource: "USER", description: "View user details", group: "User Management" },
	{ action: "UPDATE", resource: "USER", description: "Update user information", group: "User Management" },
	{ action: "DELETE", resource: "USER", description: "Delete users", group: "User Management" },
	{ action: "LIST", resource: "USER", description: "List all users", group: "User Management" },
	{ action: "MANAGE", resource: "USER", description: "Full user management", group: "User Management" },

	// Profile Management
	{ action: "CREATE", resource: "PROFILE", description: "Create user profiles", group: "Profile Management" },
	{ action: "READ", resource: "PROFILE", description: "View user profiles", group: "Profile Management" },
	{ action: "UPDATE", resource: "PROFILE", description: "Update user profiles", group: "Profile Management" },
	{ action: "DELETE", resource: "PROFILE", description: "Delete user profiles", group: "Profile Management" },
	{ action: "LIST", resource: "PROFILE", description: "List user profiles", group: "Profile Management" },
	{ action: "MANAGE", resource: "PROFILE", description: "Full profile management", group: "Profile Management" },

	// Role Management
	{ action: "CREATE", resource: "ROLE", description: "Create new roles", group: "Role Management", isSystem: true },
	{ action: "READ", resource: "ROLE", description: "View role details", group: "Role Management" },
	{ action: "UPDATE", resource: "ROLE", description: "Update role information", group: "Role Management", isSystem: true },
	{ action: "DELETE", resource: "ROLE", description: "Delete roles", group: "Role Management", isSystem: true },
	{ action: "LIST", resource: "ROLE", description: "List all roles", group: "Role Management" },
	{ action: "MANAGE", resource: "ROLE", description: "Full role management", group: "Role Management", isSystem: true },

	// Permission Management
	{ action: "CREATE", resource: "PERMISSION", description: "Create new permissions", group: "Permission Management", isSystem: true },
	{ action: "READ", resource: "PERMISSION", description: "View permission details", group: "Permission Management" },
	{ action: "UPDATE", resource: "PERMISSION", description: "Update permission information", group: "Permission Management", isSystem: true },
	{ action: "DELETE", resource: "PERMISSION", description: "Delete permissions", group: "Permission Management", isSystem: true },
	{ action: "LIST", resource: "PERMISSION", description: "List all permissions", group: "Permission Management" },
	{ action: "MANAGE", resource: "PERMISSION", description: "Full permission management", group: "Permission Management", isSystem: true },

	// Admin Dashboard
	{ action: "READ", resource: "ADMIN_DASHBOARD", description: "Access admin dashboard", group: "Admin Dashboard" },
	{ action: "MANAGE", resource: "ADMIN_DASHBOARD", description: "Full admin dashboard access", group: "Admin Dashboard" },

	// System Settings
	{ action: "READ", resource: "SYSTEM_SETTINGS", description: "View system settings", group: "System Settings" },
	{ action: "UPDATE", resource: "SYSTEM_SETTINGS", description: "Update system settings", group: "System Settings" },
	{ action: "MANAGE", resource: "SYSTEM_SETTINGS", description: "Full system management", group: "System Settings", isSystem: true },

	// URL Management
	{ action: "CREATE", resource: "URL", description: "Create short links", group: "URL Management" },
	{ action: "LIST", resource: "URL", description: "List all URLs", group: "URL Management" },
	{ action: "READ", resource: "URL", description: "View any URL details", group: "URL Management" },
	{ action: "UPDATE", resource: "URL", description: "Update any URL", group: "URL Management" },
	{ action: "DELETE", resource: "URL", description: "Delete any URL", group: "URL Management" },
	{ action: "MANAGE", resource: "URL", description: "Full URL management", group: "URL Management" },

	// API Key Management
	{ action: "LIST", resource: "API_KEY", description: "List all API keys", group: "API Key Management" },
	{ action: "READ", resource: "API_KEY", description: "View any API key details", group: "API Key Management" },
	{ action: "CREATE", resource: "API_KEY", description: "Create API keys", group: "API Key Management" },
	{ action: "UPDATE", resource: "API_KEY", description: "Update API keys", group: "API Key Management" },
	{ action: "DELETE", resource: "API_KEY", description: "Delete API keys", group: "API Key Management" },
	{ action: "MANAGE", resource: "API_KEY", description: "Full API key management", group: "API Key Management" },

	// Audit
	{ action: "READ", resource: "AUDIT_LOG", description: "View audit logs", group: "Audit" },
	{ action: "LIST", resource: "AUDIT_LOG", description: "List audit logs", group: "Audit" },
	{ action: "MANAGE", resource: "AUDIT_LOG", description: "Full audit log management", group: "Audit", isSystem: true },

	// Tag Management
	{ action: "CREATE", resource: "TAG", description: "Create tags", group: "Tag Management" },
	{ action: "READ", resource: "TAG", description: "View tag details", group: "Tag Management" },
	{ action: "UPDATE", resource: "TAG", description: "Update tags", group: "Tag Management" },
	{ action: "DELETE", resource: "TAG", description: "Delete tags", group: "Tag Management" },
	{ action: "LIST", resource: "TAG", description: "List all tags", group: "Tag Management" },
	{ action: "MANAGE", resource: "TAG", description: "Full tag management", group: "Tag Management" },

	// Analytics
	{ action: "READ", resource: "ANALYTICS", description: "View analytics data", group: "Analytics" },
	{ action: "LIST", resource: "ANALYTICS", description: "List analytics records", group: "Analytics" },
	{ action: "MANAGE", resource: "ANALYTICS", description: "Full analytics management", group: "Analytics" },

	// Reports
	{ action: "READ", resource: "REPORT", description: "View reports", group: "Reports" },
	{ action: "LIST", resource: "REPORT", description: "List reports", group: "Reports" },
	{ action: "MANAGE", resource: "REPORT", description: "Full report management", group: "Reports" },

	// Email
	{ action: "READ", resource: "EMAIL", description: "View email logs and template previews", group: "Email" },
	{ action: "LIST", resource: "EMAIL", description: "List email logs", group: "Email" },
	{ action: "CREATE", resource: "EMAIL", description: "Send test emails via template preview", group: "Email" },
	{ action: "MANAGE", resource: "EMAIL", description: "Full email management", group: "Email" },

	// Geo
	{ action: "READ", resource: "GEO", description: "View geographic data (regions, countries, states, cities)", group: "Geo" },
	{ action: "LIST", resource: "GEO", description: "List geographic data", group: "Geo" },
	{ action: "CREATE", resource: "GEO", description: "Create geographic entries", group: "Geo" },
	{ action: "UPDATE", resource: "GEO", description: "Update geographic entries", group: "Geo" },
	{ action: "DELETE", resource: "GEO", description: "Delete geographic entries", group: "Geo" },
	{ action: "MANAGE", resource: "GEO", description: "Full geographic data management", group: "Geo" },

	// Rewards
	{ action: "CREATE", resource: "REWARD", description: "Create rewards", group: "Rewards" },
	{ action: "READ", resource: "REWARD", description: "View reward details", group: "Rewards" },
	{ action: "UPDATE", resource: "REWARD", description: "Update rewards", group: "Rewards" },
	{ action: "DELETE", resource: "REWARD", description: "Delete rewards", group: "Rewards" },
	{ action: "LIST", resource: "REWARD", description: "List rewards", group: "Rewards" },
	{ action: "MANAGE", resource: "REWARD", description: "Full reward management", group: "Rewards" },

	// Merchant orgs
	{ action: "CREATE", resource: "MERCHANT_ORG", description: "Create merchant organizations", group: "Merchant" },
	{ action: "READ", resource: "MERCHANT_ORG", description: "View merchant organization details", group: "Merchant" },
	{ action: "UPDATE", resource: "MERCHANT_ORG", description: "Update merchant organizations", group: "Merchant" },
	{ action: "DELETE", resource: "MERCHANT_ORG", description: "Delete merchant organizations", group: "Merchant" },
	{ action: "LIST", resource: "MERCHANT_ORG", description: "List merchant organizations", group: "Merchant" },
	{ action: "MANAGE", resource: "MERCHANT_ORG", description: "Full merchant organization management", group: "Merchant" },

	// Redemptions
	{ action: "CREATE", resource: "REDEMPTION", description: "Confirm redemptions at POS", group: "Redemptions" },
	{ action: "READ", resource: "REDEMPTION", description: "View redemption details", group: "Redemptions" },
	{ action: "LIST", resource: "REDEMPTION", description: "List redemptions", group: "Redemptions" },
	{ action: "MANAGE", resource: "REDEMPTION", description: "Full redemption management", group: "Redemptions" },
];

type PermissionActionMap = Partial<Record<PermissionAction, string>>;

/** Nested registry for documentation and stable string constants. */
export const PERMISSIONS: Partial<Record<PermissionResource, PermissionActionMap>> = buildPermissionTree(PERMISSION_DEFINITIONS);

function buildPermissionTree(definitions: readonly PermissionDefinition[]): Partial<Record<PermissionResource, PermissionActionMap>> {
	const tree: Partial<Record<PermissionResource, PermissionActionMap>> = {};
	for (const definition of definitions) {
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
	return PERMISSION_DEFINITIONS.map((definition) => toPermissionRegistryName(definition.action, definition.resource));
}

/** Every dot-notation permission id in the registry. */
export type PermissionName = ReturnType<typeof getAllPermissionNames>[number];
