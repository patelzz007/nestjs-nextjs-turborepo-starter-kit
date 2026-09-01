import type { Permission, PermissionAction, PermissionResource, Role } from "@prisma/client";

import { prisma } from "./client";

export async function createRoles(): Promise<Role[]> {
	const data = [
		{ name: "SuperAdmin", description: "Full system access (platform operator)", isActive: true },
		{ name: "Admin", description: "Admin panel — manage users, settings, and platform data", isActive: true },
		{ name: "Manager", description: "Admin panel — read/update users and reports (no RBAC or system settings)", isActive: true },
		{ name: "User", description: "Customer app — own profile, links, tags, and API keys (no admin panel)", isActive: true },
	];

	for (const r of data) {
		await prisma.role.upsert({
			where: { name: r.name },
			update: { description: r.description },
			create: r,
		});
	}

	return prisma.role.findMany();
}

// ---------------------------------------------------------------------------
// Role hierarchy (parent relationships)
// ---------------------------------------------------------------------------

/**
 * Production default: **flat roles** (no `parentId`).
 *
 * Role hierarchy is for extension patterns (e.g. Viewer ← Editor where the child
 * adds capabilities on top of a base role), not organizational rank. Linking
 * User → Manager → Admin → SuperAdmin caused every customer to inherit staff
 * permissions — unsafe for production templates.
 *
 * To add hierarchy later, set `parentId` only when the child truly extends the
 * parent (same trust plane). Never attach the customer `User` role under staff roles.
 */
export async function assignRoleHierarchy(roles: Role[]): Promise<void> {
	for (const role of roles) {
		await prisma.role.update({
			where: { id: role.id },
			data: { parentId: null },
		});
	}
}

// ---------------------------------------------------------------------------
// Role -> Permission assignments
// ---------------------------------------------------------------------------

function filterPermissions(permissions: Permission[], predicate: (permission: Permission) => boolean): Permission[] {
	return permissions.filter(predicate);
}

function hasActionResource(permission: Permission, action: PermissionAction, resource: PermissionResource): boolean {
	return permission.action === action && permission.resource === resource;
}

function hasResourceActions(permission: Permission, resource: PermissionResource, actions: readonly PermissionAction[]): boolean {
	return permission.resource === resource && actions.includes(permission.action);
}

export async function assignPermissionsToRoles(roles: Role[], permissions: Permission[]): Promise<void> {
	const superAdminRole = roles.find((r) => r.name === "SuperAdmin")!;
	const adminRole = roles.find((r) => r.name === "Admin")!;
	const managerRole = roles.find((r) => r.name === "Manager")!;
	const userRole = roles.find((r) => r.name === "User")!;

	// SuperAdmin role: full matrix (@RequirePermission + JWT). `isSuperAdmin` on the
	// user row still bypasses all checks — this role is for assigned operators.
	const superAdminPerms = permissions;

	// Admin: full admin panel except DELETE:USER (demo direct grant on admin@) and
	// MANAGE:SYSTEM_SETTINGS (demo direct grant on frank.miller@).
	const adminPerms = filterPermissions(
		permissions,
		(p) =>
			hasResourceActions(p, "ADMIN_DASHBOARD", ["READ", "MANAGE"]) ||
			hasResourceActions(p, "USER", ["CREATE", "READ", "UPDATE", "LIST"]) ||
			hasResourceActions(p, "PROFILE", ["READ", "LIST"]) ||
			hasResourceActions(p, "ROLE", ["READ", "LIST"]) ||
			hasResourceActions(p, "PERMISSION", ["READ", "LIST"]) ||
			hasResourceActions(p, "SYSTEM_SETTINGS", ["READ", "UPDATE"]) ||
			hasResourceActions(p, "URL", ["LIST", "READ"]) ||
			hasResourceActions(p, "API_KEY", ["LIST", "READ"]) ||
			hasResourceActions(p, "AUDIT_LOG", ["READ", "LIST"]) ||
			hasResourceActions(p, "REPORT", ["READ", "LIST"]) ||
			hasResourceActions(p, "TAG", ["LIST", "READ"]) ||
			hasResourceActions(p, "ANALYTICS", ["READ", "LIST"]) ||
			hasResourceActions(p, "EMAIL", ["READ", "LIST", "CREATE"]) ||
			hasActionResource(p, "MANAGE", "GEO") ||
			hasResourceActions(p, "GEO", ["READ", "LIST", "CREATE", "UPDATE", "DELETE"]) ||
			hasResourceActions(p, "REWARD", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"]) ||
			hasResourceActions(p, "MERCHANT_ORG", ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"]),
	);

	// Manager: limited admin panel (team lead). No RBAC, system settings, geo, or email tools.
	const managerPerms = filterPermissions(
		permissions,
		(p) =>
			hasActionResource(p, "READ", "ADMIN_DASHBOARD") ||
			hasResourceActions(p, "USER", ["READ", "LIST", "UPDATE"]) ||
			hasResourceActions(p, "PROFILE", ["READ", "LIST"]) ||
			hasResourceActions(p, "REPORT", ["READ", "LIST"]) ||
			hasResourceActions(p, "ANALYTICS", ["READ", "LIST"]) ||
			hasResourceActions(p, "AUDIT_LOG", ["READ", "LIST"]),
	);

	// User: customer app only — no ADMIN_DASHBOARD (cannot open admin panel).
	const userPerms = filterPermissions(
		permissions,
		(p) =>
			hasResourceActions(p, "PROFILE", ["READ", "UPDATE"]) ||
			hasResourceActions(p, "URL", ["CREATE", "READ", "UPDATE", "DELETE", "LIST"]) ||
			hasResourceActions(p, "TAG", ["CREATE", "READ", "UPDATE", "DELETE", "LIST"]) ||
			hasResourceActions(p, "API_KEY", ["CREATE", "READ", "UPDATE", "DELETE", "LIST"]) ||
			hasResourceActions(p, "ANALYTICS", ["READ", "LIST"]),
	);

	const rows = [
		...superAdminPerms.map((p) => ({ roleId: superAdminRole.id, permissionId: p.id })),
		...adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
		...managerPerms.map((p) => ({ roleId: managerRole.id, permissionId: p.id })),
		...userPerms.map((p) => ({ roleId: userRole.id, permissionId: p.id })),
	];

	for (const row of rows) {
		await prisma.rolePermission.upsert({
			where: { roleId_permissionId: row },
			update: { isDeleted: false, deletedAt: null },
			create: {
				role: { connect: { id: row.roleId } },
				permission: { connect: { id: row.permissionId } },
			},
		});
	}

	await syncStaleRolePermissions([superAdminRole.id, adminRole.id, managerRole.id, userRole.id], rows);
}

/** Soft-delete role-permission rows removed from the seed matrix so re-seeds converge. */
async function syncStaleRolePermissions(roleIds: readonly string[], desiredRows: readonly { readonly roleId: string; readonly permissionId: string }[]): Promise<void> {
	const desiredKeys = new Set<string>(desiredRows.map((row) => `${row.roleId}:${row.permissionId}`));
	const existing = await prisma.rolePermission.findMany({
		where: { roleId: { in: [...roleIds] }, isDeleted: false },
		select: { roleId: true, permissionId: true },
	});

	const nowMs = Date.now();
	for (const row of existing) {
		const key = `${row.roleId}:${row.permissionId}`;
		if (!desiredKeys.has(key)) {
			await prisma.rolePermission.update({
				where: { roleId_permissionId: { roleId: row.roleId, permissionId: row.permissionId } },
				data: { isDeleted: true, deletedAt: nowMs, updatedAt: nowMs },
			});
		}
	}
}
