import type { User } from "@prisma/client";

import { seedAccountSecurity, type AccountSecurityCastEmails } from "../account-security";
import { seedAuthorizationKernel } from "../authorization-kernel";
import { prisma } from "../client";
import { EXTRA_SEED_USER_EMAILS, generateAdditionalSeedData } from "../extra-users";
import { useSeedRandom } from "../helpers";
import { seedAnalyticsHistory } from "../analytics-history";
import { seedCustomerBans } from "../customer-bans";
import { alignCustomerAccountAges } from "../customer-account-age";
import { SeededRandom } from "../prng";
import type { SeedRunOptions } from "../seed-options";
import { seedFileLifecycle } from "../files";
import { seedKanbanBoard } from "../kanban";
import { seedGeo } from "../geo-seed";
import { seedGeoDemo } from "../geo-demo";
import { seedKernelDecisionAudits } from "../kernel-decision-audit";
import { seedTenantReviewStates } from "../tenant-review-states";
import { seedHttpAuditTrail } from "../http-audit";
import { seedGithubAccountLinks } from "../github-account-links";
import { seedGithubWebhooks } from "../github-webhooks";
import { seedOwnProfileHistory } from "../own-profile";
import { seedAnalyticsIngest } from "../analytics-ingest";
import { seedPlatformRecords } from "../platform-records";
import { seedEmailDelivery } from "../email-delivery";
import { seedInboxDeadLetters } from "../inbox-dead-letters";
import { TENANT_SEED_IDS, TENANT_SEED_SLUGS, printTenantSeedCredentials } from "../tenants";
import { seedProducts } from "../products";
import { seedReferenceData } from "../reference-data";
import { requireRow } from "../require-row";
import { cleanupRewardSeedData, printRewardSeedCredentials, REWARD_SEED_IDS, seedRewards } from "../rewards";
import { seedSamplePlatform } from "../sample-platform";
import { seedLocationRoles } from "../location-roles";
import { seedTenantAccess } from "../tenant-access";
import { createPasswordResetTokens, createRefreshTokens } from "../tokens";
import { seedRbacDemo } from "../rbac-demo";
import { seedSignupReferralCodes, seedSignupReferralDemo } from "../signup-referrals";
import { assignAdditionalPermissions, assignRolesToUsers, createUsers } from "../users";
import { printPlatformAccountCredentials } from "./platform-accounts";
import { seedLog } from "../seed-log";

/** Demo accounts for the account-security history (none is used by the e2e suites' logins). */
const DEVELOPMENT_ACCOUNT_SECURITY_CAST: AccountSecurityCastEmails = {
	namespace: "seed.account-security",
	superAdmin: "superadmin@example.com",
	recoveredUser: "bob.smith@example.com",
	mfaUser: "david.lee@example.com",
	enrollingUser: "henry.moore@example.com",
	lockedUser: "grace.wilson@example.com",
	supportAccess: { tenantId: TENANT_SEED_IDS.klTenant, ownerEmail: "brew.owner@kl-rewards.demo" },
};

/** Seed accounts that never shop as customers (platform staff); every other seeded user may appear in the analytics history. */
const NON_CUSTOMER_SEED_EMAILS: readonly string[] = ["superadmin@example.com", "admin@example.com", "manager@example.com"];

/**
 * `development` scenario (the default): reference data plus the full demo
 * dataset — test accounts, geo, categories, products,
 * the two demo tenants with rewards, and stores.
 *
 * Re-running converges: the two demo tenants are upserted and only THEIR
 * re-creatable rows are replaced (cleanupRewardSeedData). Other tenants
 * (including the `enterprise` scenario's) and every audit table are never
 * touched. Demo data is drawn from the `--seed` PRNG stream (deterministic).
 */
