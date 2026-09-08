import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { REWARD_SEED_IDS } from "../prisma/seed/rewards";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

async function withRlsSession(
	pool: Pool,
	input: { readonly userId: string; readonly bypass: boolean },
	run: (client: PoolClient) => Promise<void>,
): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query("SET ROLE app_runtime");
		await client.query("SELECT set_config('app.current_user_id', $1, false)", [input.userId]);
		await client.query("SELECT set_config('app.rls_bypass', $1, false)", [input.bypass ? "true" : "false"]);
		await client.query("SELECT set_config('app.current_organization_id', '', false)");
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
			await withRlsSession(pool, { userId: "user@example.com", bypass: false }, async (client) => {
				const result = await client.query(`SELECT COUNT(*)::int AS count FROM public.${table}`);
				expect(result.rows[0]?.count).toBe(0);
			});
		}
	});

	it("allows merchant members to read their own org rewards without bypass", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.klOwnerUser, bypass: false }, async (client) => {
			const result = await client.query<{ id: string }>(
				`SELECT id FROM public.rewards WHERE id = $1 AND merchant_org_id = $2 LIMIT 1`,
				[REWARD_SEED_IDS.klRewardPublished, REWARD_SEED_IDS.klOrg],
			);
			expect(result.rowCount).toBe(1);
		});
	});

	it("prevents merchant members from reading another org non-public rewards without bypass", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.klOwnerUser, bypass: false }, async (client) => {
			const result = await client.query<{ id: string }>(`SELECT id FROM public.rewards WHERE id = $1 LIMIT 1`, [REWARD_SEED_IDS.mlkRewardDisabled]);
			expect(result.rowCount).toBe(0);
		});
	});
});
