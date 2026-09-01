import type { Permission, PermissionAction, PermissionResource, Plan, Role, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";

export async function createUsers(): Promise<User[]> {
	const hash = (pw: string): Promise<string> => bcrypt.hash(pw, 10);

	const usersData: {
		email: string;
		passwordHash: string;
		fullName: string;
		isActive: boolean;
		isSuperAdmin: boolean;
		plan: Plan;
		monthlyUrlLimit: number;
		monthlyClickLimit: number;
		failedLoginAttempts?: number;
		lockedUntil?: number | null;
		emailVerifiedAt?: number | null;
	}[] = [
		// System accounts — verified so admin-panel ops pass EmailVerifiedGuard.
		{
			email: "superadmin@example.com",
			passwordHash: await hash("SuperAdmin@123"),
			fullName: "Super Admin",
			isActive: true,
			isSuperAdmin: true,
			plan: "ENTERPRISE",
			monthlyUrlLimit: -1,
			monthlyClickLimit: -1,
			emailVerifiedAt: Date.now(),
		},
		{
			email: "admin@example.com",
			passwordHash: await hash("Admin@123"),
			fullName: "Admin User",
			isActive: true,
			isSuperAdmin: false,
			plan: "ENTERPRISE",
			monthlyUrlLimit: -1,
			monthlyClickLimit: -1,
			emailVerifiedAt: Date.now(),
		},
		{
			email: "manager@example.com",
			passwordHash: await hash("Manager@123"),
			fullName: "Manager User",
			isActive: true,
			isSuperAdmin: false,
			plan: "PRO",
			monthlyUrlLimit: 500,
			monthlyClickLimit: 100_000,
		},
		{
			email: "user@example.com",
			passwordHash: await hash("User@123"),
			fullName: "Regular User",
			isActive: true,
			isSuperAdmin: false,
			plan: "FREE",
			monthlyUrlLimit: 50,
			monthlyClickLimit: 10_000,
		},

		// Dummy users
		{
			email: "alice.johnson@example.com",
			passwordHash: await hash("Alice@123"),
			fullName: "Alice Johnson",
			isActive: true,
			isSuperAdmin: false,
			plan: "PRO",
			monthlyUrlLimit: 500,
			monthlyClickLimit: 100_000,
		},
		{
			email: "bob.smith@example.com",
			passwordHash: await hash("Bob@123"),
			fullName: "Bob Smith",
			isActive: true,
			isSuperAdmin: false,
			plan: "PRO",
			monthlyUrlLimit: 500,
			monthlyClickLimit: 100_000,
		},
		{
			email: "carol.white@example.com",
			passwordHash: await hash("Carol@123"),
			fullName: "Carol White",
			isActive: true,
			isSuperAdmin: false,
			plan: "FREE",
			monthlyUrlLimit: 50,
			monthlyClickLimit: 10_000,
		},
		{
			email: "david.lee@example.com",
			passwordHash: await hash("David@123"),
			fullName: "David Lee",
			isActive: true,
			isSuperAdmin: false,
			plan: "PRO",
			monthlyUrlLimit: 500,
			monthlyClickLimit: 100_000,
		},
		{
			email: "eve.davis@example.com",
			passwordHash: await hash("Eve@123"),
			fullName: "Eve Davis",
			isActive: false,
			isSuperAdmin: false, // deactivated
			plan: "FREE",
			monthlyUrlLimit: 50,
			monthlyClickLimit: 10_000,
		},
		{
			email: "frank.miller@example.com",
			passwordHash: await hash("Frank@123"),
			fullName: "Frank Miller",
			isActive: true,
			isSuperAdmin: false,
			plan: "ENTERPRISE",
			monthlyUrlLimit: -1,
			monthlyClickLimit: -1,
			emailVerifiedAt: Date.now(),
		},
		{
			email: "grace.wilson@example.com",
			passwordHash: await hash("Grace@123"),
			fullName: "Grace Wilson",
			isActive: true,
			isSuperAdmin: false,
			plan: "FREE",
			monthlyUrlLimit: 50,
			monthlyClickLimit: 10_000,
		},
		{
			email: "henry.moore@example.com",
			passwordHash: await hash("Henry@123"),
			fullName: "Henry Moore",
			isActive: true,
			isSuperAdmin: false,
			plan: "PRO",
			monthlyUrlLimit: 500,
			monthlyClickLimit: 100_000,
		},
		{
			email: "isla.taylor@example.com",
			passwordHash: await hash("Isla@123"),
			fullName: "Isla Taylor",
			isActive: true,
			isSuperAdmin: false,
			plan: "FREE",
			monthlyUrlLimit: 50,
			monthlyClickLimit: 10_000,
		},
		{
			email: "jack.anderson@example.com",
			passwordHash: await hash("Jack@123"),
			fullName: "Jack Anderson",
			isActive: true,
			isSuperAdmin: false,
			plan: "PRO",
			monthlyUrlLimit: 500,
			monthlyClickLimit: 100_000,
		},
	];

	const users: User[] = [];
	for (const u of usersData) {
		const user = await prisma.user.upsert({
			where: { email: u.email },
			update: {
				fullName: u.fullName,
				isActive: u.isActive,
				plan: u.plan ?? "FREE",
				isSuperAdmin: u.isSuperAdmin,
				emailVerifiedAt: u.emailVerifiedAt ?? null,
			},
			create: u,
		});
		users.push(user);
	}
	return users;
}

export async function assignRolesToUsers(users: User[], roles: Role[]): Promise<void> {
	const get = (email: string) => users.find((u) => u.email === email)!;
	const role = (name: string) => roles.find((r) => r.name === name)!;

	const assignments = [
		{ user: get("superadmin@example.com"), role: role("SuperAdmin") },
		{ user: get("admin@example.com"), role: role("Admin") },
		{ user: get("manager@example.com"), role: role("Manager") },
		{ user: get("user@example.com"), role: role("User") },
		{ user: get("alice.johnson@example.com"), role: role("User") },
		{ user: get("bob.smith@example.com"), role: role("User") },
		{ user: get("carol.white@example.com"), role: role("User") },
		{ user: get("david.lee@example.com"), role: role("Manager") },
		{ user: get("eve.davis@example.com"), role: role("User") },
		{ user: get("frank.miller@example.com"), role: role("Admin") },
		{ user: get("grace.wilson@example.com"), role: role("User") },
		{ user: get("henry.moore@example.com"), role: role("User") },
		{ user: get("isla.taylor@example.com"), role: role("User") },
		{ user: get("jack.anderson@example.com"), role: role("User") },
	];

	for (const a of assignments) {
		await prisma.userRole.upsert({
			where: { userId_roleId: { userId: a.user.id, roleId: a.role.id } },
			update: {},
			create: {
				user: { connect: { id: a.user.id } },
				role: { connect: { id: a.role.id } },
			},
		});
	}
}

export async function assignAdditionalPermissions(users: User[], permissions: Permission[]): Promise<void> {
	const get = (email: string) => users.find((u) => u.email === email)!;
	const perm = (action: PermissionAction, resource: PermissionResource) => permissions.find((p) => p.action === action && p.resource === resource)!;

	const overrides = [
		// admin@ — role lacks DELETE:USER; demonstrates a direct permission grant.
		{ user: get("admin@example.com"), permission: perm("DELETE", "USER") },
		// frank.miller@ — role lacks MANAGE:SYSTEM_SETTINGS; demonstrates elevated direct grant.
		{ user: get("frank.miller@example.com"), permission: perm("MANAGE", "SYSTEM_SETTINGS") },
	];

	for (const o of overrides) {
		await prisma.userPermission.upsert({
			where: {
				userId_permissionId: {
					userId: o.user.id,
					permissionId: o.permission.id,
				},
			},
			update: {},
			create: {
				user: { connect: { id: o.user.id } },
				permission: { connect: { id: o.permission.id } },
			},
		});
	}
}