async function cleanVolatileSeedRows(primaryUsers: readonly User[]): Promise<void> {
	const extraUsers = await prisma.user.findMany({ where: { email: { in: [...EXTRA_SEED_USER_EMAILS] } }, select: { id: true } });
	const userId = { in: [...primaryUsers.map((user) => user.id), ...extraUsers.map((user) => user.id)] };
	await prisma.passwordResetToken.deleteMany({ where: { userId } });
	await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function runDevelopmentScenario(options: SeedRunOptions): Promise<void> {
	useSeedRandom(options.seed);
	const { permissions, roles } = await seedReferenceData();

	seedLog("Creating users...");
	const users = await createUsers();

	// ── Idempotency cleanup ─────────────────────────────────────────────
	// Reference data (permissions, roles, users, tags, URLs) is upserted so it
	// survives re-runs. Rows with random/unique values (refresh tokens, clicks,
	// API keys, usage logs, reset tokens) have no stable key to upsert against —
	// delete them, but ONLY the seed accounts' rows (and the anonymous demo
	// URLs' clicks), so re-running converges without touching anyone else.
	seedLog("Cleaning volatile demo rows of the seed accounts...");
	await cleanVolatileSeedRows(users);
	seedLog("✅ Volatile demo rows cleaned\n");
	const userRole = requireRow(
		roles.find((r) => r.name === "User"),
		"role User",
	);
	const extraUsers = await generateAdditionalSeedData(roles, userRole);
	const allUsers = [...users, ...extraUsers];
	seedLog(`✅ ${String(allUsers.length)} users (${String(users.length)} primary + ${String(extraUsers.length)} additional)`);

	seedLog("Issuing signup referral codes...");
	await seedSignupReferralCodes(allUsers);
	await seedSignupReferralDemo(allUsers);

	seedLog("Assigning roles to users...");
	await assignRolesToUsers(users, roles);
	seedLog("✅ User roles assigned");

	seedLog("Assigning user-level permission overrides...");
	await assignAdditionalPermissions(users, permissions);
	seedLog("✅ Permission overrides assigned");

	seedLog("Seeding RBAC administration history (support roles, overrides, retired rows, audit trail)...");
	const rbacSummary = await seedRbacDemo(users, roles, permissions);
	seedLog(`✅ RBAC history: ${String(rbacSummary.roles)} roles, ${String(rbacSummary.auditRows)} permission audit rows`);

	seedLog("Seeding Authorization Kernel (ACLs, Policies)...");
	const kernelSummary = await seedAuthorizationKernel(users, roles);
	seedLog(`✅ Legacy resource ACLs: ${String(kernelSummary.acls)}`);

	seedLog("Creating refresh tokens...");
	await createRefreshTokens(allUsers);
	seedLog("✅ Refresh tokens created");

	seedLog("Creating password reset tokens...");
	await createPasswordResetTokens(users);
	const passwordResetCount = await prisma.passwordResetToken.count();
	seedLog(`✅ ${String(passwordResetCount)} password reset tokens`);

	seedLog("Seeding geo data (regions, countries, states, cities)...");
	await seedGeo();

	seedLog("Seeding sample categories...");
	const sampleSummary = await seedSamplePlatform();
	seedLog(`✅ Categories: ${String(sampleSummary.categories)}`);

	seedLog("Seeding sample parked Kafka records (InboxDeadLetter)...");
	const deadLetterCount = await seedInboxDeadLetters();
	seedLog(`✅ ${String(deadLetterCount)} parked analytics-consumer records`);

	seedLog("Seeding sample email log + delivery webhook history...");
	const emailEventCount = await seedEmailDelivery();
	seedLog(`✅ ${String(emailEventCount)} email delivery events`);

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

	const superAdminUser = requireRow(
		users.find((u) => u.email === "superadmin@example.com"),
		"user superadmin@example.com",
	);

	seedLog("Seeding rewards platform (tenants, merchants, rewards, claims)...");
	const rewardSummary = await seedRewards(adminUser, allUsers);
	seedLog(
		`✅ Rewards: ${String(rewardSummary.tenants)} tenants, ${String(rewardSummary.rewards)} rewards, ${String(rewardSummary.claims)} claims, ${String(rewardSummary.redemptions)} redemptions`,
	);
	seedLog("Seeding a year of POS activity for the analytics dashboards and exports...");
	const history = await seedAnalyticsHistory({
		random: SeededRandom.derive(options.seed, "analytics-history"),
		nowMs: Date.now(),
		customerIds: allUsers.filter((user) => !NON_CUSTOMER_SEED_EMAILS.includes(user.email)).map((user) => user.id),
		createdByUserId: REWARD_SEED_IDS.mlkOwnerUser,
	});
	seedLog(`✅ Analytics history: ${String(history.rewards)} campaign rewards, ${String(history.claims)} claims, ${String(history.sales)} paid bills`);
	seedLog("Seeding merchant customer bans (one active, one lifted)...");
	const customerBans = await seedCustomerBans(Date.now());
	seedLog(`✅ ${String(customerBans)} customer bans`);
	const alignedAccounts = await alignCustomerAccountAges(
		options.seed,
		allUsers.map((user) => user.id),
	);
	seedLog(`✅ ${String(alignedAccounts)} customer accounts dated before their first claim / bill`);
	seedLog("Seeding tenant review + lifecycle states (reviewed requests, rejected store, deletion flow, deleted user)...");
	const reviewStates = await seedTenantReviewStates(adminUser);
	seedLog(
		`✅ ${String(reviewStates.reviewedAccessRequests)} reviewed access requests, ${String(reviewStates.rejectedLocationRequests)} rejected store request, ${String(reviewStates.lifecycleTenants)} tenants in a lifecycle state (deletion, suspension, ban), ${String(reviewStates.deletedUsers)} soft-deleted user, ${String(reviewStates.bannedUsers)} banned user`,
	);
	seedLog("Seeding authorization kernel decision audit rows...");
	const kernelDecisions = await seedKernelDecisionAudits();
	seedLog(`✅ ${String(kernelDecisions)} kernel decision audit rows`);
	seedLog("Seeding tenant access (role copies, a 48-hour and a permanent grant, a reward share)...");
	const tenantAccess = await seedTenantAccess();
	seedLog(
		`✅ Tenant access: ${String(tenantAccess.tenantsProvisioned)} tenants with role copies, ${String(tenantAccess.grants)} grants, ${String(tenantAccess.shares)} share`,
	);
	seedLog("Seeding location roles...");
	const locationRoles = await seedLocationRoles(roles);
	seedLog(`✅ Location roles: ${String(locationRoles.scopesWithRole)} location scopes with a role, ${String(locationRoles.closedLocations)} closed location`);

	seedLog("Seeding file lifecycle demo data (KYB evidence, product image, deleted uploads)...");
	const fileSummary = await seedFileLifecycle();
	seedLog(`✅ Files: ${String(fileSummary.files)} stored files (objects written through the ${fileSummary.provider} storage adapter)`);

	seedLog("Seeding the staff kanban board (columns, tasks, comments, attachments)...");
	const kanbanSummary = await seedKanbanBoard();
	seedLog(
		`✅ Kanban: ${String(kanbanSummary.columns)} columns, ${String(kanbanSummary.tasks)} tasks, ${String(kanbanSummary.comments)} comments, ${String(kanbanSummary.attachments)} attachments`,
	);

	const customerUser = requireRow(
		users.find((u) => u.email === "user@example.com"),
		"user user@example.com",
	);
	seedLog("Seeding global HTTP audit trail (incl. POS rows), a soft-deleted geo city and an idempotency record...");
	const auditSummary = await seedHttpAuditTrail({ superAdminId: superAdminUser.id, adminId: adminUser.id, userId: customerUser.id });
	seedLog(
		`✅ ${String(auditSummary.auditRows)} audit_logs rows, ${String(auditSummary.softDeletedCities)} soft-deleted city, ${String(auditSummary.idempotencyRecords)} idempotency record`,
	);

	seedLog("Seeding geo reference-data history (retired subtree, enriched city)...");
	const geoDemo = await seedGeoDemo(superAdminUser.id);
	seedLog(`✅ ${String(geoDemo.softDeletedRows)} soft-deleted geo rows, ${String(geoDemo.enrichedCities)} enriched city, ${String(geoDemo.auditRows)} AuditLog rows`);

	seedLog("Seeding self-service profile history (an own edit + a refused impersonated edit)...");
	const profileSummary = await seedOwnProfileHistory({ superAdminId: superAdminUser.id, customerEmail: customerUser.email });
	seedLog(`✅ ${String(profileSummary.editedProfiles)} edited profile, ${String(profileSummary.auditRows)} AuditLog rows`);

	seedLog("Seeding GitHub pull-request links (an expired, rejected token; an unlinked one)...");
	const githubLinks = await seedGithubAccountLinks({ adminId: adminUser.id, superAdminId: superAdminUser.id }, Date.now());
	seedLog(
		githubLinks.status === "seeded"
			? `✅ ${String(githubLinks.links)} GitHub account links${githubLinks.kept > 0 ? ` (${String(githubLinks.kept)} developer's own link kept as it is)` : ""}`
			: "⚠️ GitHub account links skipped: GITHUB_CREDENTIAL_ENCRYPTION_KEYS is not set (run `pnpm tools secrets:generate`)",
	);

	seedLog("Seeding GitHub live updates (one repository on, one turned off, two deliveries)...");
	const githubWebhooks = await seedGithubWebhooks({ adminId: adminUser.id, superAdminId: superAdminUser.id }, Date.now());
	seedLog(`✅ ${String(githubWebhooks.subscriptions)} live-update subscriptions, ${String(githubWebhooks.deliveries)} webhook deliveries`);

	seedLog("Seeding platform records (outbox history, slug history, soft-deleted catalog rows)...");
	const platformRecords = await seedPlatformRecords({ superAdminId: superAdminUser.id, adminId: adminUser.id, userId: customerUser.id });
	seedLog(
		`✅ ${String(platformRecords.outboxEvents)} outbox events, ${String(platformRecords.slugHistory)} slug history, ${String(platformRecords.softDeletedCatalogRows)} catalog records`,
	);

	seedLog("Replaying the published outbox events through the analytics consumer (AnalyticsEvent, InboxProcessedEvent)...");
	await seedAnalyticsIngest();

	seedLog("Seeding account security (impersonation, MFA recovery, 2FA enrollment, lockout, password history, support access)...");
	await seedAccountSecurity(DEVELOPMENT_ACCOUNT_SECURITY_CAST, seedLog);

	seedLog(`✅ Tenants: ${TENANT_SEED_SLUGS.kl}, ${TENANT_SEED_SLUGS.mlk} (${TENANT_SEED_IDS.klTenant}, ${TENANT_SEED_IDS.mlkTenant})`);

	seedLog(`
🎉 Seed complete! (scenario: development)

📋 Entity counts
──────────────────────────────────────────────
Permissions   : ${String(permissions.length)}
Roles         : ${String(roles.length)}
Users         : ${String(allUsers.length)}
Reset Tokens  : ${String(passwordResetCount)}
Categories    : ${String(sampleSummary.categories)}
Products      : ${String(productSummary.products)}
`);
	printPlatformAccountCredentials();
	printTenantSeedCredentials();
	printRewardSeedCredentials();
}
