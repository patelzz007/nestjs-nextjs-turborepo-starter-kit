import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, apiRoutes, DataChangeLogDetailSchema, DataChangeLogSummarySchema, JsonValueSchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * The row-level data-change trail (ADR 051) against the real AppModule and
 * database: the capture triggers record every row a request writes — joined to
 * the request by correlation id, attributed to its actor, secrets redacted —
 * and every write that never went through HTTP too. A change and its record
 * commit or roll back together, and the application role can neither forge
 * nor alter a record. The admin viewer (`GET /admin/data-changes`) serves them
 * and records each viewing (its admin-access + AUDIT_LOG guards are pinned by
 * data-changes.controller.spec.ts).
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const REGION_PREFIX = "data-change-e2e-";

const ChangeRowSchema = z.object({
	tableName: z.string(),
	operation: z.enum(["INSERT", "UPDATE", "DELETE", "TRUNCATE"]),
	rowId: z.string().nullable(),
	changedColumns: z.array(z.string()),
	oldData: JsonValueSchema.nullable(),
	newData: JsonValueSchema.nullable(),
	actorKind: z.enum(["USER", "API_KEY", "SYSTEM", "UNATTRIBUTED"]),
	actorUserId: z.string().nullable(),
	systemOperation: z.string().nullable(),
	correlationId: z.string().nullable(),
	databaseRole: z.string(),
});
type ChangeRow = z.output<typeof ChangeRowSchema>;

const CHANGE_COLUMNS = `"tableName" AS "tableName", operation::text AS operation, "rowId" AS "rowId", "changedColumns" AS "changedColumns",
	"oldData" AS "oldData", "newData" AS "newData", "actorKind"::text AS "actorKind", "actorUserId" AS "actorUserId",
	"systemOperation" AS "systemOperation", "correlationId" AS "correlationId", "databaseRole" AS "databaseRole"`;

const ChangeListEnvelopeSchema = z.object({ data: z.array(DataChangeLogSummarySchema), meta: z.object({ total: z.number() }).loose() });
const ChangeDetailEnvelopeSchema = z.object({ data: DataChangeLogDetailSchema });

const DATA_CHANGES_URL = `${API_VERSION_PREFIX}${apiRoutes.dataChanges.list}`;

