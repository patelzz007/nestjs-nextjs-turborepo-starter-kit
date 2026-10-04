import type { User } from "@prisma/client";

import { seedPlatformGuardrails } from "../organizations";
import type { ReferenceData } from "../reference-data";
import { requireRow } from "../require-row";
import { assignAdditionalPermissions, assignRolesToUsers, createUsers } from "../users";
import { seedLog } from "../seed-log";

const PLATFORM_ADMIN_EMAIL = "admin@example.com";
export const PLATFORM_SUPERADMIN_EMAIL = "superadmin@example.com";

export interface PlatformAccounts {
	readonly users: User[];
	readonly adminUser: User;
}

/**
 * The documented platform test accounts (superadmin/admin/manager/user + demo
 * users), their platform roles and direct grants, and the platform guardrail
 * Cedar policy. Used by scenarios that need a working admin panel without the
 * full development dataset.
 */
export async function seedPlatformAccounts(reference: ReferenceData): Promise<PlatformAccounts> {
	seedLog("Creating platform test accounts...");
	const users = await createUsers();
	await assignRolesToUsers(users, reference.roles);
	await assignAdditionalPermissions(users, reference.permissions);
	seedLog(`✅ ${String(users.length)} platform test accounts`);

	const adminUser = requireRow(
		users.find((user) => user.email === PLATFORM_ADMIN_EMAIL),
		`user ${PLATFORM_ADMIN_EMAIL}`,
	);

	seedLog("Seeding platform guardrail policies...");
	// Four-eyes: drafted by the platform admin, approved and published by the SuperAdmin.
	const superAdminUser = requireRow(
		users.find((user) => user.email === PLATFORM_SUPERADMIN_EMAIL),
		`user ${PLATFORM_SUPERADMIN_EMAIL}`,
	);
	await seedPlatformGuardrails(adminUser, superAdminUser);
	seedLog("✅ Platform guardrails seeded");

	return { users, adminUser };
}

export function printPlatformAccountCredentials(): void {
	seedLog(`👤 Test accounts
──────────────────────────────────────────────
superadmin@example.com    /  SuperAdmin@123  (isSuperAdmin · ENTERPRISE · email verified)
admin@example.com         /  Admin@123       (Admin role  · ENTERPRISE · email verified)
manager@example.com       /  Manager@123     (Manager role · PRO)
user@example.com          /  User@123        (User role · FREE)
alice.johnson@example.com /  Alice@123       (User role · PRO)
bob.smith@example.com     /  Bob@123         (User role · PRO)
carol.white@example.com   /  Carol@123       (User role · FREE)
david.lee@example.com     /  David@123       (Manager role · PRO)
eve.davis@example.com     /  Eve@123         (User role · FREE · INACTIVE)
frank.miller@example.com  /  Frank@123       (Admin role · ENTERPRISE)
grace.wilson@example.com  /  Grace@123       (User role · FREE)
henry.moore@example.com   /  Henry@123       (User role · PRO)
isla.taylor@example.com   /  Isla@123        (User role · FREE)
jack.anderson@example.com /  Jack@123        (User role · PRO)
`);
}
