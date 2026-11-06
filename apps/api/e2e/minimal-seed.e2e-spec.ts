import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createScratchDatabase, SCRATCH_SETUP_TIMEOUT_MS, type ScratchDatabase } from "./support/scratch-database";

const API_ROOT = join(import.meta.dirname, "..");
const SEED_TIMEOUT_MS = 180_000;
const CountSchema = z.object({ count: z.string() });

/**
 * Enhancement 2.4: `--scenario minimal` on a brand-new database (migrated, RLS applied, nothing seeded), the
 * way a new product starts. It must give the reference data and exactly one verified super admin who holds
 * the SuperAdmin role, and nothing else; and running it twice changes nothing.
 */
describe("The minimal seed scenario (e2e, scratch database)", () => {
	let database: ScratchDatabase;

	async function count(sql: string): Promise<number> {
		return Number(CountSchema.parse((await database.pool.query(sql)).rows.at(0)).count);
	}

	function seedMinimal(): void {
		const result = spawnSync("tsx", ["prisma/seed.ts", "--scenario", "minimal"], {
			cwd: API_ROOT,
			env: { ...process.env, DATABASE_URL: database.url, NODE_ENV: "development" },
			encoding: "utf8",
			timeout: SEED_TIMEOUT_MS,
		});
		expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
	}

	beforeAll(async () => {
		database = await createScratchDatabase(process.env.DATABASE_URL ?? "", "minimal_seed_e2e");
	}, SCRATCH_SETUP_TIMEOUT_MS);

	afterAll(async () => {
		await database.drop();
	}, SCRATCH_SETUP_TIMEOUT_MS);

	it(
		"creates the reference data and one verified super admin, nothing else, and is idempotent",
		async () => {
			seedMinimal();
			seedMinimal();

			expect(await count(`SELECT count(*)::text AS count FROM public."Permission"`)).toBeGreaterThan(0);
			expect(await count(`SELECT count(*)::text AS count FROM public."Role"`)).toBeGreaterThan(0);
			expect(await count(`SELECT count(*)::text AS count FROM public."User"`)).toBe(1);
			expect(
				await count(`SELECT count(*)::text AS count FROM public."User" WHERE email = 'superadmin@example.com' AND "isSuperAdmin" AND "emailVerifiedAt" IS NOT NULL`),
			).toBe(1);
			expect(await count(`SELECT count(*)::text AS count FROM public."UserRole" ur JOIN public."Role" r ON r.id = ur."roleId" WHERE r.name = 'SuperAdmin'`)).toBe(1);
			expect(await count(`SELECT count(*)::text AS count FROM public."Tenant"`)).toBe(0);
			expect(await count(`SELECT count(*)::text AS count FROM public."Reward"`)).toBe(0);
		},
		SEED_TIMEOUT_MS * 2,
	);
});
