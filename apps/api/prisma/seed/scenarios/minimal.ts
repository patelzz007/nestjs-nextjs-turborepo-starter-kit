import * as bcrypt from "bcrypt";

import { upsertLiveUserByEmail } from "../live-user";
import { prisma } from "../client";
import { seedReferenceData } from "../reference-data";
import { seedLog } from "../seed-log";
import { PLATFORM_SUPERADMIN_EMAIL } from "./platform-accounts";

/** The one account the minimal scenario creates, and its local-only password (change it on first sign-in). */
const MINIMAL_SUPERADMIN_PASSWORD = "SuperAdmin@123";
/** bcrypt cost for seeded passwords (the other seeds use the same). */
const SEED_BCRYPT_ROUNDS = 10;

/**
 * `--scenario minimal` (enhancement 2.4): what a new product starts from. The reference data (permissions,
 * roles, capabilities) and ONE verified super admin, and nothing else: no demo users, tenants, rewards or
 * history. Additive and idempotent, like every scenario. A deployed database is bootstrapped with
 * `pnpm --filter @workspace/api superadmin:bootstrap` instead (the seed refuses non-local databases).
 */
export async function runMinimalScenario(): Promise<void> {
	const { permissions, roles } = await seedReferenceData();
	const superAdminRole = roles.find((role) => role.name === "SuperAdmin");
	if (superAdminRole === undefined) {
		throw new Error("The reference data has no SuperAdmin role");
	}
	const passwordHash = await bcrypt.hash(MINIMAL_SUPERADMIN_PASSWORD, SEED_BCRYPT_ROUNDS);
	const verifiedAt = Date.now();
	const superAdmin = await upsertLiveUserByEmail(
		PLATFORM_SUPERADMIN_EMAIL,
		{ isSuperAdmin: true, isActive: true, emailVerifiedAt: verifiedAt },
		{ email: PLATFORM_SUPERADMIN_EMAIL, fullName: "Super Admin", passwordHash, isSuperAdmin: true, isActive: true, emailVerifiedAt: verifiedAt },
	);
	await prisma.userRole.upsert({
		where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
		update: {},
		create: { userId: superAdmin.id, roleId: superAdminRole.id },
	});
	seedLog(`
🎉 Seed complete! (scenario: minimal)

Permissions : ${String(permissions.length)}
Roles       : ${String(roles.length)}
Super admin : ${PLATFORM_SUPERADMIN_EMAIL} / ${MINIMAL_SUPERADMIN_PASSWORD}  (local only: change it on first sign-in)

No other users, tenants or demo data were created.
`);
}
