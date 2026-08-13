import type { MenuItem, Permission, PermissionAction, PermissionResource, Role } from "@prisma/client";

import { prisma } from "./client";

export async function createMenuItems(permissions: Permission[], roles: Role[]): Promise<void> {
	const perm = (action: PermissionAction, resource: PermissionResource) => permissions.find((p) => p.action === action && p.resource === resource)!;
	const role = (name: string) => roles.find((r) => r.name === name)!;

	// ── 13a. Create menu items ──────────────────────────────────────────

	const menuData: {
		name: string;
		label?: string;
		icon: string;
		path: string | null;
		parentName?: string;
		order: number;
	}[] = [
		// ── Main navigation — visible to all authenticated users ──────────
		{
			name: "Dashboard",
			icon: "LayoutDashboard",
			path: "/dashboard",
			order: 0,
		},
		{ name: "Links", icon: "Link", path: "/urls", order: 1 },
		{ name: "Analytics", icon: "BarChart3", path: "/analytics", order: 2 },
		{ name: "Tags", icon: "Tags", path: "/tags", order: 3 },
		{ name: "API Keys", icon: "Key", path: "/api-keys", order: 4 },
		{ name: "Profile", icon: "User", path: "/profile", order: 5 },

		// ── Administration (Level 1, parent) ─────────────────────────────
		{ name: "Administration", icon: "Shield", path: null, order: 6 },

		// ── Level 2: Administration children ─────────────────────────────
		{
			name: "Users",
			icon: "Users",
			path: "/admin/users",
			parentName: "Administration",
			order: 0,
		},
		{
			name: "Roles",
			icon: "UserCog",
			path: "/admin/roles",
			parentName: "Administration",
			order: 1,
		},
		{
			name: "Permissions",
			icon: "KeyRound",
			path: "/admin/permissions",
			parentName: "Administration",
			order: 2,
		},
		{
			name: "RBAC",
			icon: "Lock",
			path: "/admin/rbac",
			parentName: "Administration",
			order: 3,
		},
		{
			name: "All URLs",
			icon: "Globe",
			path: "/admin/urls",
			parentName: "Administration",
			order: 4,
		},
		{
			name: "All API Keys",
			icon: "KeyRound",
			path: "/admin/api-keys",
			parentName: "Administration",
			order: 5,
		},

		// ── Level 3: Users children ─────────────────────────────────────
		{
			name: "All Users",
			icon: "List",
			path: "/admin/users/all",
			parentName: "Users",
			order: 0,
		},
		{
			name: "User Groups",
			icon: "UsersRound",
			path: "/admin/users/groups",
			parentName: "Users",
			order: 1,
		},
		{
			name: "User Activity",
			icon: "Activity",
			path: "/admin/users/activity",
			parentName: "Users",
			order: 2,
		},

		// ── Level 3: Roles children ─────────────────────────────────────
		{
			name: "Role Templates",
			icon: "FileText",
			path: "/admin/roles/templates",
			parentName: "Roles",
			order: 0,
		},
		{
			name: "Role Matrix",
			icon: "GitBranch",
			path: "/admin/roles/matrix",
			parentName: "Roles",
			order: 1,
		},

		// ── Level 3: Permissions children ───────────────────────────────
		{
			name: "Permission Matrix",
			icon: "Table",
			path: "/admin/permissions/matrix",
			parentName: "Permissions",
			order: 0,
		},
		{
			name: "Audit Trail",
			icon: "Scroll",
			path: "/admin/permissions/audit",
			parentName: "Permissions",
			order: 1,
		},

		// ── System (Level 1, parent) ─────────────────────────────────────
		{
			name: "System",
			label: "System Settings",
			icon: "Settings",
			path: null,
			order: 7,
		},

		// ── Level 2: System children ────────────────────────────────────
		{
			name: "Settings",
			icon: "Sliders",
			path: "/admin/settings",
			parentName: "System",
			order: 0,
		},
		{
			name: "Health",
			icon: "HeartPulse",
			path: "/admin/health",
			parentName: "System",
			order: 1,
		},
		{
			name: "Audit Logs",
			icon: "ScrollText",
			path: "/admin/audit-logs",
			parentName: "System",
			order: 2,
		},
		{
			name: "Reports",
			icon: "FileBarChart",
			path: "/admin/reports",
			parentName: "System",
			order: 3,
		},

		// ── Level 3: Settings children ──────────────────────────────────
		{
			name: "General",
			icon: "Settings2",
			path: "/admin/settings/general",
			parentName: "Settings",
			order: 0,
		},
		{
			name: "Security",
			icon: "ShieldAlert",
			path: "/admin/settings/security",
			parentName: "Settings",
			order: 1,
		},
		{
			name: "Email",
			icon: "Mail",
			path: "/admin/settings/email",
			parentName: "Settings",
			order: 2,
		},
		{
			name: "Notifications",
			icon: "Bell",
			path: "/admin/settings/notifications",
			parentName: "Settings",
			order: 3,
		},
		{
			name: "Localization",
			icon: "Languages",
			path: "/admin/settings/localization",
			parentName: "Settings",
			order: 4,
		},

		// ── Level 4: Security children ──────────────────────────────────
		{
			name: "Password Policy",
			icon: "KeyRound",
			path: "/admin/settings/security/password-policy",
			parentName: "Security",
			order: 0,
		},
		{
			name: "Two-Factor Auth",
			icon: "ShieldCheck",
			path: "/admin/settings/security/2fa",
			parentName: "Security",
			order: 1,
		},
		{
			name: "IP Whitelist",
			icon: "ShieldHalf",
			path: "/admin/settings/security/ip-whitelist",
			parentName: "Security",
			order: 2,
		},
		{
			name: "Session Management",
			icon: "Monitor",
			path: "/admin/settings/security/sessions",
			parentName: "Security",
			order: 3,
		},

		// ── Level 5: Session Management children ────────────────────────
		{
			name: "Active Sessions",
			icon: "Activity",
			path: "/admin/settings/security/sessions/active",
			parentName: "Session Management",
			order: 0,
		},
		{
			name: "Session History",
			icon: "History",
			path: "/admin/settings/security/sessions/history",
			parentName: "Session Management",
			order: 1,
		},

		// ── Level 6: Active Sessions children (max depth demo) ──────────
		{
			name: "Force Logout",
			icon: "LogOut",
			path: "/admin/settings/security/sessions/active/force-logout",
			parentName: "Active Sessions",
			order: 0,
		},
		{
			name: "Session Inspector",
			icon: "Search",
			path: "/admin/settings/security/sessions/active/inspector",
			parentName: "Active Sessions",
			order: 1,
		},
		{
			name: "Login Activity",
			icon: "Clock",
			path: "/admin/settings/security/sessions/active/login-activity",
			parentName: "Active Sessions",
			order: 2,
		},

		// ── Level 6: Session History children ───────────────────────────
		{
			name: "Export Logs",
			icon: "Download",
			path: "/admin/settings/security/sessions/history/export",
			parentName: "Session History",
			order: 0,
		},
		{
			name: "Login Anomalies",
			icon: "AlertTriangle",
			path: "/admin/settings/security/sessions/history/anomalies",
			parentName: "Session History",
			order: 1,
		},

		// ── Level 3: Reports children ───────────────────────────────────
		{
			name: "Usage Reports",
			icon: "BarChart4",
			path: "/admin/reports/usage",
			parentName: "Reports",
			order: 0,
		},
		{
			name: "Revenue Reports",
			icon: "DollarSign",
			path: "/admin/reports/revenue",
			parentName: "Reports",
			order: 1,
		},
		{
			name: "User Reports",
			icon: "Users",
			path: "/admin/reports/users",
			parentName: "Reports",
			order: 2,
		},
		{
			name: "System Reports",
			icon: "Cpu",
			path: "/admin/reports/system",
			parentName: "Reports",
			order: 3,
		},

		// ── Content Management (Level 1, parent — fully mocked 6-level demo) ─
		{ name: "Content Management", icon: "FileStack", path: null, order: 8 },

		// ── Level 2: Content Management children ─────────────────────────
		{
			name: "Media Library",
			icon: "Image",
			path: null,
			parentName: "Content Management",
			order: 0,
		},
		{
			name: "Pages",
			icon: "FileText",
			path: "/admin/content/pages",
			parentName: "Content Management",
			order: 1,
		},
		{
			name: "Blog",
			icon: "Feather",
			path: "/admin/content/blog",
			parentName: "Content Management",
			order: 2,
		},

		// ── Level 3: Media Library children ──────────────────────────────
		{
			name: "Images",
			icon: "ImagePlus",
			path: null,
			parentName: "Media Library",
			order: 0,
		},
		{
			name: "Videos",
			icon: "Video",
			path: "/admin/content/media/videos",
			parentName: "Media Library",
			order: 1,
		},
		{
			name: "Documents",
			icon: "File",
			path: "/admin/content/media/documents",
			parentName: "Media Library",
			order: 2,
		},

		// ── Level 4: Images children ─────────────────────────────────────
		{
			name: "Galleries",
			icon: "FolderOpen",
			path: null,
			parentName: "Images",
			order: 0,
		},
		{
			name: "Albums",
			icon: "Images",
			path: "/admin/content/media/images/albums",
			parentName: "Images",
			order: 1,
		},
		{
			name: "Uploads",
			icon: "Upload",
			path: "/admin/content/media/images/uploads",
			parentName: "Images",
			order: 2,
		},

		// ── Level 5: Galleries children ──────────────────────────────────
		{
			name: "Gallery Settings",
			icon: "Settings2",
			path: null,
			parentName: "Galleries",
			order: 0,
		},
		{
			name: "Gallery Tags",
			icon: "Tags",
			path: "/admin/content/media/images/galleries/tags",
			parentName: "Galleries",
			order: 1,
		},

		// ── Level 6: Gallery Settings children (max depth = 6) ───────────
		{
			name: "Display Options",
			icon: "Palette",
			path: "/admin/content/media/images/galleries/settings/display",
			parentName: "Gallery Settings",
			order: 0,
		},
		{
			name: "Gallery Permissions",
			icon: "Lock",
			path: "/admin/content/media/images/galleries/settings/permissions",
			parentName: "Gallery Settings",
			order: 1,
		},
		{
			name: "Watermarking",
			icon: "Droplets",
			path: "/admin/content/media/images/galleries/settings/watermark",
			parentName: "Gallery Settings",
			order: 2,
		},
	];

	// Create or update menu items
	const menuItemMap = new Map<string, string>();
	for (const m of menuData) {
		const existing = await prisma.menuItem.findFirst({
			where: { name: m.name },
		});
		let item: MenuItem;
		if (existing) {
			item = await prisma.menuItem.update({
				where: { id: existing.id },
				data: {
					icon: m.icon,
					path: m.path,
					order: m.order,
					isActive: true,
					label: m.label ?? existing.label,
				},
			});
		} else {
			item = await prisma.menuItem.create({
				data: {
					name: m.name,
					label: m.label,
					icon: m.icon,
					path: m.path,
					order: m.order,
					isActive: true,
				},
			});
		}
		menuItemMap.set(m.name, item.id);
	}

	// Set parent relationships — iterate through children to tie them to parents
	for (const m of menuData) {
		if (m.parentName) {
			const childId = menuItemMap.get(m.name)!;
			const parentId = menuItemMap.get(m.parentName)!;
			if (childId && parentId) {
				await prisma.menuItem.update({
					where: { id: childId },
					data: { parentId },
				});
			}
		}
	}

	// ── 13b. Role-based access ──────────────────────────────────────────

	const adminRole = role("Admin");
	const superAdminRole = role("SuperAdmin");

	// All admin gated items → Admin role
	const adminRoleItems = [
		"Administration",
		"Users",
		"Roles",
		"Permissions",
		"System",
		"Settings",
		"All URLs",
		"All API Keys",
		"Health",
		"Reports",
		"All Users",
		"User Groups",
		"User Activity",
		"Role Templates",
		"Role Matrix",
		"Permission Matrix",
		"Audit Trail",
		"General",
		"Security",
		"Email",
		"Notifications",
		"Localization",
		"Usage Reports",
		"Revenue Reports",
		"User Reports",
		"System Reports",
		"Content Management",
		"Media Library",
		"Pages",
		"Blog",
		"Images",
		"Videos",
		"Documents",
		"Galleries",
		"Albums",
		"Uploads",
		"Gallery Settings",
		"Gallery Tags",
		"Display Options",
		"Gallery Permissions",
		"Watermarking",
	];
	for (const itemName of adminRoleItems) {
		const itemId = menuItemMap.get(itemName);
		if (itemId) {
			await prisma.menuItemRole.upsert({
				where: {
					menuItemId_roleId: { menuItemId: itemId, roleId: adminRole.id },
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					role: { connect: { id: adminRole.id } },
				},
			});
		}
	}

	// RBAC → SuperAdmin role (only super admins can manage RBAC)
	const rbacItemId = menuItemMap.get("RBAC")!;
	await prisma.menuItemRole.upsert({
		where: {
			menuItemId_roleId: { menuItemId: rbacItemId, roleId: superAdminRole.id },
		},
		update: {},
		create: {
			menuItem: { connect: { id: rbacItemId } },
			role: { connect: { id: superAdminRole.id } },
		},
	});

	// Audit Logs → SuperAdmin role
	const auditLogsItemId = menuItemMap.get("Audit Logs")!;
	await prisma.menuItemRole.upsert({
		where: {
			menuItemId_roleId: {
				menuItemId: auditLogsItemId,
				roleId: superAdminRole.id,
			},
		},
		update: {},
		create: {
			menuItem: { connect: { id: auditLogsItemId } },
			role: { connect: { id: superAdminRole.id } },
		},
	});

	// All API Keys → SuperAdmin role
	const allApiKeysItemId = menuItemMap.get("All API Keys")!;
	await prisma.menuItemRole.upsert({
		where: {
			menuItemId_roleId: {
				menuItemId: allApiKeysItemId,
				roleId: superAdminRole.id,
			},
		},
		update: {},
		create: {
			menuItem: { connect: { id: allApiKeysItemId } },
			role: { connect: { id: superAdminRole.id } },
		},
	});

	// Deep security items → SuperAdmin role (Password Policy, Two-Factor Auth, IP Whitelist, Session Management, Active Sessions, Session History)
	const superAdminItems = [
		"Password Policy",
		"Two-Factor Auth",
		"IP Whitelist",
		"Session Management",
		"Active Sessions",
		"Session History",
		"Force Logout",
		"Session Inspector",
		"Login Activity",
		"Export Logs",
		"Login Anomalies",
	];
	for (const itemName of superAdminItems) {
		const itemId = menuItemMap.get(itemName);
		if (itemId) {
			await prisma.menuItemRole.upsert({
				where: {
					menuItemId_roleId: { menuItemId: itemId, roleId: superAdminRole.id },
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					role: { connect: { id: superAdminRole.id } },
				},
			});
		}
	}

	// ── 13c. Permission-based access ─────────────────────────────────────

	// Dashboard has no permission/role requirements — visible to all authenticated users

	// Users hierarchy → LIST USER
	for (const itemName of ["Users", "All Users", "User Groups", "User Activity"]) {
		const itemId = menuItemMap.get(itemName);
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("LIST", "USER").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("LIST", "USER").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// Roles hierarchy → LIST ROLE
	for (const itemName of ["Roles", "Role Templates", "Role Matrix"]) {
		const itemId = menuItemMap.get(itemName);
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("LIST", "ROLE").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("LIST", "ROLE").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// Permissions hierarchy → LIST PERMISSION
	for (const itemName of ["Permissions", "Permission Matrix", "Audit Trail"]) {
		const itemId = menuItemMap.get(itemName);
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("LIST", "PERMISSION").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("LIST", "PERMISSION").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// RBAC → MANAGE ROLE or MANAGE PERMISSION (match ANY)
	const manageRolePerm = perm("MANAGE", "ROLE");
	const managePermissionPerm = perm("MANAGE", "PERMISSION");

	for (const permItem of [manageRolePerm, managePermissionPerm]) {
		await prisma.menuItemPermission.upsert({
			where: {
				menuItemId_permissionId: {
					menuItemId: rbacItemId,
					permissionId: permItem.id,
				},
			},
			update: {},
			create: {
				menuItem: { connect: { id: rbacItemId } },
				permission: { connect: { id: permItem.id } },
				matchType: "ANY",
			},
		});
	}

	// Settings hierarchy → READ SYSTEM_SETTINGS
	for (const itemName of ["Settings", "General", "Email", "Notifications", "Localization"]) {
		const itemId = menuItemMap.get(itemName);
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("READ", "SYSTEM_SETTINGS").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("READ", "SYSTEM_SETTINGS").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// Security hierarchy → MANAGE SYSTEM_SETTINGS
	for (const itemName of [
		"Security",
		"Password Policy",
		"Two-Factor Auth",
		"IP Whitelist",
		"Session Management",
		"Active Sessions",
		"Session History",
		"Force Logout",
		"Session Inspector",
		"Login Activity",
		"Export Logs",
		"Login Anomalies",
	]) {
		const itemId = menuItemMap.get(itemName);
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("MANAGE", "SYSTEM_SETTINGS").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("MANAGE", "SYSTEM_SETTINGS").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// All URLs → LIST URL
	{
		const itemId = menuItemMap.get("All URLs");
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("LIST", "URL").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("LIST", "URL").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// All API Keys → LIST API_KEY
	{
		const itemId = menuItemMap.get("All API Keys");
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("LIST", "API_KEY").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("LIST", "API_KEY").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// Health → READ SYSTEM_SETTINGS
	{
		const itemId = menuItemMap.get("Health");
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("READ", "SYSTEM_SETTINGS").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("READ", "SYSTEM_SETTINGS").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// Audit Logs → LIST AUDIT_LOG
	{
		const itemId = menuItemMap.get("Audit Logs");
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("LIST", "AUDIT_LOG").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("LIST", "AUDIT_LOG").id } },
					matchType: "ANY",
				},
			});
		}
	}

	// Reports hierarchy → LIST REPORT
	for (const itemName of ["Reports", "Usage Reports", "Revenue Reports", "User Reports", "System Reports"]) {
		const itemId = menuItemMap.get(itemName);
		if (itemId) {
			await prisma.menuItemPermission.upsert({
				where: {
					menuItemId_permissionId: {
						menuItemId: itemId,
						permissionId: perm("LIST", "REPORT").id,
					},
				},
				update: {},
				create: {
					menuItem: { connect: { id: itemId } },
					permission: { connect: { id: perm("LIST", "REPORT").id } },
					matchType: "ANY",
				},
			});
		}
	}

	const count = await prisma.menuItem.count();
	console.log(`✅ ${count} menu items with role & permission assignments`);
}
