import "dotenv/config";

import { prisma } from "./seed/client";
import { seedAbacConditions } from "./seed/abac";
import { createApiKeys, createApiKeyUsageLogs } from "./seed/api-keys";
import { generateAdditionalSeedData } from "./seed/extra-users";
import { createMenuItems } from "./seed/menu";
import { createPermissions } from "./seed/permissions";
import { assignPermissionsToRoles, assignRoleHierarchy, createRoles } from "./seed/roles";
import { createTags } from "./seed/tags";
import { createPasswordResetTokens, createRefreshTokens } from "./seed/tokens";
import { assignAdditionalPermissions, assignRolesToUsers, createUsers } from "./seed/users";
import { createClicks, createUrlTags, createUrls } from "./seed/urls";
import { seedGeo } from "./seed/geo-seed";
import { cleanupRewardSeedData, printRewardSeedCredentials, seedRewards } from "./seed/rewards";
import { seedMerchantRoleCapabilities } from "./seed/merchant-role-capabilities";

// ---------------------------------------------------------------------------
// Orchestrator — runs the per-domain seeders in dependency order.
// Each seeder lives in `prisma/seed/<domain>.ts` and imports the shared
// `prisma` client from `prisma/seed/client.ts`.
// ---------------------------------------------------------------------------

async function main() {
	console.log("🌱 Starting seed...\n");

	// ── Idempotency cleanup ─────────────────────────────────────────────
	// Reference data (permissions, roles, users, tags, URLs, menu items) is
	// upserted below so it survives re-runs. Rows with random/unique values
	// (refresh tokens, clicks, API keys, usage logs, reset tokens) have no
	// stable key to upsert against — wipe them first so re-running db:seed
	// converges to the same state instead of throwing or accumulating rows.
	console.log("Cleaning volatile demo rows...");
	await prisma.passwordResetToken.deleteMany();
	await prisma.apiKeyUsageLog.deleteMany();
	await prisma.apiKey.deleteMany();
	await prisma.click.deleteMany();
	await prisma.refreshToken.deleteMany();
	console.log("✅ Volatile demo rows cleaned\n");

	console.log("Creating permissions...");
	const permissions = await createPermissions();
	console.log(`✅ ${permissions.length} permissions`);

	console.log("Seeding merchant role capabilities...");
	await seedMerchantRoleCapabilities();
	const merchantCapabilityCount = await prisma.merchantRoleCapability.count();
	console.log(`✅ ${merchantCapabilityCount} merchant role capabilities`);

	console.log("Creating roles...");
	const roles = await createRoles();
	console.log(`✅ ${roles.length} roles`);

	console.log("Configuring role hierarchy (flat — no parent links)...");
	await assignRoleHierarchy(roles);
	console.log("✅ Role hierarchy configured");

	console.log("Assigning permissions to roles...");
	await assignPermissionsToRoles(roles, permissions);
	console.log("✅ Role permissions assigned");

	console.log("Creating users...");
	const users = await createUsers();
	const userRole = roles.find((r) => r.name === "User")!;
	const extraUsers = await generateAdditionalSeedData(roles, userRole);
	const allUsers = [...users, ...extraUsers];
	console.log(`✅ ${allUsers.length} users (${users.length} primary + ${extraUsers.length} additional)`);

	console.log("Assigning roles to users...");
	await assignRolesToUsers(users, roles);
	console.log("✅ User roles assigned");

	console.log("Assigning user-level permission overrides...");
	await assignAdditionalPermissions(users, permissions);
	console.log("✅ Permission overrides assigned");

	console.log("Creating refresh tokens...");
	await createRefreshTokens(allUsers);
	console.log("✅ Refresh tokens created");

	console.log("Creating tags...");
	const tags = await createTags(allUsers);
	console.log(`✅ ${tags.length} tags`);

	console.log("Creating URLs...");
	const urls = await createUrls(allUsers);
	console.log(`✅ ${urls.length} URLs`);

	console.log("Linking URL tags...");
	await createUrlTags(allUsers, urls, tags);
	console.log("✅ URL tags linked");

	console.log("Creating clicks...");
	await createClicks(urls);
	const clickCount = await prisma.click.count();
	console.log(`✅ ${clickCount} clicks`);

	console.log("Creating API keys...");
	await createApiKeys(allUsers);
	const keyCount = await prisma.apiKey.count();
	console.log(`✅ ${keyCount} API keys`);

	console.log("Seeding API key usage logs...");
	await createApiKeyUsageLogs();
	const usageLogCount = await prisma.apiKeyUsageLog.count();
	console.log(`✅ ${usageLogCount} API key usage log entries`);

	console.log("Creating menu items...");
	await createMenuItems(permissions, roles);
	const menuCount = await prisma.menuItem.count();
	console.log(`✅ ${menuCount} menu items`);

	console.log("Seeding ABAC demo conditions...");
	await seedAbacConditions(permissions);
	console.log(`✅ ABAC conditions seeded on MANAGE:SYSTEM_SETTINGS`);

	console.log("Creating password reset tokens...");
	await createPasswordResetTokens(users);
	const passwordResetCount = await prisma.passwordResetToken.count();
	console.log(`✅ ${passwordResetCount} password reset tokens`);

	console.log("Seeding geo data (regions, countries, states, cities)...");
	await seedGeo();

	console.log("Cleaning rewards platform seed data...");
	await cleanupRewardSeedData();
	console.log("✅ Rewards seed cleanup done");

	const adminUser = users.find((u) => u.email === "admin@example.com")!;
	console.log("Seeding rewards platform (merchants, rewards, claims)...");
	const rewardSummary = await seedRewards(adminUser, allUsers);
	console.log(`✅ Rewards: ${rewardSummary.merchantOrgs} orgs, ${rewardSummary.rewards} rewards, ${rewardSummary.claims} claims, ${rewardSummary.redemptions} redemptions`);

	console.log(`
🎉 Seed complete!

📋 Entity counts
──────────────────────────────────────────────
Permissions   : ${permissions.length}
Roles         : ${roles.length}
Users         : ${allUsers.length}
Tags          : ${tags.length}
URLs          : ${urls.length}
Clicks        : ${clickCount}
API Keys      : ${keyCount}
API Key Logs  : ${usageLogCount}
Reset Tokens  : ${passwordResetCount}
Menu Items    : ${menuCount}

👤 Test accounts
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
	printRewardSeedCredentials();
}

main()
	.catch((e: unknown) => {
		console.error("❌ Seed failed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
