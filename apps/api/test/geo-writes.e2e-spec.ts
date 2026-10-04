import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, GeoImportResultSchema, RegionSchema, SubregionSchema } from "@workspace/shared";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * Geo reference-data writes against the real AppModule, database and RLS:
 * SuperAdmin-only, executed under the `geo.reference_data.write` system
 * operation, soft-deleted (with cascade) instead of hard-deleted, audited in
 * the same transaction, and conflict-safe bulk import.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const GEO_URL = `${API_VERSION_PREFIX}/geo`;
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

describe("Geo writes (e2e, real Postgres + RLS)", () => {
	const prefix = `geo-e2e-${randomUUID().slice(0, 8)}`;
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let admin: LoginResult;
	let superAdminId: string;

	function cookie(session: LoginResult): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	async function send(session: LoginResult, method: "POST" | "PATCH" | "DELETE" | "GET", path: string, payload?: object): Promise<InjectResponse> {
		return app.inject({ method, url: `${GEO_URL}${path}`, headers: mutationHeaders({ cookie: cookie(session) }), ...(payload === undefined ? {} : { payload }) });
	}

	async function withRuntimeSession(settings: Readonly<Record<string, string>>, run: (client: PoolClient) => Promise<void>): Promise<void> {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SET LOCAL ROLE app_runtime");
			for (const [name, value] of Object.entries(settings)) {
				await client.query("SELECT set_config($1, $2, true)", [name, value]);
			}
			await run(client);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
		admin = await login(app, "admin@example.com", "Admin@123");
		const row = await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = 'superadmin@example.com'");
		const id = row.rows.at(0)?.id;
		if (id === undefined) throw new Error("Seed data missing: superadmin@example.com — run pnpm db:seed");
		superAdminId = id;
	});

	afterAll(async () => {
		// Test-only cleanup on the superuser connection (the app itself can never hard-delete geo rows).
		await pool.query("DELETE FROM public.subregions WHERE name LIKE $1", [`${prefix}%`]);
		await pool.query("DELETE FROM public.regions WHERE name LIKE $1", [`${prefix}%`]);
		await pool.end();
		await app.close();
	});

	it("lets a SuperAdmin create and update a region, auditing each write in the same transaction", async () => {
		const created = await send(superAdmin, "POST", "/regions", { name: `${prefix}-region <b>x</b>` });
		expect(created.statusCode, created.body).toBe(HTTP_CREATED);
		const region = parseSuccessEnvelope(created, RegionSchema).data;
		expect(region.name).toBe(`${prefix}-region x`);

		const updated = await send(superAdmin, "PATCH", `/regions/${String(region.id)}`, { name: `${prefix}-region-renamed` });
		expect(updated.statusCode, updated.body).toBe(HTTP_OK);
		expect(parseSuccessEnvelope(updated, RegionSchema).data.name).toBe(`${prefix}-region-renamed`);

		const audit = await pool.query<{ method: string; outcome: string; actor: string; ops: string[] }>(
			`SELECT method, outcome::text AS outcome, actor_user_id AS actor, system_operations AS ops
			 FROM public.audit_logs WHERE correlation_id = ANY($1::text[]) ORDER BY occurred_at`,
			[[created.headers["x-correlation-id"], updated.headers["x-correlation-id"]]],
		);
		expect(audit.rows).toHaveLength(2);
		for (const row of audit.rows) {
			expect(row).toMatchObject({ outcome: "SUCCEEDED", actor: superAdminId });
			expect(row.ops).toContain("geo.reference_data.write");
		}
	});

	it("soft-deletes a region and cascades the soft delete to its subregions (never a hard delete)", async () => {
		const region = parseSuccessEnvelope(await send(superAdmin, "POST", "/regions", { name: `${prefix}-cascade` }), RegionSchema).data;
		const subregionResponse = await send(superAdmin, "POST", "/subregions", { name: `${prefix}-cascade-child`, regionId: region.id });
		expect(subregionResponse.statusCode, subregionResponse.body).toBe(HTTP_CREATED);
		const subregion = parseSuccessEnvelope(subregionResponse, SubregionSchema).data;

		const deleted = await send(superAdmin, "DELETE", `/regions/${String(region.id)}`);
		expect(deleted.statusCode, deleted.body).toBe(HTTP_OK);

		expect((await send(superAdmin, "GET", `/regions/${String(region.id)}`)).statusCode).toBe(HTTP_NOT_FOUND);
		expect((await send(superAdmin, "GET", `/subregions/${String(subregion.id)}`)).statusCode).toBe(HTTP_NOT_FOUND);
		const rows = await pool.query<{ isDeleted: boolean; deletedBy: string | null }>(
			`SELECT is_deleted AS "isDeleted", deleted_by AS "deletedBy" FROM public.regions WHERE id = $1
			 UNION ALL SELECT is_deleted, deleted_by FROM public.subregions WHERE id = $2`,
			[region.id, subregion.id],
		);
		expect(rows.rows).toEqual([
			{ isDeleted: true, deletedBy: superAdminId },
			{ isDeleted: true, deletedBy: superAdminId },
		]);

		const again = await send(superAdmin, "DELETE", `/regions/${String(region.id)}`);
		expect(again.statusCode).toBe(HTTP_NOT_FOUND);
	});

	it("refuses a child that references a soft-deleted parent", async () => {
		const region = parseSuccessEnvelope(await send(superAdmin, "POST", "/regions", { name: `${prefix}-gone-parent` }), RegionSchema).data;
		await send(superAdmin, "DELETE", `/regions/${String(region.id)}`);

		const response = await send(superAdmin, "POST", "/subregions", { name: `${prefix}-orphan`, regionId: region.id });

		expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("VALIDATION_ERROR");
	});

	it("forbids geo writes for a non-SuperAdmin admin, even with GEO permissions", async () => {
		const response = await send(admin, "POST", "/regions", { name: `${prefix}-admin` });

		expect(response.statusCode).toBe(HTTP_FORBIDDEN);
		const count = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM public.regions WHERE name = $1", [`${prefix}-admin`]);
		expect(count.rows.at(0)?.count).toBe("0");
	});

	it("imports with upsert without duplicating rows, even when two imports race", async () => {
		const name = `${prefix}-imported`;
		const body = { entity: "region", upsert: true, data: [{ name }, { name }, { name: "" }] };

		const [first, second] = await Promise.all([send(superAdmin, "POST", "/import", body), send(superAdmin, "POST", "/import", body)]);

		expect(first.statusCode, first.body).toBe(HTTP_CREATED);
		expect(second.statusCode, second.body).toBe(HTTP_CREATED);
		const results = [parseSuccessEnvelope(first, GeoImportResultSchema).data, parseSuccessEnvelope(second, GeoImportResultSchema).data];
		expect(results.map((result) => result.created).sort()).toEqual([0, 1]);
		for (const result of results) {
			expect(result.skipped).toBe(1);
			expect(result.errors.map((error) => error.row)).toEqual([3]);
		}
		const count = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM public.regions WHERE name = $1 AND is_deleted = false", [name]);
		expect(count.rows.at(0)?.count).toBe("1");
	});

	describe("database enforcement (RLS + grants)", () => {
		it("rejects a geo write under any other bypass, even platform.superadmin", async () => {
			await withRuntimeSession({ "app.rls_bypass": "true", "app.system_operation": "platform.superadmin" }, async (client) => {
				await expect(client.query("INSERT INTO public.regions (name) VALUES ($1)", [`${prefix}-rls`])).rejects.toThrow(/row-level security/);
			});
		});

		it("accepts a geo write only under geo.reference_data.write", async () => {
			await withRuntimeSession({ "app.rls_bypass": "true", "app.system_operation": "geo.reference_data.write" }, async (client) => {
				const inserted = await client.query("INSERT INTO public.regions (name) VALUES ($1)", [`${prefix}-rls-ok`]);
				expect(inserted.rowCount).toBe(1);
			});
		});

		it("never lets the application role hard-delete geo rows", async () => {
			await withRuntimeSession({ "app.rls_bypass": "true", "app.system_operation": "geo.reference_data.write" }, async (client) => {
				await expect(client.query("DELETE FROM public.regions WHERE name = $1", [`${prefix}-none`])).rejects.toThrow(/permission denied/);
			});
		});
	});
});
