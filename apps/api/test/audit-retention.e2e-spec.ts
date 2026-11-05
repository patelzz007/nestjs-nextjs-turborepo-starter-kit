import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { RECORD_RETENTION_MS } from "../src/platform/domain/record-retention";

const RETENTION_OPERATION = "maintenance.audit_record_retention";
const ELEVEN_YEARS_MS = RECORD_RETENTION_MS + 365 * 86_400_000;
const PgErrorSchema = z.object({ code: z.string() });
const BatchRowSchema = z.object({ affected: z.string(), held: z.string() });
const CountSchema = z.object({ count: z.string() });

/**
 * ADR 078 at the database: audit rows leave only through `app_purge_audit_batch`, under its own system
 * operation, never newer than the retention, never under an active legal hold — and the application role
 * still can't delete an audit row itself.
 */
describe("Audit-record retention (e2e, database)", () => {
	let pool: Pool;

	/** Runs `sql` as the application role, optionally under a system operation, in one transaction. */
	async function asRuntime(operation: string | null, sql: string, values: readonly (string | number | boolean)[] = []): Promise<z.output<typeof BatchRowSchema>[]> {
		const client: PoolClient = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SET LOCAL ROLE app_runtime");
			if (operation !== null) {
				await client.query("SELECT set_config('app.system_operation', $1, true)", [operation]);
			}
			const result = await client.query(sql, [...values]);
			await client.query("COMMIT");
			return z.array(BatchRowSchema).catch([]).parse(result.rows);
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}

	async function errorCodeOf<TResult>(work: Promise<TResult>): Promise<string> {
		try {
			await work;
		} catch (error) {
			return PgErrorSchema.parse(error).code;
		}
		throw new Error("expected the database to refuse");
	}

	function purge(
		cutoff: number,
		batch: number,
		dryRun: boolean,
		target = "AUDIT_LOG",
		operation: string | null = RETENTION_OPERATION,
	): Promise<z.output<typeof BatchRowSchema>[]> {
		return asRuntime(operation, "SELECT affected::text, held::text FROM public.app_purge_audit_batch($1, $2, $3, $4)", [target, cutoff, batch, dryRun]);
	}

	/** A copy of a seeded audit row with its own id, time, tenant and actor. */
	async function auditRow(occurredAt: number, tenantId: string | null, actorUserId: string | null): Promise<string> {
		const id = randomUUID();
		await pool.query(
			`INSERT INTO public."AuditLog" SELECT (jsonb_populate_record(NULL::public."AuditLog", to_jsonb(a) || jsonb_build_object('id', $1::text, 'occurredAt', $2::bigint, 'tenantId', $3::text, 'actorUserId', $4::text))).* FROM public."AuditLog" a LIMIT 1`,
			[id, occurredAt, tenantId, actorUserId],
		);
		return id;
	}

	async function exists(table: "AuditLog" | "DataChangeLog", id: string): Promise<boolean> {
		return CountSchema.parse((await pool.query(`SELECT count(*)::text AS count FROM public."${table}" WHERE id::text = $1`, [id])).rows.at(0)).count === "1";
	}

	async function hold(tenantId: string | null, userId: string | null, lifted: boolean): Promise<void> {
		const now = Date.now();
		await pool.query(
			`INSERT INTO public."AuditLegalHold" (id, "tenantId", "userId", reason, "placedByUserId", "placedAt", "liftedAt", "liftedByUserId") VALUES ($1, $2, $3, 'e2e hold', 'e2e-admin', $4, $5, $6)`,
			[randomUUID(), tenantId, userId, now, lifted ? now : null, lifted ? "e2e-admin" : null],
		);
	}

	beforeAll(() => {
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
	});

	afterAll(async () => {
		await pool.end();
	});

	it("refuses outside its operation, a cutoff inside the retention, and an oversized batch", async () => {
		const old = Date.now() - ELEVEN_YEARS_MS;
		await expect(errorCodeOf(purge(old, 10, true, "AUDIT_LOG", null))).resolves.toBe("42501");
		await expect(errorCodeOf(purge(old, 10, true, "AUDIT_LOG", "maintenance.audit_log_retention"))).resolves.toBe("42501");
		await expect(errorCodeOf(purge(Date.now() - 86_400_000, 10, false))).resolves.toBe("23514");
		await expect(errorCodeOf(purge(old, 10_001, false))).resolves.toBe("22023");
		await expect(errorCodeOf(purge(old, 10, false, "SOMETHING_ELSE"))).resolves.toBe("22023");
	});

	it("leaves the application role unable to delete an audit row itself", async () => {
		const id = await auditRow(Date.now() - ELEVEN_YEARS_MS, null, null);
		await expect(errorCodeOf(asRuntime(RETENTION_OPERATION, `DELETE FROM public."AuditLog" WHERE id = $1`, [id]))).resolves.toBe("42501");
		expect(await exists("AuditLog", id)).toBe(true);
	});

	it("removes old rows except those under an active hold, keeps recent ones, and a dry run removes nothing", async () => {
		const old = Date.now() - ELEVEN_YEARS_MS;
		const heldTenant = `retention-tenant-${randomUUID()}`;
		const heldUser = `retention-user-${randomUUID()}`;
		const liftedUser = `retention-lifted-${randomUUID()}`;
		await hold(heldTenant, null, false);
		await hold(null, heldUser, false);
		await hold(null, liftedUser, true);
		const free = await auditRow(old, null, null);
		const underTenantHold = await auditRow(old, heldTenant, null);
		const underUserHold = await auditRow(old, null, heldUser);
		const holdLifted = await auditRow(old, null, liftedUser);
		const recent = await auditRow(Date.now(), null, null);
		const cutoff = Date.now() - RECORD_RETENTION_MS - 1_000;

		const [dry] = await purge(cutoff, 1, true);
		expect(Number(dry?.affected)).toBeGreaterThanOrEqual(2);
		expect(Number(dry?.held)).toBeGreaterThanOrEqual(2);
		expect(await exists("AuditLog", free)).toBe(true);

		await purge(cutoff, 10_000, false);
		expect(await exists("AuditLog", free)).toBe(false);
		expect(await exists("AuditLog", holdLifted)).toBe(false);
		expect(await exists("AuditLog", underTenantHold)).toBe(true);
		expect(await exists("AuditLog", underUserHold)).toBe(true);
		expect(await exists("AuditLog", recent)).toBe(true);
	});

	it("removes old row changes and the change trail's index rows left with nothing", async () => {
		const correlationId = randomUUID();
		const id = randomUUID();
		await pool.query(
			`INSERT INTO public."DataChangeLog" SELECT (jsonb_populate_record(NULL::public."DataChangeLog", to_jsonb(l) || jsonb_build_object('id', $1::text, 'occurredAt', $2::bigint, 'correlationId', $3::text, 'tenantId', NULL, 'actorUserId', NULL, 'changeSequence', (SELECT max("changeSequence") + 1 FROM public."DataChangeLog")))).* FROM public."DataChangeLog" l LIMIT 1`,
			[id, Date.now() - ELEVEN_YEARS_MS, correlationId],
		);
		await purge(Date.now() - RECORD_RETENTION_MS - 1_000, 10_000, false, "DATA_CHANGE_LOG");
		expect(await exists("DataChangeLog", id)).toBe(false);
		const groups = CountSchema.parse(
			(await pool.query(`SELECT count(*)::text AS count FROM public."DataChangeGroup" WHERE "correlationId" = $1`, [correlationId])).rows.at(0),
		);
		expect(groups.count).toBe("0");
	});
});
