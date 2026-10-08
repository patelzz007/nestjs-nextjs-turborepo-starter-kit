import { randomUUID } from "node:crypto";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { REWARD_SEED_IDS } from "../prisma/seed/rewards";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/** The partial unique index from migration 20261002123150_organization_terminal_live_unique. */
const LIVE_TERMINAL_UNIQUE_INDEX = "organization_terminals_organization_id_terminal_id_key";
/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION_SQLSTATE = "23505";

const PgUniqueViolationSchema = z.object({ code: z.literal(UNIQUE_VIOLATION_SQLSTATE), constraint: z.literal(LIVE_TERMINAL_UNIQUE_INDEX) });

/**
 * `@@unique([organizationId, terminalId], where: { isDeleted: false })`:
 * a terminal id is unique among an organization's live tills only, so a
 * soft-deleted till never blocks re-registering its id. Every statement runs
 * in one transaction that is rolled back, so the database is left untouched.
 */
describe("organization_terminals live-only terminal id uniqueness (integration)", () => {
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await pool.end();
	});

	async function insertTerminal(client: PoolClient, terminalId: string, isDeleted: boolean): Promise<void> {
		await client.query(
			`INSERT INTO public.organization_terminals (id, organization_id, location_id, terminal_id, label, created_by_user_id, is_deleted) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[randomUUID(), ORGANIZATION_SEED_IDS.klOrganization, ORGANIZATION_SEED_IDS.klLocation, terminalId, "E2E unique index", REWARD_SEED_IDS.klOwnerUser, isDeleted],
		);
	}

	async function inRolledBackTransaction(run: (client: PoolClient) => Promise<void>): Promise<void> {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SELECT set_config('app.rls_bypass', 'true', true)");
			await run(client);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	}

	it("lets a live till reuse the id of a soft-deleted one", async () => {
		await inRolledBackTransaction(async (client) => {
			const terminalId = `E2E-${randomUUID()}`;
			await insertTerminal(client, terminalId, true);
			await insertTerminal(client, terminalId, false);

			const live = await client.query<{ count: number }>(
				`SELECT COUNT(*)::int AS count FROM public.organization_terminals WHERE organization_id = $1 AND terminal_id = $2 AND is_deleted = false`,
				[ORGANIZATION_SEED_IDS.klOrganization, terminalId],
			);
			expect(live.rows[LIST_SLOT_INDEX.first]?.count).toBe(1);
		});
	});

	it("still rejects two live tills with the same id in one organization", async () => {
		await inRolledBackTransaction(async (client) => {
			const terminalId = `E2E-${randomUUID()}`;
			await insertTerminal(client, terminalId, false);

			const duplicate: Promise<void> = insertTerminal(client, terminalId, false);
			await expect(duplicate).rejects.toSatisfy((error: Error): boolean => PgUniqueViolationSchema.safeParse(error).success);
		});
	});
});
