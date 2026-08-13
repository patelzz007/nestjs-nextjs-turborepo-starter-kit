import type { Permission, PermissionAction, PermissionResource } from "@prisma/client";

import { prisma } from "./client";

interface PermissionData {
	action: PermissionAction;
	resource: PermissionResource;
	description: string;
	group: string;
	isSystem?: boolean;
}

export async function createPermissions(): Promise<Permission[]> {
	const data: PermissionData[] = [
		// User Management group
		{
			action: "CREATE",
			resource: "USER",
			description: "Create new users",
			group: "User Management",
		},
		{
			action: "READ",
			resource: "USER",
			description: "View user details",
			group: "User Management",
		},
		{
			action: "UPDATE",
			resource: "USER",
			description: "Update user information",
			group: "User Management",
		},
		{
			action: "DELETE",
			resource: "USER",
			description: "Delete users",
			group: "User Management",
		},
		{
			action: "LIST",
			resource: "USER",
			description: "List all users",
			group: "User Management",
		},
		{
			action: "MANAGE",
			resource: "USER",
			description: "Full user management",
			group: "User Management",
		},

		// Profile Management group
		{
			action: "CREATE",
			resource: "PROFILE",
			description: "Create user profiles",
			group: "Profile Management",
		},
		{
			action: "READ",
			resource: "PROFILE",
			description: "View user profiles",
			group: "Profile Management",
		},
		{
			action: "UPDATE",
			resource: "PROFILE",
			description: "Update user profiles",
			group: "Profile Management",
		},
		{
			action: "DELETE",
			resource: "PROFILE",
			description: "Delete user profiles",
			group: "Profile Management",
		},
		{
			action: "LIST",
			resource: "PROFILE",
			description: "List user profiles",
			group: "Profile Management",
		},
		{
			action: "MANAGE",
			resource: "PROFILE",
			description: "Full profile management",
			group: "Profile Management",
		},

		// Role Management group
		{
			action: "CREATE",
			resource: "ROLE",
			description: "Create new roles",
			group: "Role Management",
			isSystem: true,
		},
		{
			action: "READ",
			resource: "ROLE",
			description: "View role details",
			group: "Role Management",
		},
		{
			action: "UPDATE",
			resource: "ROLE",
			description: "Update role information",
			group: "Role Management",
			isSystem: true,
		},
		{
			action: "DELETE",
			resource: "ROLE",
			description: "Delete roles",
			group: "Role Management",
			isSystem: true,
		},
		{
			action: "LIST",
			resource: "ROLE",
			description: "List all roles",
			group: "Role Management",
		},
		{
			action: "MANAGE",
			resource: "ROLE",
			description: "Full role management",
			group: "Role Management",
			isSystem: true,
		},

		// Permission Management group
		{
			action: "CREATE",
			resource: "PERMISSION",
			description: "Create new permissions",
			group: "Permission Management",
			isSystem: true,
		},
		{
			action: "READ",
			resource: "PERMISSION",
			description: "View permission details",
			group: "Permission Management",
		},
		{
			action: "UPDATE",
			resource: "PERMISSION",
			description: "Update permission information",
			group: "Permission Management",
			isSystem: true,
		},
		{
			action: "DELETE",
			resource: "PERMISSION",
			description: "Delete permissions",
			group: "Permission Management",
			isSystem: true,
		},
		{
			action: "LIST",
			resource: "PERMISSION",
			description: "List all permissions",
			group: "Permission Management",
		},
		{
			action: "MANAGE",
			resource: "PERMISSION",
			description: "Full permission management",
			group: "Permission Management",
			isSystem: true,
		},

		// Admin Dashboard group
		{
			action: "READ",
			resource: "ADMIN_DASHBOARD",
			description: "Access admin dashboard",
			group: "Admin Dashboard",
		},
		{
			action: "MANAGE",
			resource: "ADMIN_DASHBOARD",
			description: "Full admin dashboard access",
			group: "Admin Dashboard",
		},

		// System Settings group
		{
			action: "READ",
			resource: "SYSTEM_SETTINGS",
			description: "View system settings",
			group: "System Settings",
		},
		{
			action: "UPDATE",
			resource: "SYSTEM_SETTINGS",
			description: "Update system settings",
			group: "System Settings",
		},
		{
			action: "MANAGE",
			resource: "SYSTEM_SETTINGS",
			description: "Full system management",
			group: "System Settings",
			isSystem: true,
		},

		// URL Management group
		{
			action: "LIST",
			resource: "URL",
			description: "List all URLs",
			group: "URL Management",
		},
		{
			action: "READ",
			resource: "URL",
			description: "View any URL details",
			group: "URL Management",
		},
		{
			action: "UPDATE",
			resource: "URL",
			description: "Update any URL",
			group: "URL Management",
		},
		{
			action: "DELETE",
			resource: "URL",
			description: "Delete any URL",
			group: "URL Management",
		},
		{
			action: "MANAGE",
			resource: "URL",
			description: "Full URL management",
			group: "URL Management",
		},

		// API Key Management group
		{
			action: "LIST",
			resource: "API_KEY",
			description: "List all API keys",
			group: "API Key Management",
		},
		{
			action: "READ",
			resource: "API_KEY",
			description: "View any API key details",
			group: "API Key Management",
		},
		{
			action: "MANAGE",
			resource: "API_KEY",
			description: "Full API key management",
			group: "API Key Management",
		},

		// Audit Log group
		{
			action: "READ",
			resource: "AUDIT_LOG",
			description: "View audit logs",
			group: "Audit",
		},
		{
			action: "LIST",
			resource: "AUDIT_LOG",
			description: "List audit logs",
			group: "Audit",
		},
		{
			action: "MANAGE",
			resource: "AUDIT_LOG",
			description: "Full audit log management",
			group: "Audit",
			isSystem: true,
		},

		// Tag Management group
		{
			action: "CREATE",
			resource: "TAG",
			description: "Create tags",
			group: "Tag Management",
		},
		{
			action: "READ",
			resource: "TAG",
			description: "View tag details",
			group: "Tag Management",
		},
		{
			action: "UPDATE",
			resource: "TAG",
			description: "Update tags",
			group: "Tag Management",
		},
		{
			action: "DELETE",
			resource: "TAG",
			description: "Delete tags",
			group: "Tag Management",
		},
		{
			action: "LIST",
			resource: "TAG",
			description: "List all tags",
			group: "Tag Management",
		},
		{
			action: "MANAGE",
			resource: "TAG",
			description: "Full tag management",
			group: "Tag Management",
		},

		// Analytics group
		{
			action: "READ",
			resource: "ANALYTICS",
			description: "View analytics data",
			group: "Analytics",
		},
		{
			action: "LIST",
			resource: "ANALYTICS",
			description: "List analytics records",
			group: "Analytics",
		},
		{
			action: "MANAGE",
			resource: "ANALYTICS",
			description: "Full analytics management",
			group: "Analytics",
		},

		// Reports group (ABAC-ready — conditions can be set via PATCH /rbac/permissions/:id)
		// See docs/rbac.md §12 for ABAC condition syntax and usage.
		{
			action: "READ",
			resource: "REPORT",
			description: "View reports",
			group: "Reports",
		},
		{
			action: "LIST",
			resource: "REPORT",
			description: "List reports",
			group: "Reports",
		},
		{
			action: "MANAGE",
			resource: "REPORT",
			description: "Full report management",
			group: "Reports",
		},
	];

	for (const p of data) {
		await prisma.permission.upsert({
			where: { action_resource: { action: p.action, resource: p.resource } },
			update: {
				description: p.description,
				group: p.group,
				isSystem: p.isSystem ?? false,
			},
			create: {
				action: p.action,
				resource: p.resource,
				description: p.description,
				group: p.group,
				isSystem: p.isSystem ?? false,
			},
		});
	}

	return prisma.permission.findMany();
}
