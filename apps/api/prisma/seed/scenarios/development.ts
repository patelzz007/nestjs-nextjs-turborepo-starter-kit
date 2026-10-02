import { createApiKeys, createApiKeyUsageLogs } from "../api-keys";
import { seedAuthorizationKernel } from "../authorization-kernel";
import { prisma } from "../client";
import { generateAdditionalSeedData } from "../extra-users";
import { seedGeo } from "../geo-seed";
import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS, printOrganizationSeedCredentials, seedPlatformGuardrails } from "../organizations";
import { seedProducts } from "../products";
import { seedReferenceData } from "../reference-data";
import { requireRow } from "../require-row";
import { cleanupRewardSeedData, printRewardSeedCredentials, seedRewards } from "../rewards";
import { seedSamplePlatform } from "../sample-platform";
import { seedStores } from "../stores";
import { createTags } from "../tags";
import { createPasswordResetTokens, createRefreshTokens } from "../tokens";
import { createClicks, createUrlTags, createUrls } from "../urls";
import { assignAdditionalPermissions, assignRolesToUsers, createUsers } from "../users";
import { printPlatformAccountCredentials } from "./platform-accounts";
import { seedLog } from "../seed-log";

/**
 * `development` scenario (the default): reference data plus the full demo
 * dataset — test accounts, URLs/clicks, API keys, geo, categories, products,
 * the two demo organizations with rewards, and stores.
 *
 * NOTE: resets ALL organization/reward rows (cleanupRewardSeedData) before
 * re-creating the demo tenants — including any `enterprise` scenario tenant.
 */
export async function runDevelopmentScenario(): Promise<void> {
	// ── Idempotency cleanup ─────────────────────────────────────────────
	// Reference data (permissions, roles, users, tags, URLs) is upserted so it
	// survives re-runs. Rows with random/unique values (refresh tokens, clicks,
	// API keys, usage logs, reset tokens) have no stable key to upsert against —
	// wipe them first so re-running converges instead of throwing or accumulating.
	seedLog("Cleaning volatile demo rows...");
	await prisma.passwordResetToken.deleteMany();
	await prisma.apiKeyUsageLog.deleteMany();
	await prisma.apiKey.deleteMany();
	await prisma.click.deleteMany();
	await prisma.refreshToken.deleteMany();
	seedLog("✅ Volatile demo rows cleaned\n");

	const { permissions, roles } = await seedReferenceData();

	seedLog("Creating users...");
	const users = await createUsers();
	const userRole = requireRow(
		roles.find((r) => r.name === "User"),
		"role User",
	);
	const extraUsers = await generateAdditionalSeedData(roles, userRole);
	const allUsers = [...users, ...extraUsers];
	seedLog(`✅ ${String(allUsers.length)} users (${String(users.length)} primary + ${String(extraUsers.length)} additional)`);

	seedLog("Assigning roles to users...");
	await assignRolesToUsers(users, roles);
	seedLog("✅ User roles assigned");

	seedLog("Assigning user-level permission overrides...");
	await assignAdditionalPermissions(users, permissions);
	seedLog("✅ Permission overrides assigned");

	seedLog("Seeding Authorization Kernel (ACLs, Policies)...");
	const kernelSummary = await seedAuthorizationKernel(users, roles);
	seedLog(`✅ Authorization Kernel: ${String(kernelSummary.acls)} ACLs, ${String(kernelSummary.policies)} policies`);

	seedLog("Creating refresh tokens...");
	await createRefreshTokens(allUsers);
	seedLog("✅ Refresh tokens created");

	seedLog("Creating tags...");
	const tags = await createTags(allUsers);
	seedLog(`✅ ${String(tags.length)} tags`);

	seedLog("Creating URLs...");
	const urls = await createUrls(allUsers);
	seedLog(`✅ ${String(urls.length)} URLs`);

	seedLog("Linking URL tags...");
	await createUrlTags(allUsers, urls, tags);
	seedLog("✅ URL tags linked");

	seedLog("Creating clicks...");
	await createClicks(urls);
	const clickCount = await prisma.click.count();
	seedLog(`✅ ${String(clickCount)} clicks`);

	seedLog("Creating API keys...");
	await createApiKeys(allUsers);
	const keyCount = await prisma.apiKey.count();
	seedLog(`✅ ${String(keyCount)} API keys`);

	seedLog("Seeding API key usage logs...");
	await createApiKeyUsageLogs();
	const usageLogCount = await prisma.apiKeyUsageLog.count();
	seedLog(`✅ ${String(usageLogCount)} API key usage log entries`);

	seedLog("Creating password reset tokens...");
	await createPasswordResetTokens(users);
	const passwordResetCount = await prisma.passwordResetToken.count();
	seedLog(`✅ ${String(passwordResetCount)} password reset tokens`);

	seedLog("Seeding geo data (regions, countries, states, cities)...");
	await seedGeo();

	seedLog("Seeding sample categories...");
	const sampleSummary = await seedSamplePlatform();
	seedLog(`✅ Categories: ${String(sampleSummary.categories)}`);

	seedLog("Seeding demo products...");
	const productSummary = await seedProducts();
	seedLog(`✅ Products: ${String(productSummary.products)} items`);

	seedLog("Cleaning rewards platform seed data...");
	await cleanupRewardSeedData();
	seedLog("✅ Rewards seed cleanup done");

	const adminUser = requireRow(
		users.find((u) => u.email === "admin@example.com"),
		"user admin@example.com",
	);

	seedLog("Seeding platform guardrail policies...");
	await seedPlatformGuardrails(adminUser);
	seedLog("✅ Platform guardrails seeded");

	seedLog("Seeding rewards platform (organizations, merchants, rewards, claims)...");
	const rewardSummary = await seedRewards(adminUser, allUsers);
	seedLog(
		`✅ Rewards: ${String(rewardSummary.organizations)} organizations, ${String(rewardSummary.rewards)} rewards, ${String(rewardSummary.claims)} claims, ${String(rewardSummary.redemptions)} redemptions`,
	);
	seedLog("Seeding stores and store memberships...");
	const storeSummary = await seedStores(roles);
	seedLog(`✅ Stores: ${String(storeSummary.stores)} stores, ${String(storeSummary.memberships)} store memberships`);

	seedLog(
		`✅ Organizations: ${ORGANIZATION_SEED_SLUGS.kl}, ${ORGANIZATION_SEED_SLUGS.mlk} (${ORGANIZATION_SEED_IDS.klOrganization}, ${ORGANIZATION_SEED_IDS.mlkOrganization})`,
	);

	seedLog(`
🎉 Seed complete! (scenario: development)

📋 Entity counts
──────────────────────────────────────────────
Permissions   : ${String(permissions.length)}
Roles         : ${String(roles.length)}
Users         : ${String(allUsers.length)}
Tags          : ${String(tags.length)}
URLs          : ${String(urls.length)}
Clicks        : ${String(clickCount)}
API Keys      : ${String(keyCount)}
API Key Logs  : ${String(usageLogCount)}
Reset Tokens  : ${String(passwordResetCount)}
Categories    : ${String(sampleSummary.categories)}
Products      : ${String(productSummary.products)}
`);
	printPlatformAccountCredentials();
	printOrganizationSeedCredentials();
	printRewardSeedCredentials();
}
