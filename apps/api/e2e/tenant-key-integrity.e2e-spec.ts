import { randomUUID } from "node:crypto";

import { DatabaseError, Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TENANT_SEED_IDS } from "../prisma/seed/tenants";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
/** PostgreSQL `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

/** Runs `statement` inside a savepoint and returns the SQLSTATE it failed with (or `null`). */
async function sqlStateOf(client: PoolClient, statement: string, values: readonly (string | number)[]): Promise<string | null> {
	await client.query("SAVEPOINT attempt");
	try {
		await client.query(statement, [...values]);
		await client.query("RELEASE SAVEPOINT attempt");
		return null;
	} catch (error) {
		await client.query("ROLLBACK TO SAVEPOINT attempt");
		if (error instanceof DatabaseError) {
			return error.code ?? null;
		}
		throw error;
	}
}

/**
 * Database-level guarantee behind tenant envelope encryption (the partial
 * unique index on TenantEncryptionKey in schema.prisma). Every case runs in a
 * transaction that is rolled back.
 */
describe("Tenant key integrity (integration)", () => {
	let pool: Pool;
	let client: PoolClient;

	beforeAll((): void => {
		pool = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await pool.end();
	});

	async function inRolledBackTransaction(run: () => Promise<void>): Promise<void> {
		client = await pool.connect();
		try {
			await client.query("BEGIN");
			await run();
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	}

	it("allows at most one ACTIVE tenant data key per tenant, and ON CONFLICT DO NOTHING inserts nothing", async () => {
		await inRolledBackTransaction(async () => {
			const tenantId: string = TENANT_SEED_IDS.klTenant;
			const insert = `INSERT INTO public."TenantEncryptionKey" (id, "tenantId", "keyVersion", "wrappedKey", "kmsKeyId", status)
        VALUES ($1, $2, $3, 'x', 'local-dev-kek/v1', 'ACTIVE')`;
			// Make sure the tenant holds an ACTIVE key (the seed's, or this one when the seed wrote none).
			await client.query(`${insert} ON CONFLICT DO NOTHING`, [randomUUID(), tenantId, 9_200]);
			expect(await sqlStateOf(client, insert, [randomUUID(), tenantId, 9_201])).toBe(UNIQUE_VIOLATION);
			const skipped = await client.query(`${insert} ON CONFLICT DO NOTHING`, [randomUUID(), tenantId, 9_202]);
			expect(skipped.rowCount).toBe(0);
		});
	});
});
