import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { sha256Hex } from "../src/common/crypto/sha256";
import { anonymousRlsContext, apiKeyRlsContext, rlsSessionVariables, type RlsContext } from "../src/prisma/rls-context";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

const KL_ORG = ORGANIZATION_SEED_IDS.klOrganization;
const KL_STORE = ORGANIZATION_SEED_IDS.klLocation;
const MLK_ORG = ORGANIZATION_SEED_IDS.mlkOrganization;
const KATIL = ORGANIZATION_SEED_IDS.mlkLocationKatil;
const BERUANG = ORGANIZATION_SEED_IDS.mlkLocationBeruang;
const DAY_MS = 86_400_000;
/** Bill total of every fixture sale, in minor units. */
const BILL_MINOR = 1_500;
/** Every key this file creates is named with this prefix, so cleanup finds exactly them. */
const KEY_NAME_PREFIX = "E2E RLS principal";

/** One fixture paid bill (with its redemption) at one store. */
interface StoreBill {
	readonly saleId: string;
	readonly redemptionId: string;
	readonly terminalRowId: string;
}

/**
 * The merchant API key as a DATABASE principal (prisma/rls/40-api-key-principal.sql).
 *
 * Each check opens a transaction exactly as the API pool does for an API-key
 * request — `SET ROLE app_runtime` plus the session variables produced by
 * `rlsSessionVariables(apiKeyRlsContext(…))` — runs a query and rolls back. No
 * bypass is involved anywhere, so what the key sees is what RLS lets it see:
 * its own organization only, and only its store's per-store rows when the key
 * is store-scoped — even when the query names another tenant's id directly.
 */
