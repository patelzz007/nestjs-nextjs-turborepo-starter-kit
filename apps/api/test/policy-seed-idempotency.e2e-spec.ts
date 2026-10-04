import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../prisma/seed/client";
import { ORGANIZATION_SEED_IDS, seedPlatformGuardrails } from "../prisma/seed/organizations";
import { defaultTenantPolicySeedIds } from "../prisma/seed/policy-seed-ids";
import { seedRewardHubTenantPolicies } from "../src/modules/organization/utils/rewardhub-policy-seed.util";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

interface SeedUser {
	readonly id: string;
}

async function userByEmail(pool: Pool, email: string): Promise<SeedUser> {
	const result = await pool.query<SeedUser>("SELECT id FROM public.users WHERE email = $1", [email]);
	const row = result.rows.at(0);
	if (row === undefined) {
		throw new Error(`Seed data missing for ${email} — run pnpm db:seed`);
	}
	return row;
}

async function countPolicyRows(pool: Pool): Promise<string> {
	const result = await pool.query<{ audits: string; drafts: string; versions: string }>(
		`SELECT (SELECT count(*) FROM public.authorization_audits) AS audits,
            (SELECT count(*) FROM public.authorization_policy_drafts) AS drafts,
            (SELECT count(*) FROM public.authorization_policy_versions) AS versions`,
	);
	return JSON.stringify(result.rows.at(0));
}

/** Re-running the policy seed on an already-seeded database writes zero new rows. */
describe("Policy seed idempotency (integration)", () => {
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await pool.end();
		await prisma.$disconnect();
	});

	it("writes no new drafts, versions or audit rows on a second run", async () => {
		const admin = await userByEmail(pool, "admin@example.com");
		const superAdmin = await userByEmail(pool, "superadmin@example.com");
		const organizationId: string = ORGANIZATION_SEED_IDS.klOrganization;
		await seedPlatformGuardrails(admin, superAdmin);
		await seedRewardHubTenantPolicies(prisma, organizationId, admin.id, defaultTenantPolicySeedIds(organizationId));
		const before: string = await countPolicyRows(pool);

		await seedPlatformGuardrails(admin, superAdmin);
		await seedRewardHubTenantPolicies(prisma, organizationId, admin.id, defaultTenantPolicySeedIds(organizationId));

		expect(await countPolicyRows(pool)).toBe(before);
	});
});