describe("Row-level data-change trail (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;

	function correlationIdOf(response: InjectResponse): string {
		return z.string().parse(response.headers["x-correlation-id"]);
	}

	async function changesFor(correlationId: string): Promise<ChangeRow[]> {
		const result = await pool.query(`SELECT ${CHANGE_COLUMNS} FROM public."DataChangeLog" WHERE "correlationId" = $1 ORDER BY "changeSequence"`, [correlationId]);
		return z.array(ChangeRowSchema).parse(result.rows);
	}

	async function userId(email: string): Promise<string> {
		const result = await pool.query<{ id: string }>('SELECT id FROM public."User" WHERE email = $1', [email]);
		return z.string().parse(result.rows.at(0)?.id);
	}

	function cookie(session: LoginResult): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	async function createRegion(session: LoginResult): Promise<{ readonly response: InjectResponse; readonly name: string }> {
		const name = `${REGION_PREFIX}${randomUUID().slice(0, 8)}`;
		const response = await app.inject({ method: "POST", url: `${API_VERSION_PREFIX}/geo/regions`, headers: mutationHeaders({ cookie: cookie(session) }), payload: { name } });
		expect(response.statusCode, response.body).toBe(201);
		return { response, name };
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
	});

	afterAll(async () => {
		await pool.query('DELETE FROM public."Region" WHERE name LIKE $1', [`${REGION_PREFIX}%`]);
		await pool.end();
		await app.close();
	});

	it("records the row a request inserted, joined to the request and attributed to its actor", async () => {
		const { response, name } = await createRegion(superAdmin);

		const changes = await changesFor(correlationIdOf(response));
		const insert = changes.find((change: ChangeRow): boolean => change.tableName === "Region");
		expect(insert).toMatchObject({
			operation: "INSERT",
			changedColumns: [],
			oldData: null,
			actorKind: "USER",
			actorUserId: await userId("superadmin@example.com"),
			systemOperation: "geo.reference_data.write",
			databaseRole: "app_runtime",
		});
		expect(insert?.newData).toMatchObject({ name });
		expect(insert?.rowId).toEqual(expect.any(String));
	});

	it("records the writes of a login — the session row included — with the credential columns redacted", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/login`,
			headers: mutationHeaders({ "x-forwarded-for": "198.51.100.77" }),
			payload: { email: "superadmin@example.com", password: "SuperAdmin@123" },
		});
		expect(response.headers["set-cookie"], response.body).toEqual(expect.arrayContaining([expect.stringMatching(/^refreshToken=/)]));

		const changes = await changesFor(correlationIdOf(response));
		const session = changes.find((change: ChangeRow): boolean => change.tableName === "RefreshToken" && change.operation === "INSERT");
		expect(session?.newData).toMatchObject({ token: "[REDACTED]" });
	});

	it("lists every changed column of an UPDATE (the row-audit trigger stamps updatedAt), keeps the full row before and after, and masks personal data", async () => {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SELECT set_config('app.correlation_id', $1, true)", ["data-change-e2e-update"]);
			const target = await client.query<{ id: string }>('UPDATE public."User" SET "fullName" = "fullName" || \'!\' WHERE email = \'user@example.com\' RETURNING id');
			const [change] = z
				.array(ChangeRowSchema)
				.parse((await client.query(`SELECT ${CHANGE_COLUMNS} FROM public."DataChangeLog" WHERE "correlationId" = $1`, ["data-change-e2e-update"])).rows);

			expect(change).toMatchObject({ tableName: "User", operation: "UPDATE", rowId: target.rows.at(LIST_SLOT_INDEX.first)?.id, changedColumns: ["fullName", "updatedAt"] });
			expect(change?.oldData).toMatchObject({ email: "u***@example.com", fullName: "[PII]", passwordHash: "[REDACTED]" });
			expect(change?.newData).toMatchObject({ email: "u***@example.com", fullName: "[PII]", passwordHash: "[REDACTED]" });
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	});

	it("captures a write that never went through the API, as UNATTRIBUTED with the connection's role", async () => {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const region = await client.query<{ id: number }>('INSERT INTO public."Region" (name) VALUES ($1) RETURNING id', [`${REGION_PREFIX}manual`]);
			const result = await client.query(`SELECT ${CHANGE_COLUMNS}, "loginRole" AS "loginRole" FROM public."DataChangeLog" WHERE "tableName" = 'Region' AND "rowId" = $1`, [
				String(region.rows.at(LIST_SLOT_INDEX.first)?.id),
			]);

			expect(result.rows).toEqual([expect.objectContaining({ operation: "INSERT", actorKind: "UNATTRIBUTED", actorUserId: null, correlationId: null })]);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	});

	it("rolls a change record back with its change — the trail never describes what did not commit", async () => {
		const name = `${REGION_PREFIX}rolled-back`;
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query('INSERT INTO public."Region" (name) VALUES ($1)', [name]);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}

		const result = await pool.query('SELECT count(*)::int AS count FROM public."DataChangeLog" WHERE "tableName" = \'Region\' AND "newData" ->> \'name\' = $1', [name]);
		expect(result.rows).toEqual([{ count: 0 }]);
	});

	it("cannot be forged or altered by the application role", async () => {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SET LOCAL ROLE app_runtime");
			await client.query("SAVEPOINT forge");
			await expect(
				client.query(
					'INSERT INTO public."DataChangeLog" ("occurredAt", "transactionId", "tableName", operation, "actorKind", "databaseRole", "loginRole") VALUES (1, 1, \'User\', \'DELETE\', \'USER\', \'x\', \'x\')',
				),
			).rejects.toThrow(/row-level security/);
			await client.query("ROLLBACK TO SAVEPOINT forge");
			await expect(client.query('UPDATE public."DataChangeLog" SET "tableName" = \'x\'')).rejects.toThrow(/permission denied/);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	});

	it("shows an admin the changes of one request — filtered list, then one record with its row images", async () => {
		const { response, name } = await createRegion(superAdmin);
		const correlationId = correlationIdOf(response);

		const list = await app.inject({
			method: "GET",
			url: DATA_CHANGES_URL,
			query: { "filter[correlationId][eq]": correlationId, "filter[tableName][eq]": "Region" },
			headers: { cookie: cookie(superAdmin) },
		});
		expect(list.statusCode, list.body).toBe(200);
		const page = ChangeListEnvelopeSchema.parse(list.json());
		expect(page.meta.total).toBe(1);
		const [summary] = page.data;
		expect(summary).toMatchObject({ tableName: "Region", operation: "INSERT", actorKind: "USER", actor: { email: "superadmin@example.com" }, correlationId });
		expect(summary).not.toHaveProperty("newData");

		const detail = await app.inject({ method: "GET", url: `${DATA_CHANGES_URL}/${z.string().parse(summary?.id)}`, headers: { cookie: cookie(superAdmin) } });
		expect(detail.statusCode, detail.body).toBe(200);
		const record = ChangeDetailEnvelopeSchema.parse(detail.json()).data;
		expect(record).toMatchObject({ correlationId, oldData: null, newData: { name } });
		expect(record.loginRole.length).toBeGreaterThan(0);
	});

	it("records every viewing of the trail as a sensitive read under the data-change read operation", async () => {
		const response = await app.inject({ method: "GET", url: DATA_CHANGES_URL, query: { limit: "5" }, headers: { cookie: cookie(superAdmin) } });
		expect(response.statusCode, response.body).toBe(200);

		const result = await pool.query(`SELECT "responseBody" AS "responseBody", "systemOperations" AS "systemOperations" FROM public."AuditLog" WHERE "correlationId" = $1`, [
			correlationIdOf(response),
		]);
		const [row] = z.array(z.object({ responseBody: JsonValueSchema, systemOperations: z.array(z.string()) })).parse(result.rows);
		expect(result.rows).toHaveLength(1);
		expect(row?.responseBody).toMatchObject({ dataChangeView: { view: "list", returned: 5 } });
		expect(row?.systemOperations).toContain("audit.data_change.read");
	});

	it("answers 404 for a change record that does not exist", async () => {
		const response = await app.inject({ method: "GET", url: `${DATA_CHANGES_URL}/${randomUUID()}`, headers: { cookie: cookie(superAdmin) } });

		expect(response.statusCode).toBe(404);
	});
});