describe("API key RLS principal (e2e)", () => {
	let pool: Pool;
	let customerId: string;
	let klKeyId: string;
	let mlkKatilKeyId: string;
	const rewardIds: Record<"kl" | "mlk", string> = { kl: randomUUID(), mlk: randomUUID() };
	const bills: Partial<Record<"kl" | "katil" | "beruang", StoreBill>> = {};
	const claimIds: string[] = [];

	async function asBypass<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
		const client = await pool.connect();
		try {
			await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
			await client.query("SELECT set_config('app.system_operation', 'seed.bootstrap', false)");
			return await run(client);
		} finally {
			client.release();
		}
	}

	/** Runs `run` as the given RLS context (the API pool's session variables), then rolls back. */
	async function as<T>(context: RlsContext, run: (client: PoolClient) => Promise<T>): Promise<T> {
		const session = rlsSessionVariables(context);
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SELECT set_config('role', $1, true)", [session.role]);
			await client.query("SELECT set_config('app.current_user_id', $1, true)", [session.currentUserId]);
			await client.query("SELECT set_config('app.rls_bypass', $1, true)", [session.rlsBypass]);
			await client.query("SELECT set_config('app.current_organization_id', $1, true)", [session.currentOrganizationId]);
			await client.query("SELECT set_config('app.system_operation', $1, true)", [session.systemOperation]);
			await client.query("SELECT set_config('app.current_api_key_id', $1, true)", [session.currentApiKeyId]);
			await client.query("SELECT set_config('app.current_api_key_location_id', $1, true)", [session.currentApiKeyLocationId]);
			return await run(client);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	}

	async function count(client: PoolClient, sql: string, values: readonly string[]): Promise<number> {
		const result = await client.query<{ n: number }>(sql, [...values]);
		return result.rows[0]?.n ?? 0;
	}

	async function createKey(organizationId: string, locationId: string | null): Promise<string> {
		const id = randomUUID();
		await asBypass((client) =>
			client.query(
				`INSERT INTO public.organization_api_keys (id, organization_id, location_id, name, key_hash, key_prefix, scope, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, 'e2e-rls-prefix', 'INTEGRATION', $6)`,
				[id, organizationId, locationId, `${KEY_NAME_PREFIX} ${id}`, sha256Hex(id), customerId],
			),
		);
		return id;
	}

	async function createBill(organizationId: string, locationId: string, rewardId: string): Promise<StoreBill> {
		const now = Date.now();
		const bill: StoreBill = { saleId: randomUUID(), redemptionId: randomUUID(), terminalRowId: randomUUID() };
		const claimId = randomUUID();
		claimIds.push(claimId);
		await asBypass(async (client) => {
			await client.query(
				`INSERT INTO public.organization_terminals (id, organization_id, location_id, terminal_id, label, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6)`,
				[bill.terminalRowId, organizationId, locationId, `E2E-RLS-${bill.terminalRowId.slice(0, 8)}`, `${KEY_NAME_PREFIX} till`, customerId],
			);
			await client.query(
				`INSERT INTO public.reward_claims (id, user_id, reward_id, redemption_token_hash, backup_code_hash, status, claimed_at, claim_expires_at, redeemed_at)
         VALUES ($1, $2, $3, $4, $5, 'REDEEMED', $6, $7, $6)`,
				[claimId, customerId, rewardId, sha256Hex(`token-${claimId}`), sha256Hex(`backup-${claimId}`), now, now + DAY_MS],
			);
			await client.query(
				`INSERT INTO public.reward_sales (id, organization_id, location_id, user_id, terminal_id, bill_total_minor, currency, idempotency_key, request_hash, paid_at)
         VALUES ($1, $2, $3, $4, 'E2E-RLS-TILL', $5, 'MYR', $6, $7, $8)`,
				[bill.saleId, organizationId, locationId, customerId, BILL_MINOR, randomUUID(), sha256Hex(bill.saleId), now],
			);
			await client.query(
				`INSERT INTO public.reward_redemptions (id, claim_id, organization_id, location_id, user_id, terminal_id, redemption_method, sale_id, redeemed_at)
         VALUES ($1, $2, $3, $4, $5, 'E2E-RLS-TILL', 'SCAN', $6, $7)`,
				[bill.redemptionId, claimId, organizationId, locationId, customerId, bill.saleId, now],
			);
		});
		return bill;
	}

	function requireBill(name: "kl" | "katil" | "beruang"): StoreBill {
		const bill = bills[name];
		if (bill === undefined) {
			throw new Error(`fixture bill ${name} missing`);
		}
		return bill;
	}

	beforeAll(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		const users = await asBypass((client) => client.query<{ id: string }>(`SELECT id FROM public.users WHERE email = 'alice.johnson@example.com'`));
		customerId = String(users.rows[0]?.id);
		const now = Date.now();
		// DRAFT: a published consumer reward is public marketplace data, readable by any session.
		const fixtureRewards: readonly (readonly ["kl" | "mlk", string])[] = [
			["kl", KL_ORG],
			["mlk", MLK_ORG],
		];
		for (const [key, organizationId] of fixtureRewards) {
			await asBypass((client) =>
				client.query(
					`INSERT INTO public.rewards (id, organization_id, title, description, reward_type, reward_value, category, placeholder_image_key, quantity_total, quantity_remaining, expiry_date, status, referrals_enabled)
           VALUES ($1, $2, 'E2E RLS reward', 'Created by api-key-rls-principal.e2e-spec.ts', 'DISCOUNT', 5, 'cafe', 'cafe', 5, 5, $3, 'DRAFT', false)`,
					[rewardIds[key], organizationId, now + DAY_MS],
				),
			);
		}
		klKeyId = await createKey(KL_ORG, null);
		mlkKatilKeyId = await createKey(MLK_ORG, KATIL);
		bills.kl = await createBill(KL_ORG, KL_STORE, rewardIds.kl);
		bills.katil = await createBill(MLK_ORG, KATIL, rewardIds.mlk);
		bills.beruang = await createBill(MLK_ORG, BERUANG, rewardIds.mlk);
	});

	afterAll(async () => {
		await asBypass(async (client) => {
			const fixtureBills = Object.values(bills);
			await client.query(`DELETE FROM public.reward_redemptions WHERE id = ANY($1::text[])`, [fixtureBills.map((bill) => bill.redemptionId)]);
			await client.query(`DELETE FROM public.reward_sales WHERE id = ANY($1::text[])`, [fixtureBills.map((bill) => bill.saleId)]);
			await client.query(`DELETE FROM public.organization_terminals WHERE id = ANY($1::text[])`, [fixtureBills.map((bill) => bill.terminalRowId)]);
			await client.query(`DELETE FROM public.reward_claims WHERE id = ANY($1::text[])`, [claimIds]);
			await client.query(`DELETE FROM public.rewards WHERE id = ANY($1::text[])`, [Object.values(rewardIds)]);
			await client.query(`DELETE FROM public.organization_api_keys WHERE name LIKE $1`, [`${KEY_NAME_PREFIX}%`]);
		});
		await pool.end();
	});

	it("lets an organization-wide key see its own organization's rows — and nothing of another organization, even by id", async () => {
		await as(apiKeyRlsContext(klKeyId, KL_ORG, null), async (client) => {
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.reward_sales WHERE id = $1`, [requireBill("kl").saleId])).toBe(1);
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.rewards WHERE id = $1`, [rewardIds.kl])).toBe(1);

			const foreignRows: readonly (readonly [string, string])[] = [
				["reward_sales", requireBill("katil").saleId],
				["reward_redemptions", requireBill("katil").redemptionId],
				["organization_terminals", requireBill("katil").terminalRowId],
				["organization_api_keys", mlkKatilKeyId],
				["rewards", rewardIds.mlk],
			];
			for (const [table, id] of foreignRows) {
				expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.${table} WHERE id = $1`, [id]), table).toBe(0);
			}
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.reward_claims WHERE reward_id = $1`, [rewardIds.mlk])).toBe(0);
		});
	});

	it("keeps a store-scoped key on its own store's bills, redemptions and tills, even with another store's ids", async () => {
		await as(apiKeyRlsContext(mlkKatilKeyId, MLK_ORG, KATIL), async (client) => {
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.reward_sales WHERE id = $1`, [requireBill("katil").saleId])).toBe(1);
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.reward_sales WHERE id = $1`, [requireBill("beruang").saleId])).toBe(0);
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.reward_redemptions WHERE id = $1`, [requireBill("beruang").redemptionId])).toBe(0);
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.organization_terminals WHERE id = $1`, [requireBill("beruang").terminalRowId])).toBe(0);
			// Organization rows without a store (rewards, claims of its rewards) stay visible: their store availability is the service's job.
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.rewards WHERE id = $1`, [rewardIds.mlk])).toBe(1);
		});
	});

	it("lets a key write a bill only for its own organization and store", async () => {
		const insertSale = (client: PoolClient, organizationId: string, locationId: string): Promise<object> =>
			client.query(
				`INSERT INTO public.reward_sales (id, organization_id, location_id, user_id, terminal_id, bill_total_minor, currency, idempotency_key, request_hash, paid_at)
         VALUES ($1, $2, $3, $4, 'E2E-RLS-TILL', $5, 'MYR', $6, $7, $8)`,
				[randomUUID(), organizationId, locationId, customerId, BILL_MINOR, randomUUID(), sha256Hex(randomUUID()), Date.now()],
			);

		await as(apiKeyRlsContext(mlkKatilKeyId, MLK_ORG, KATIL), async (client) => {
			await expect(insertSale(client, MLK_ORG, KATIL)).resolves.toBeDefined();
		});
		await as(apiKeyRlsContext(mlkKatilKeyId, MLK_ORG, KATIL), async (client) => {
			await expect(insertSale(client, MLK_ORG, BERUANG)).rejects.toThrow(/row-level security/i);
		});
		await as(apiKeyRlsContext(mlkKatilKeyId, MLK_ORG, KATIL), async (client) => {
			await expect(insertSale(client, KL_ORG, KL_STORE)).rejects.toThrow(/row-level security/i);
		});
	});

	it("lets a key update only its own key row, and never delete a financial row", async () => {
		await as(apiKeyRlsContext(mlkKatilKeyId, MLK_ORG, KATIL), async (client) => {
			const own = await client.query(`UPDATE public.organization_api_keys SET last_used_at = $2 WHERE id = $1`, [mlkKatilKeyId, Date.now()]);
			expect(own.rowCount).toBe(1);
			const other = await client.query(`UPDATE public.organization_api_keys SET last_used_at = $2 WHERE id = $1`, [klKeyId, Date.now()]);
			expect(other.rowCount).toBe(0);
			const deleted = await client.query(`DELETE FROM public.reward_sales WHERE id = $1`, [requireBill("katil").saleId]);
			expect(deleted.rowCount).toBe(0);
		});
	});

	it("gives a session with no key (and no user) none of these rows", async () => {
		await as(anonymousRlsContext(KL_ORG), async (client) => {
			expect(await count(client, `SELECT COUNT(*)::int AS n FROM public.reward_sales WHERE id = $1`, [requireBill("kl").saleId])).toBe(0);
		});
	});
});
