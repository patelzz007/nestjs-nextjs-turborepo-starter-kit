import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { REWARD_SEED_IDS } from "../prisma/seed/rewards";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

interface RlsSessionInput {
	readonly userId: string;
	readonly organizationId: string;
	readonly bypass: boolean;
}

async function withRlsSession(pool: Pool, input: RlsSessionInput, run: (client: PoolClient) => Promise<void>): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query("SET ROLE app_runtime");
		await client.query("SELECT set_config('app.current_user_id', $1, false)", [input.userId]);
		await client.query("SELECT set_config('app.rls_bypass', $1, false)", [input.bypass ? "true" : "false"]);
		await client.query("SELECT set_config('app.current_organization_id', $1, false)", [input.organizationId]);
		await run(client);
	} finally {
		client.release();
	}
}

describe("RLS hardening (integration)", () => {
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await pool.end();
	});

	it("blocks scoped reads on infrastructure tables without bypass", async () => {
		const tables: readonly string[] = ["outbox_events", "analytics_events", "platform_resource_audit_logs", "platform_resource_idempotency_records"];

		for (const table of tables) {
			await withRlsSession(pool, { userId: "user@example.com", organizationId: "", bypass: false }, async (client) => {
				const result = await client.query(`SELECT COUNT(*)::int AS count FROM public.${table}`);
				expect(result.rows[0]?.count).toBe(0);
			});
		}
	});

	it("allows organization members to read their own org rewards with tenant context", async () => {
		await withRlsSession(
			pool,
			{ userId: REWARD_SEED_IDS.klOwnerUser, organizationId: ORGANIZATION_SEED_IDS.klOrganization, bypass: false },
			async (client) => {
				const result = await client.query<{ id: string }>(`SELECT id FROM public.rewards WHERE id = $1 LIMIT 1`, [REWARD_SEED_IDS.klRewardPublished]);
				expect(result.rowCount).toBe(1);
			},
		);
	});

	it("prevents organization members from reading another org non-public rewards with tenant context", async () => {
		await withRlsSession(
			pool,
			{ userId: REWARD_SEED_IDS.klOwnerUser, organizationId: ORGANIZATION_SEED_IDS.klOrganization, bypass: false },
			async (client) => {
				const result = await client.query<{ id: string }>(`SELECT id FROM public.rewards WHERE id = $1 LIMIT 1`, [REWARD_SEED_IDS.mlkRewardDisabled]);
				expect(result.rowCount).toBe(0);
			},
		);
	});

	it("allows MLK owner (ALL_LOCATIONS) to read terminals at every branch", async () => {
		await withRlsSession(
			pool,
			{ userId: REWARD_SEED_IDS.mlkOwnerUser, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, bypass: false },
			async (client) => {
				const katil = await client.query<{ terminal_id: string }>(
					`SELECT terminal_id FROM public.organization_terminals WHERE organization_id = $1 AND location_id = $2`,
					[ORGANIZATION_SEED_IDS.mlkOrganization, ORGANIZATION_SEED_IDS.mlkLocationKatil],
				);
				const beruang = await client.query<{ terminal_id: string }>(
					`SELECT terminal_id FROM public.organization_terminals WHERE organization_id = $1 AND location_id = $2`,
					[ORGANIZATION_SEED_IDS.mlkOrganization, ORGANIZATION_SEED_IDS.mlkLocationBeruang],
				);
				expect(katil.rowCount).toBeGreaterThan(0);
				expect(beruang.rowCount).toBeGreaterThan(0);
			},
		);
	});

	it("restricts MLK cashier (SELECTED branch) to Beruang terminals only", async () => {
		await withRlsSession(
			pool,
			{ userId: REWARD_SEED_IDS.mlkCashierUser, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, bypass: false },
			async (client) => {
				const beruang = await client.query(`SELECT terminal_id FROM public.organization_terminals WHERE terminal_id = $1`, ["MLK-BERUANG-01"]);
				const katil = await client.query(`SELECT terminal_id FROM public.organization_terminals WHERE terminal_id = $1`, ["MLK-KATIL-01"]);
				expect(beruang.rowCount).toBe(1);
				expect(katil.rowCount).toBe(0);
			},
		);
	});

	it("allows KL cashier (SELECTED KL location) to read KL terminals only", async () => {
		await withRlsSession(
			pool,
			{ userId: REWARD_SEED_IDS.klCashierUser, organizationId: ORGANIZATION_SEED_IDS.klOrganization, bypass: false },
			async (client) => {
				const kl = await client.query(`SELECT terminal_id FROM public.organization_terminals WHERE terminal_id = $1`, ["KL-REGISTER-01"]);
				const mlk = await client.query(`SELECT terminal_id FROM public.organization_terminals WHERE terminal_id = $1`, ["MLK-BERUANG-01"]);
				expect(kl.rowCount).toBe(1);
				expect(mlk.rowCount).toBe(0);
			},
		);
	});
});
