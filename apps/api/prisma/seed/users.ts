import type { Permission, PermissionAction, PermissionResource, Role, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";
import { upsertSeedGrant } from "./tenant-roles";
import { assignSeedRole } from "./rbac-audit";
import { requireRow } from "./require-row";

/** Grace period before MFA enrollment is required for existing seed users. */
const MFA_ENROLLMENT_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export async function createUsers(): Promise<User[]> {
	const mfaEnrollmentDeadline: number = Date.now() + MFA_ENROLLMENT_GRACE_MS;
	const hash = (pw: string): Promise<string> => bcrypt.hash(pw, 10);

	const usersData: {
		email: string;
		passwordHash: string;
		fullName: string;
		isActive: boolean;
		isSuperAdmin: boolean;
		failedLoginAttempts?: number;
		lockedUntil?: number | null;
		emailVerifiedAt?: number | null;
		mfaEnrollmentDeadline?: number;
	}[] = [
		// System accounts — verified so admin-panel ops pass EmailVerifiedGuard.
		{
			email: "superadmin@example.com",
			passwordHash: await hash("SuperAdmin@123"),
			fullName: "Super Admin",
			isActive: true,
			isSuperAdmin: true,
			emailVerifiedAt: Date.now(),
		},
		{
			email: "admin@example.com",
			passwordHash: await hash("Admin@123"),
			fullName: "Admin User",
			isActive: true,
			isSuperAdmin: false,
			emailVerifiedAt: Date.now(),
		},
		{
			email: "manager@example.com",
			passwordHash: await hash("Manager@123"),
			fullName: "Manager User",
			isActive: true,
			isSuperAdmin: false,
		},
		// The operations console's developer (ADR 068): Platform Developer role, nothing else of the admin panel.
		{
			email: "developer@example.com",
			passwordHash: await hash("Developer@123"),
			fullName: "Platform Developer",
			isActive: true,
			isSuperAdmin: false,
			emailVerifiedAt: Date.now(),
		},
		{
			email: "user@example.com",
			passwordHash: await hash("User@123"),
			fullName: "Regular User",
			isActive: true,
			isSuperAdmin: false,
		},

		// Dummy users
		{
			email: "bishenpatel123@gmail.com",
			passwordHash: await hash("HelloWorld_123"),
			fullName: "Bishen Patel",
			isActive: true,
			isSuperAdmin: false,
			emailVerifiedAt: Date.now(),
		},
		{
			email: "alice.johnson@example.com",
			passwordHash: await hash("Alice@123"),
			fullName: "Alice Johnson",
			isActive: true,
			isSuperAdmin: false,
		},
		{
			email: "bob.smith@example.com",
			passwordHash: await hash("Bob@123"),
			fullName: "Bob Smith",
			isActive: true,
			isSuperAdmin: false,
		},
		{
			email: "carol.white@example.com",
			passwordHash: await hash("Carol@123"),
			fullName: "Carol White",
			isActive: true,
			isSuperAdmin: false,
		},
		{
			email: "david.lee@example.com",
			passwordHash: await hash("David@123"),
			fullName: "David Lee",
			isActive: true,
			isSuperAdmin: false,
		},
		{
			email: "eve.davis@example.com",
			passwordHash: await hash("Eve@123"),
			fullName: "Eve Davis",
			isActive: false,
			isSuperAdmin: false, // deactivated
		},
		{
			email: "frank.miller@example.com",
			passwordHash: await hash("Frank@123"),
			fullName: "Frank Miller",
			isActive: true,
			isSuperAdmin: false,
			emailVerifiedAt: Date.now(),
		},
		{
			email: "grace.wilson@example.com",
			passwordHash: await hash("Grace@123"),
			fullName: "Grace Wilson",
			isActive: true,
			isSuperAdmin: false,
		},
		{
			email: "henry.moore@example.com",
			passwordHash: await hash("Henry@123"),
			fullName: "Henry Moore",
			isActive: true,
			isSuperAdmin: false,
		},
		{
			email: "isla.taylor@example.com",
			passwordHash: await hash("Isla@123"),
			fullName: "Isla Taylor",
			isActive: true,
			isSuperAdmin: false,
		},
		{
			email: "jack.anderson@example.com",
			passwordHash: await hash("Jack@123"),
			fullName: "Jack Anderson",
			isActive: true,
			isSuperAdmin: false,
		},
	];

	const users: User[] = [];
	for (const u of usersData) {
		const user = await prisma.user.upsert({
			where: { email: u.email },
			update: {
				fullName: u.fullName,
				isActive: u.isActive,
				isSuperAdmin: u.isSuperAdmin,
				emailVerifiedAt: u.emailVerifiedAt ?? null,
				mfaEnrollmentDeadline: u.mfaEnrollmentDeadline ?? mfaEnrollmentDeadline,
			},
			create: {
				...u,
				mfaEnrollmentDeadline: u.mfaEnrollmentDeadline ?? mfaEnrollmentDeadline,
			},
		});
		users.push(user);
	}
	return users;
}

export async function assignRolesToUsers(users: User[], roles: Role[]): Promise<void> {
	const get = (email: string): User =>
		requireRow(
			users.find((u) => u.email === email),
			`user ${email}`,
		);
	const role = (name: string): Role =>
		requireRow(
			roles.find((r) => r.name === name),
			`role ${name}`,
		);

	const assignments = [
		{ user: get("superadmin@example.com"), role: role("SuperAdmin") },
		{ user: get("admin@example.com"), role: role("Admin") },
		// The platform Manager role was retired (ADR 067): its holders are Admins.
		{ user: get("manager@example.com"), role: role("Admin") },
		{ user: get("developer@example.com"), role: role("Platform Developer") },
		{ user: get("user@example.com"), role: role("User") },
		{ user: get("bishenpatel123@gmail.com"), role: role("User") },
		{ user: get("alice.johnson@example.com"), role: role("User") },
		{ user: get("bob.smith@example.com"), role: role("User") },
		{ user: get("carol.white@example.com"), role: role("User") },
		{ user: get("david.lee@example.com"), role: role("Admin") },
		{ user: get("eve.davis@example.com"), role: role("User") },
		{ user: get("frank.miller@example.com"), role: role("Admin") },
		{ user: get("grace.wilson@example.com"), role: role("User") },
		{ user: get("henry.moore@example.com"), role: role("User") },
		{ user: get("isla.taylor@example.com"), role: role("User") },
		{ user: get("jack.anderson@example.com"), role: role("User") },
	];

	// Staff and customer roles are assigned by the platform operator (the SuperAdmin), audited like the admin API does.
	const operator: User = get("superadmin@example.com");
	for (const a of assignments) {
		await assignSeedRole({ userId: a.user.id, roleId: a.role.id, actorId: operator.id, action: "ROLE_ASSIGNED", scenario: "platform-accounts" });
	}
}

export async function assignAdditionalPermissions(users: User[], permissions: Permission[]): Promise<void> {
	const get = (email: string): User =>
		requireRow(
			users.find((u) => u.email === email),
			`user ${email}`,
		);
	// Permissions exist once per scope; direct grants target the GLOBAL row.
	const perm = (action: PermissionAction, resource: PermissionResource): Permission =>
		requireRow(
			permissions.find((p) => p.action === action && p.resource === resource && p.scope === "GLOBAL"),
			`permission ${action}:${resource} (GLOBAL)`,
		);

	const overrides = [
		// admin@ — role lacks DELETE:USER; demonstrates a direct permission grant.
		{ user: get("admin@example.com"), permission: perm("DELETE", "USER") },
		// frank.miller@ — role lacks UPDATE:PROFILE (editing anyone's profile); demonstrates an elevated direct grant.
		{ user: get("frank.miller@example.com"), permission: perm("UPDATE", "PROFILE") },
	];

	for (const o of overrides) {
		// A platform grant (no tenant): permanent, from no one in particular (seeded).
		await upsertSeedGrant(prisma, {
			userId: o.user.id,
			permissionId: o.permission.id,
			tenantId: null,
			data: { effect: "ALLOW", locationId: null, expiresAt: null, grantedVia: null },
		});
	}
}
