import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { PrismaService } from "../src/prisma/prisma.service";
import { createE2eApp, login, type LoginResult } from "./e2e-helpers";
import { INSERT_REWARD_COVER_SQL, rewardCoverParams } from "./support/reward-image-fixture";
import { expectNoNPlusOne } from "./support/sql-statement-counter";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
/**
 * 2020-01-01T00:00:00Z: years before anything the seed writes. The seed's analytics history fills the
 * last 365 days of the KL store's opening hours with redemptions, so a window inside that year (this
 * spec once used 2026-10-01, the other e2e specs' epoch) can hold a seeded row and the page total is
 * off by one depending on the day the database was seeded.
 */
const FIXTURE_EPOCH = 1_577_836_800_000;

/**
 * GET /tenants/:tenantSlug/redemptions (plan §7.3) must issue the same number of SQL statements for a 1-row
 * page and a 25-row page: each row's reward title comes from the page's one joined read.
 */
describe("merchant redemption history has no N+1 (e2e)", () => {
	const marker = `n1r${randomUUID().slice(0, 8)}`;
	const rewardId = randomUUID();
	/** The fixture redemptions are dated inside this window, which no other row of the tenant uses (see FIXTURE_EPOCH). */
	const windowStart = FIXTURE_EPOCH - 1_000_000;
	const windowEnd = FIXTURE_EPOCH + 1_000_000;
	let app: NestFastifyApplication;
	let owner: LoginResult;
	let pool: Pool;
	let customerId: string;

	async function query(sql: string, values: readonly (string | number | boolean | null)[] = []): Promise<readonly Record<string, string | number | null>[]> {
		const client = await pool.connect();
		try {
			await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
			return (await client.query<Record<string, string | number | null>>(sql, [...values])).rows;
		} finally {
			client.release();
		}
	}

	async function removeFixtureRows(): Promise<void> {
		const claims = 'SELECT id FROM public."RewardClaim" WHERE "rewardId" = $1';
		const sales = await query(`SELECT DISTINCT "saleId" FROM public."RewardRedemption" WHERE "claimId" IN (${claims})`, [rewardId]);
		await query(`DELETE FROM public."RewardRedemption" WHERE "claimId" IN (${claims})`, [rewardId]);
		await query(`DELETE FROM public."RewardSale" WHERE id = ANY($1::text[])`, [`{${sales.map((sale) => String(sale.saleId)).join(",")}}`]);
		await query(`DELETE FROM public."RewardClaim" WHERE "rewardId" = $1`, [rewardId]);
	}

	/** `rows` redeemed claims, each on its own sale at the KL store, inside the fixture window. */
	async function seed(rows: number): Promise<void> {
		await removeFixtureRows();
		for (let row = 1; row <= rows; row += 1) {
			const claimId = randomUUID();
			const saleId = randomUUID();
			const redeemedAt = FIXTURE_EPOCH + row;
			await query(
				`INSERT INTO public."RewardClaim" (id, "userId", "rewardId", "redemptionTokenHash", "backupCodeHash", status, "claimedAt", "claimExpiresAt", "redeemedAt")
				 VALUES ($1, $2, $3, $4, $5, 'REDEEMED', $6, $7, $6)`,
				[claimId, customerId, rewardId, `${marker}-token-${claimId}`, `${marker}-backup-${claimId}`, redeemedAt, redeemedAt + 1],
			);
			await query(
				`INSERT INTO public."RewardSale" (id, "tenantId", "locationId", "userId", "terminalId", "billTotalMinor", currency, "idempotencyKey", "requestHash", "paidAt")
				 VALUES ($1, $2, $3, $4, 'KL-REGISTER-01', 2500, 'MYR', $5, $6, $7)`,
				[saleId, TENANT_SEED_IDS.klTenant, TENANT_SEED_IDS.klLocation, customerId, `${marker}-${saleId}`.slice(0, 64), marker.padEnd(64, "0"), redeemedAt],
			);
			await query(
				`INSERT INTO public."RewardRedemption" (id, "claimId", "tenantId", "locationId", "userId", "terminalId", "redemptionMethod", "saleId", "redeemedAt")
				 VALUES ($1, $2, $3, $4, $5, 'KL-REGISTER-01', 'SCAN', $6, $7)`,
				[randomUUID(), claimId, TENANT_SEED_IDS.klTenant, TENANT_SEED_IDS.klLocation, customerId, saleId, redeemedAt],
			);
		}
	}

	function listRedemptions(pageSize: number): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}/redemptions`,
			query: { limit: String(pageSize), "filter[redeemedAt][gte]": String(windowStart), "filter[redeemedAt][lt]": String(windowEnd) },
			headers: { cookie: `merchantAccessToken=${owner.accessToken}; merchantRefreshToken=${owner.refreshToken}`, "x-client-type": "merchant" },
		});
	}

	beforeAll(async (): Promise<void> => {
		pool = new Pool({ connectionString: DATABASE_URL });
		const [customer] = await query(`SELECT id FROM public."User" WHERE email = 'bob.smith@example.com'`);
		customerId = String(customer?.id);
		await query(
			`INSERT INTO public."Reward" (id, "tenantId", title, description, "rewardType", "rewardValue", "rewardKind", category, "quantityTotal", "quantityRemaining",
			   "expiryDate", status, "locationScopeType")
			 VALUES ($1, $2, $3, 'Created by n-plus-one.e2e-spec.ts', 'DISCOUNT', 10, 'CONSUMER', 'cafe', 100, 100, $4, 'PUBLISHED', 'ALL_LOCATIONS')`,
			[rewardId, TENANT_SEED_IDS.klTenant, `${marker} reward`, FIXTURE_EPOCH + 1_000_000_000],
		);
		await query(INSERT_REWARD_COVER_SQL, [...rewardCoverParams(rewardId, TENANT_SEED_IDS.klTenant, "free-coffee")]);
		app = await createE2eApp();
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
	});

	afterAll(async (): Promise<void> => {
		await removeFixtureRows();
		await query('DELETE FROM public."RewardImage" WHERE "rewardId" = $1', [rewardId]);
		await query('DELETE FROM public."Reward" WHERE id = $1', [rewardId]);
		await pool.end();
		await app.close();
	});

	it("counts the same statements for one redemption and a full page", async (): Promise<void> => {
		await seed(1);
		const warmed = await listRedemptions(1);
		expect(warmed.statusCode, warmed.body).toBe(200);
		const statementPool = app.get(PrismaService).connectionPool();
		await expectNoNPlusOne(
			statementPool,
			async (pageSize: number): Promise<void> => {
				const response = await listRedemptions(pageSize);
				expect(response.statusCode, response.body).toBe(200);
				expect(response.json()).toMatchObject({ meta: { total: pageSize } });
			},
			seed,
		);
	});
});
