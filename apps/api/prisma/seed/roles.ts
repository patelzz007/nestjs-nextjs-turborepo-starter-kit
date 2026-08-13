import type { Permission, Role } from "@prisma/client";

import { prisma } from "./client";

export async function createRoles(): Promise<Role[]> {
	const data = [
		{ name: "SuperAdmin", description: "Full system access", isActive: true },
		{ name: "Admin", description: "Administrative access", isActive: true },
		{ name: "Manager", description: "Management level access", isActive: true },
		{ name: "User", description: "Basic user access", isActive: true },
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

export async function assignRoleHierarchy(roles: Role[]): Promise<void> {
	// Hierarchy: SuperAdmin ← Admin ← Manager ← User
	// Each role inherits permissions from its parent (the role above it)
	const roleByName = new Map(roles.map((r) => [r.name, r]));

	const hierarchy = [
		{ child: "Admin", parent: "SuperAdmin" },
		{ child: "Manager", parent: "Admin" },
		{ child: "User", parent: "Manager" },
	];

	for (const { child, parent } of hierarchy) {
		const childRole = roleByName.get(child);
		const parentRole = roleByName.get(parent);
		if (childRole && parentRole) {
			await prisma.role.update({
				where: { id: childRole.id },
				data: { parentId: parentRole.id },
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Role -> Permission assignments
// ---------------------------------------------------------------------------

export async function assignPermissionsToRoles(roles: Role[], permissions: Permission[]): Promise<void> {
	const adminRole = roles.find((r) => r.name === "Admin")!;
	const managerRole = roles.find((r) => r.name === "Manager")!;
	const userRole = roles.find((r) => r.name === "User")!;

	const adminPerms = permissions.filter(
		(p) =>
			(p.resource === "USER" && p.action !== "DELETE") ||
			p.resource === "PROFILE" ||
			(p.resource === "ROLE" && p.action === "READ") ||
			p.resource === "PERMISSION" ||
			p.resource === "ADMIN_DASHBOARD" ||
			p.resource === "URL" ||
			p.resource === "API_KEY" ||
			(p.resource === "AUDIT_LOG" && (p.action === "READ" || p.action === "LIST")) ||
			(p.resource === "REPORT" && (p.action === "READ" || p.action === "LIST")) ||
			p.resource === "TAG" ||
			p.resource === "ANALYTICS",
	);

	const managerPerms = permissions.filter(
		(p) => (p.resource === "USER" && (p.action === "READ" || p.action === "LIST")) || p.resource === "PROFILE" || (p.resource === "ADMIN_DASHBOARD" && p.action === "READ"),
	);

	const userPerms = permissions.filter(
		(p) =>
			(p.resource === "PROFILE" && (p.action === "READ" || p.action === "UPDATE")) ||
			(p.resource === "URL" && (p.action === "CREATE" || p.action === "READ" || p.action === "UPDATE" || p.action === "DELETE" || p.action === "LIST")) ||
			(p.resource === "TAG" && (p.action === "CREATE" || p.action === "READ" || p.action === "UPDATE" || p.action === "DELETE" || p.action === "LIST")) ||
			(p.resource === "API_KEY" && (p.action === "CREATE" || p.action === "READ" || p.action === "UPDATE" || p.action === "DELETE" || p.action === "LIST")) ||
			(p.resource === "ANALYTICS" && p.action === "READ"),
	);

	const rows = [
		...adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
		...managerPerms.map((p) => ({
			roleId: managerRole.id,
			permissionId: p.id,
		})),
		...userPerms.map((p) => ({ roleId: userRole.id, permissionId: p.id })),
	];

	for (const row of rows) {
		await prisma.rolePermission.upsert({
			where: { roleId_permissionId: row },
			update: {},
			create: {
				role: { connect: { id: row.roleId } },
				permission: { connect: { id: row.permissionId } },
			},
		});
	}
}
