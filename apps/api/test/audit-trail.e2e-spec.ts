import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, apiRoutes, AuditTrailEntrySchema, JsonValueSchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * The admin audit log's timeline (`GET /admin/audit-trail`, ADR 051) against
 * the real AppModule and database: an HTTP request appears once, with the rows
 * it changed; database writes no request made appear as background entries,
 * one per job (correlation id); every filter narrows the union correctly, and
 * cursor paging continues it.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const REGION_PREFIX = "audit-trail-e2e-";
const TRAIL_URL = `${API_VERSION_PREFIX}${apiRoutes.auditTrail.list}`;

const TrailPageSchema = z.object({
	data: z.array(AuditTrailEntrySchema),
	meta: z.object({ total: z.number(), nextCursor: z.string().nullable() }).loose(),
});
type TrailPage = z.output<typeof TrailPageSchema>;

/** The audit row a viewing of the trail wrote. */
const SensitiveReadRowSchema = z.object({ responseBody: JsonValueSchema, systemOperations: z.array(z.string()) });

describe("Audit trail timeline (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;

	function cookie(session: LoginResult): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	async function trail(query: Readonly<Record<string, string>>): Promise<TrailPage> {
		const response: InjectResponse = await app.inject({ method: "GET", url: TRAIL_URL, query, headers: { cookie: cookie(superAdmin) } });
		expect(response.statusCode, response.body).toBe(200);
		return TrailPageSchema.parse(response.json());
	}

	/** Commits `names` as regions in ONE transaction under a job's correlation id — a background write no request made. */
	async function backgroundJob(correlationId: string, names: readonly string[]): Promise<void> {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SELECT set_config('app.correlation_id', $1, true), set_config('app.system_operation', 'geo.reference_data.write', true)", [correlationId]);
			for (const name of names) {
				await client.query("INSERT INTO public.regions (name) VALUES ($1)", [name]);
			}
			await client.query("COMMIT");
		} finally {
			client.release();
		}
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
	});

	afterAll(async () => {
		await pool.query("DELETE FROM public.regions WHERE name LIKE $1", [`${REGION_PREFIX}%`]);
		await pool.end();
		await app.close();
	});

	it("shows a request once, with how many rows it changed and where", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/geo/regions`,
			headers: mutationHeaders({ cookie: cookie(superAdmin) }),
			payload: { name: `${REGION_PREFIX}${randomUUID().slice(0, 8)}` },
		});
		expect(response.statusCode, response.body).toBe(201);
		const correlationId = z.string().parse(response.headers["x-correlation-id"]);

		const page = await trail({ "filter[correlationId][eq]": correlationId });

		expect(page.meta.total).toBe(1);
		const entry = page.data.at(LIST_SLOT_INDEX.first);
		expect(entry).toMatchObject({ kind: "REQUEST", method: "POST", correlationId });
		expect(entry?.changedTables).toContain("regions");
		expect(entry?.changeCount).toBeGreaterThan(0);
	});

	it("groups a background job's writes into one entry, attributed to its system operation", async () => {
		const correlationId = `trail-e2e-${randomUUID()}`;
		await backgroundJob(correlationId, [`${REGION_PREFIX}job-a`, `${REGION_PREFIX}job-b`]);

		const page = await trail({ "filter[correlationId][eq]": correlationId });

		expect(page.data).toHaveLength(1);
		expect(page.data.at(LIST_SLOT_INDEX.first)).toMatchObject({
			kind: "BACKGROUND",
			correlationId,
			changeCount: 2,
			changedTables: ["regions"],
			actorKind: "SYSTEM",
			systemOperation: "geo.reference_data.write",
			operation: "INSERT",
		});
	});

	it("narrows the union: a request-only filter drops background entries, a kind filter keeps one kind", async () => {
		const correlationId = `trail-e2e-${randomUUID()}`;
		await backgroundJob(correlationId, [`${REGION_PREFIX}only-background`]);

		expect((await trail({ "filter[correlationId][eq]": correlationId, "filter[outcome][eq]": "SUCCEEDED" })).meta.total).toBe(0);
		expect((await trail({ "filter[correlationId][eq]": correlationId, "filter[kind][eq]": "REQUEST" })).meta.total).toBe(0);
		expect((await trail({ "filter[correlationId][eq]": correlationId, "filter[kind][eq]": "BACKGROUND" })).meta.total).toBe(1);
	});

	it("finds every entry that changed one row — the row's history", async () => {
		const name = `${REGION_PREFIX}${randomUUID().slice(0, 8)}`;
		const created = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/geo/regions`,
			headers: mutationHeaders({ cookie: cookie(superAdmin) }),
			payload: { name },
		});
		expect(created.statusCode, created.body).toBe(201);
		const region = await pool.query<{ id: number }>("SELECT id FROM public.regions WHERE name = $1", [name]);
		const rowId = String(region.rows.at(LIST_SLOT_INDEX.first)?.id);

		const page = await trail({ "filter[tableName][eq]": "regions", "filter[rowId][eq]": rowId });

		expect(page.data.map((entry) => entry.correlationId)).toContain(z.string().parse(created.headers["x-correlation-id"]));
	});

	it("continues the default order with a cursor, without repeating an entry", async () => {
		const first = await trail({ limit: "2" });
		expect(first.meta.nextCursor).not.toBeNull();

		const second = await trail({ limit: "2", cursor: z.string().parse(first.meta.nextCursor) });

		const firstIds = new Set(first.data.map((entry) => entry.id));
		expect(second.data.some((entry) => firstIds.has(entry.id))).toBe(false);
		expect(second.data.at(LIST_SLOT_INDEX.first)?.occurredAt ?? 0).toBeLessThanOrEqual(first.data.at(-1)?.occurredAt ?? 0);
	});

	it("records every viewing as a sensitive read under the timeline's read operation", async () => {
		const response = await app.inject({ method: "GET", url: TRAIL_URL, query: { limit: "3" }, headers: { cookie: cookie(superAdmin) } });
		const correlationId = z.string().parse(response.headers["x-correlation-id"]);

		const result = await pool.query(`SELECT response_body AS "responseBody", system_operations AS "systemOperations" FROM public.audit_logs WHERE correlation_id = $1`, [
			correlationId,
		]);

		const [row] = z.array(SensitiveReadRowSchema).parse(result.rows);
		expect(result.rows).toHaveLength(1);
		expect(row?.responseBody).toMatchObject({ auditTrailView: { returned: 3 } });
		expect(row?.systemOperations).toContain("audit.trail.read");
	});
});
