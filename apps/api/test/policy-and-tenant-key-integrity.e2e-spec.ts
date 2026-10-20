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

const INSERT_VERSION = `INSERT INTO public."AuthorizationPolicyVersion"
  (id, "tenantId", "draftId", scope, version, "cedarSource", "contentHash", "publishedAt", "publishedById", "supersededAt")
  VALUES ($1, NULL, $2, 'PLATFORM', $3, 'permit(principal, action, resource);', 'hash', 0, $4, $5)`;

/**
 * Database-level guarantees behind the policy control plane and tenant
 * envelope encryption (the partial unique indexes on
 * AuthorizationPolicyVersion / TenantEncryptionKey in schema.prisma). Every
 * case runs in a transaction that is rolled back.
 */
describe("Policy version and tenant key integrity (integration)", () => {
	let pool: Pool;
	let client: PoolClient;
	let draftId: string;
	let userId: string;

	beforeAll(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		const draft = await pool.query<{ id: string; createdById: string }>(`SELECT id, "createdById" AS "createdById" FROM public."AuthorizationPolicyDraft" LIMIT 1`);
		const row = draft.rows.at(0);
		if (row === undefined) {
			throw new Error("Seed data missing (policy drafts) — run pnpm db:seed");
		}
		draftId = row.id;
		userId = row.createdById;
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

	it("keeps platform-scope (NULL tenant) version numbers unique per scope", async () => {
		await inRolledBackTransaction(async () => {
			const unusedVersion = 9_001;
			expect(await sqlStateOf(client, INSERT_VERSION, [randomUUID(), draftId, unusedVersion, userId, 1])).toBeNull();
			expect(await sqlStateOf(client, INSERT_VERSION, [randomUUID(), draftId, unusedVersion, userId, 1])).toBe(UNIQUE_VIOLATION);
		});
	});

	it("allows at most one active version per platform slot", async () => {
		await inRolledBackTransaction(async () => {
			const activeInsert = INSERT_VERSION.replace("$5)", "NULL)");
			expect(await sqlStateOf(client, activeInsert, [randomUUID(), draftId, 9_101, userId])).toBeNull();
			expect(await sqlStateOf(client, activeInsert, [randomUUID(), draftId, 9_102, userId])).toBe(UNIQUE_VIOLATION);
		});
	});

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
