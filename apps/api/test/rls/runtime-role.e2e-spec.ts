import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { APPLICATION_TABLES, evaluateRuntimeRoleProof, RuntimeRoleCatalog } from "../../src/platform/infrastructure/database/runtime-role-proof";
import { PrismaService } from "../../src/prisma/prisma.service";
import { DEFAULT_DATABASE_ROLE } from "../../src/prisma/system-operation.registry";
import { createScratchDatabase, SCRATCH_SETUP_TIMEOUT_MS, type ScratchDatabase } from "../support/scratch-database";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../support/two-tenant-fixture";

/**
 * Row-level security as the runtime role sees it (plan §8.3, DB-001…004, DB-006, DB-007; DB-005 is
 * test/tenant-transaction-session.e2e-spec.ts). Every query runs as `app_runtime` on a real
 * connection — no repository, no mock: these prove what PostgreSQL itself enforces.
 */

const CountRowSchema = z.object({ count: z.coerce.number().int() });
const TenantRowSchema = z.object({ tenantId: z.string() });
const SumRowSchema = z.object({ total: z.coerce.number().nullable() });

interface RlsSettings {
	readonly tenantId: string;
	readonly userId: string;
}

/** Runs `work` as `app_runtime` with exactly `settings` stamped (and nothing else), then resets the connection. */
async function asRuntime<T>(pool: Pool, settings: RlsSettings, work: (client: PoolClient) => Promise<T>): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await client.query(`SET LOCAL ROLE ${DEFAULT_DATABASE_ROLE}`);
		await client.query("SELECT set_config('app.rls_bypass', 'false', true), set_config('app.current_tenant_id', $1, true), set_config('app.current_user_id', $2, true)", [
			settings.tenantId,
			settings.userId,
		]);
		const result: T = await work(client);
		await client.query("ROLLBACK");
		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

async function count(client: PoolClient, sql: string, params: readonly string[] = []): Promise<number> {
	return CountRowSchema.parse((await client.query(sql, [...params])).rows.at(0)).count;
}

const NO_CONTEXT: RlsSettings = { tenantId: "", userId: "" };
const TENANT_A: RlsSettings = { tenantId: TWO_TENANT_FIXTURE.tenantA, userId: TWO_TENANT_FIXTURE.userAOwner };

const INSERT_LOCATION = `INSERT INTO public."Location" (id, "tenantId", name, code) VALUES ($1, $2, 'RLS probe', $3)`;

