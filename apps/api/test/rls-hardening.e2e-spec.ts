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
		// The role and the app.* settings are session-level: reset them before the connection goes
		// back to the pool, or the next `pool.query` silently runs as app_runtime under this user.
		await client.query("DISCARD ALL");
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
		const tables: readonly string[] = ["outbox_events", "analytics_events", "audit_logs", "platform_resource_idempotency_records"];

		for (const table of tables) {
			await withRlsSession(pool, { userId: "user@example.com", organizationId: "", bypass: false }, async (client) => {
				const result = await client.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM public.${table}`);
				expect(result.rows[0]?.count).toBe(0);
			});
		}
	});

	it("allows organization members to read their own org rewards with tenant context", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.klOwnerUser, organizationId: ORGANIZATION_SEED_IDS.klOrganization, bypass: false }, async (client) => {
			const result = await client.query<{ id: string }>(`SELECT id FROM public.rewards WHERE id = $1 LIMIT 1`, [REWARD_SEED_IDS.klRewardPublished]);
			expect(result.rowCount).toBe(1);
		});
	});

	it("prevents organization members from reading another org non-public rewards with tenant context", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.klOwnerUser, organizationId: ORGANIZATION_SEED_IDS.klOrganization, bypass: false }, async (client) => {
			const result = await client.query<{ id: string }>(`SELECT id FROM public.rewards WHERE id = $1 LIMIT 1`, [REWARD_SEED_IDS.mlkRewardDisabled]);
			expect(result.rowCount).toBe(0);
		});
	});

	it("allows MLK owner (ALL_LOCATIONS) to read terminals at every branch", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.mlkOwnerUser, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, bypass: false }, async (client) => {
			const katil = await client.query<{ terminalId: string }>(
				`SELECT terminal_id AS "terminalId" FROM public.organization_terminals WHERE organization_id = $1 AND location_id = $2`,
				[ORGANIZATION_SEED_IDS.mlkOrganization, ORGANIZATION_SEED_IDS.mlkLocationKatil],
			);
			const beruang = await client.query<{ terminalId: string }>(
				`SELECT terminal_id AS "terminalId" FROM public.organization_terminals WHERE organization_id = $1 AND location_id = $2`,
				[ORGANIZATION_SEED_IDS.mlkOrganization, ORGANIZATION_SEED_IDS.mlkLocationBeruang],
			);
			expect(katil.rowCount).toBeGreaterThan(0);
			expect(beruang.rowCount).toBeGreaterThan(0);
		});
	});

	it("restricts MLK cashier (SELECTED branch) to Beruang terminals only", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.mlkCashierUser, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, bypass: false }, async (client) => {
			const beruang = await client.query(`SELECT terminal_id FROM public.organization_terminals WHERE terminal_id = $1`, ["MLK-BERUANG-01"]);
			const katil = await client.query(`SELECT terminal_id FROM public.organization_terminals WHERE terminal_id = $1`, ["MLK-KATIL-01"]);
			expect(beruang.rowCount).toBe(1);
			expect(katil.rowCount).toBe(0);
		});
	});

	it("allows KL cashier (SELECTED KL location) to read KL terminals only", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.klCashierUser, organizationId: ORGANIZATION_SEED_IDS.klOrganization, bypass: false }, async (client) => {
			const kl = await client.query(`SELECT terminal_id FROM public.organization_terminals WHERE terminal_id = $1`, ["KL-REGISTER-01"]);
			const mlk = await client.query(`SELECT terminal_id FROM public.organization_terminals WHERE terminal_id = $1`, ["MLK-BERUANG-01"]);
			expect(kl.rowCount).toBe(1);
			expect(mlk.rowCount).toBe(0);
		});
	});

	it("allows MLK owner to create org-wide API keys when tenant org context matches", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.mlkOwnerUser, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, bypass: false }, async (client) => {
			await client.query("BEGIN");
			try {
				const inserted = await client.query<{ id: string }>(
					`INSERT INTO public.organization_api_keys (
            id, organization_id, location_id, name, key_hash, key_prefix, scope, created_by_user_id
          ) VALUES (gen_random_uuid(), $1, NULL, 'RLS test key', $2, 'rls-test-prefix', 'INTEGRATION', $3)
          RETURNING id`,
					[ORGANIZATION_SEED_IDS.mlkOrganization, `rls-test-${crypto.randomUUID()}`, REWARD_SEED_IDS.mlkOwnerUser],
				);
				expect(inserted.rowCount).toBe(1);
			} finally {
				await client.query("ROLLBACK");
			}
		});
	});

	describe("a reward that is no longer public", () => {
		interface ClaimedHiddenReward {
			readonly rewardId: string;
			readonly holderId: string;
			readonly outsiderId: string;
		}

		/** The lookup row — the outsider subquery yields NULL when every user claimed the reward or belongs to its organization. */
		interface ClaimedHiddenRewardRow extends Omit<ClaimedHiddenReward, "outsiderId"> {
			readonly outsiderId: string | null;
		}

		/**
		 * A consumer reward that is no longer PUBLISHED, one user holding a claim on it and one user who
		 * neither claimed it nor belongs to its organization — read with the connection's own (owner)
		 * privileges, outside any RLS session. The seed always provides one (ended rewards with claims).
		 */
		async function findClaimedHiddenReward(): Promise<ClaimedHiddenReward> {
			const result = await pool.query<ClaimedHiddenRewardRow>(
				`SELECT r.id AS "rewardId", c.user_id AS "holderId", (
            SELECT u.id FROM public.users u
            WHERE NOT EXISTS (SELECT 1 FROM public.reward_claims oc WHERE oc.reward_id = r.id AND oc.user_id = u.id)
              AND NOT EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = r.organization_id AND m.user_id = u.id)
            ORDER BY u.id LIMIT 1
          ) AS "outsiderId"
         FROM public.reward_claims c
         JOIN public.rewards r ON r.id = c.reward_id
         WHERE r.reward_kind = 'CONSUMER' AND r.status <> 'PUBLISHED' AND c.is_deleted = false
           AND NOT EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = r.organization_id AND m.user_id = c.user_id)
         ORDER BY r.id, c.user_id
         LIMIT 1`,
			);
			const row = result.rows[0];
			const outsiderId = row?.outsiderId ?? null;
			if (row === undefined || outsiderId === null) {
				throw new Error("Seed data has no claimed, no-longer-public consumer reward with an outsider user");
			}
			return { rewardId: row.rewardId, holderId: row.holderId, outsiderId };
		}

		it("stays readable to the user who claimed it, so their wallet can still name it", async () => {
			const { rewardId, holderId } = await findClaimedHiddenReward();
			await withRlsSession(pool, { userId: holderId, organizationId: "", bypass: false }, async (client) => {
				const result = await client.query<{ title: string }>(`SELECT title FROM public.rewards WHERE id = $1`, [rewardId]);
				expect(result.rowCount).toBe(1);
			});
		});

		it("stays hidden from a user who never claimed it", async () => {
			const { rewardId, outsiderId } = await findClaimedHiddenReward();
			await withRlsSession(pool, { userId: outsiderId, organizationId: "", bypass: false }, async (client) => {
				const result = await client.query<{ id: string }>(`SELECT id FROM public.rewards WHERE id = $1`, [rewardId]);
				expect(result.rowCount).toBe(0);
			});
		});

		it("stays hidden from a session with no user at all (fail-closed)", async () => {
			const { rewardId } = await findClaimedHiddenReward();
			await withRlsSession(pool, { userId: "", organizationId: "", bypass: false }, async (client) => {
				const result = await client.query<{ id: string }>(`SELECT id FROM public.rewards WHERE id = $1`, [rewardId]);
				expect(result.rowCount).toBe(0);
			});
		});
	});

	it("blocks branch-scoped API key insert when user lacks location ACL", async () => {
		await withRlsSession(pool, { userId: REWARD_SEED_IDS.mlkCashierUser, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, bypass: false }, async (client) => {
			await expect(
				client.query(
					`INSERT INTO public.organization_api_keys (
            organization_id, location_id, name, key_hash, key_prefix, scope, created_by_user_id
          ) VALUES ($1, $2, 'RLS blocked', $3, 'blocked-prefix', 'POS', $4)`,
					[ORGANIZATION_SEED_IDS.mlkOrganization, ORGANIZATION_SEED_IDS.mlkLocationKatil, `rls-blocked-${crypto.randomUUID()}`, REWARD_SEED_IDS.mlkCashierUser],
				),
			).rejects.toThrow(/row-level security/i);
		});
	});
});