describe("RLS as the runtime role", () => {
	const prisma = new PrismaService(new TypedConfigService(getApiConfig()));
	const pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });

	beforeAll(async () => {
		await prisma.ensureConnected();
		await seedTwoTenantFixture(prisma);
	});

	afterAll(async () => {
		await pool.end();
		await prisma.$disconnect();
	});

	it("DB-001: with no tenant set, a tenant table returns no rows and an insert is denied", async () => {
		await asRuntime(pool, NO_CONTEXT, async (client) => {
			expect(await count(client, `SELECT count(*) FROM public."Location" WHERE "tenantId" = ANY($1)`, [`{${TWO_TENANT_FIXTURE.tenantA},${TWO_TENANT_FIXTURE.tenantB}}`])).toBe(
				0,
			);
			await expect(client.query(INSERT_LOCATION, [randomUUID(), TWO_TENANT_FIXTURE.tenantA, `rls-${randomUUID()}`])).rejects.toThrow(/row-level security/);
		});
	});

	it("DB-002: under tenant A, tenant B's rows are invisible", async () => {
		await asRuntime(pool, TENANT_A, async (client) => {
			// Tenant-private tables (published rewards are public marketplace reads, so they are not one).
			const tenants = z.array(TenantRowSchema).parse((await client.query(`SELECT DISTINCT "tenantId" AS "tenantId" FROM public."Membership"`)).rows);
			expect(tenants.map((row) => row.tenantId)).not.toContain(TWO_TENANT_FIXTURE.tenantB);
			expect(await count(client, `SELECT count(*) FROM public."RewardRedemption" WHERE id = $1`, [TWO_TENANT_FIXTURE.redemptionB])).toBe(0);
			expect(await count(client, `SELECT count(*) FROM public."Reward" WHERE id = $1`, [TWO_TENANT_FIXTURE.rewardBDraft])).toBe(0);
			expect(await count(client, `SELECT count(*) FROM public."Location" WHERE id = $1`, [TWO_TENANT_FIXTURE.locationBJb])).toBe(0);
		});
	});

	it("DB-008: a member of tenants A and B, working on A's route, reaches none of B's rows", async () => {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			// Arranged as the owner, rolled back: A-Owner also holds an ACTIVE membership in tenant B.
			await client.query(`INSERT INTO public."Membership" (id, "tenantId", "userId", role, status) VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`, [
				randomUUID(),
				TWO_TENANT_FIXTURE.tenantB,
				TWO_TENANT_FIXTURE.userAOwner,
			]);
			await client.query(`SET LOCAL ROLE ${DEFAULT_DATABASE_ROLE}`);
			await client.query("SELECT set_config('app.rls_bypass', 'false', true), set_config('app.current_tenant_id', $1, true), set_config('app.current_user_id', $2, true)", [
				TWO_TENANT_FIXTURE.tenantA,
				TWO_TENANT_FIXTURE.userAOwner,
			]);

			expect(await count(client, `SELECT count(*) FROM public."Location" WHERE id = $1`, [TWO_TENANT_FIXTURE.locationBJb])).toBe(0);
			expect(await count(client, `SELECT count(*) FROM public."Reward" WHERE id = $1`, [TWO_TENANT_FIXTURE.rewardBDraft])).toBe(0);
			expect(await count(client, `SELECT count(*) FROM public."Tenant" WHERE id = $1`, [TWO_TENANT_FIXTURE.tenantB])).toBe(0);
			expect(await count(client, `SELECT count(*) FROM public."Location" WHERE id = $1`, [TWO_TENANT_FIXTURE.locationAKl])).toBe(1);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	});

	it("DB-003: under tenant A, inserting a row for tenant B is denied", async () => {
		await asRuntime(pool, TENANT_A, async (client) => {
			await expect(client.query(INSERT_LOCATION, [randomUUID(), TWO_TENANT_FIXTURE.tenantB, `rls-${randomUUID()}`])).rejects.toThrow(/row-level security/);
		});
	});

	it("DB-004: under tenant A, moving a row to tenant B is denied", async () => {
		await asRuntime(pool, TENANT_A, async (client) => {
			await expect(client.query(`UPDATE public."Reward" SET "tenantId" = $1 WHERE id = $2`, [TWO_TENANT_FIXTURE.tenantB, TWO_TENANT_FIXTURE.rewardA])).rejects.toThrow(
				/row-level security/,
			);
		});
	});

	it("DB-006: the runtime role cannot bypass RLS and every application table forces it", async () => {
		const facts = await new RuntimeRoleCatalog(prisma).read(DEFAULT_DATABASE_ROLE, APPLICATION_TABLES);

		expect(facts.role).toEqual({ role: DEFAULT_DATABASE_ROLE, exists: true, isSuperuser: false, bypassesRls: false });
		expect(evaluateRuntimeRoleProof(facts)).toEqual([]);
	});

	it("DB-007: counts and aggregates under tenant A never include tenant B", async () => {
		const ownerTotals = async (tenantId: string): Promise<{ readonly sales: number; readonly total: number | null; readonly redemptions: number }> => ({
			sales: CountRowSchema.parse((await pool.query(`SELECT count(*) FROM public."RewardSale" WHERE "tenantId" = $1`, [tenantId])).rows.at(0)).count,
			total: SumRowSchema.parse((await pool.query(`SELECT sum("billTotalMinor") AS total FROM public."RewardSale" WHERE "tenantId" = $1`, [tenantId])).rows.at(0)).total,
			redemptions: CountRowSchema.parse((await pool.query(`SELECT count(*) FROM public."RewardRedemption" WHERE "tenantId" = $1`, [tenantId])).rows.at(0)).count,
		});
		const expected = await ownerTotals(TWO_TENANT_FIXTURE.tenantA);

		const seen = await asRuntime(pool, TENANT_A, async (client) => ({
			sales: await count(client, `SELECT count(*) FROM public."RewardSale" WHERE "tenantId" <> $1`, [TWO_TENANT_FIXTURE.tenantA]),
			total: SumRowSchema.parse(
				(await client.query(`SELECT sum("billTotalMinor") AS total FROM public."RewardSale" WHERE "tenantId" = $1`, [TWO_TENANT_FIXTURE.tenantA])).rows.at(0),
			).total,
			redemptions: await count(client, `SELECT count(*) FROM public."RewardRedemption" WHERE "tenantId" <> $1`, [TWO_TENANT_FIXTURE.tenantA]),
		}));

		expect(seen).toEqual({ sales: 0, total: expected.total, redemptions: 0 });
	});
});

describe("DB-006: FORCE ROW LEVEL SECURITY filters the table owner", () => {
	let scratch: ScratchDatabase;
	const owner = `rls_owner_probe_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

	beforeAll(async () => {
		scratch = await createScratchDatabase(z.string().min(1).parse(process.env.DATABASE_URL), "rls_owner");
		// A NOSUPERUSER login that owns one application table, as the migration login owns them in production.
		await scratch.pool.query(`CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
		await scratch.pool.query(`GRANT USAGE ON SCHEMA public TO ${owner}`);
		// The owner can read the other tables, as the migration login can: Tenant's policy reads Membership.
		await scratch.pool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${owner}`);
		await scratch.pool.query(`ALTER TABLE public."Tenant" OWNER TO ${owner}`);
		await scratch.pool.query(`INSERT INTO public."Tenant" (id, slug, "displayName", "timeZone") VALUES ($1, 'rls-owner-probe', 'RLS owner probe', 'Asia/Kuala_Lumpur')`, [
			randomUUID(),
		]);
	}, SCRATCH_SETUP_TIMEOUT_MS);

	afterAll(async () => {
		await scratch.pool.query(`ALTER TABLE public."Tenant" OWNER TO CURRENT_USER`);
		await scratch.pool.query(`DROP OWNED BY ${owner}`);
		await scratch.pool.query(`DROP ROLE ${owner}`);
		await scratch.drop();
	});

	it("returns no rows to the owner of a forced table when no RLS context is set", async () => {
		const client = await scratch.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(`SET LOCAL ROLE ${owner}`);
			expect(CountRowSchema.parse((await client.query(`SELECT count(*) FROM public."Tenant"`)).rows.at(0)).count).toBe(0);
			await client.query("ROLLBACK");
		} finally {
			client.release();
		}
	});
});
