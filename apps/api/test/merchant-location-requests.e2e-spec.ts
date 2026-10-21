import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, LocationResponseSchema } from "@workspace/shared";

import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const ORG_PATH = `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}`;
const ORG_ID = TENANT_SEED_IDS.klTenant;

type Row = Record<string, string | number | boolean | null>;

/**
 * A merchant OWNER requesting a new store and resubmitting a rejected one.
 * Both run in the owner's TENANT transaction (not a system operation), so the
 * `Location` RLS policy must accept the write for a member of the session's
 * tenant, and only for that tenant.
 */
describe("Merchant store requests under tenant RLS (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	const createdLocationIds: string[] = [];
	const rejectedLocationId = randomUUID();
	const rejectedCode = `e2e-rej-${rejectedLocationId.slice(0, 8)}`;

	/** Fixture setup / assertions as the migrating (owner) connection, like the other store suites. */
	async function query(sql: string, values: readonly (string | number | boolean | null)[] = []): Promise<readonly Row[]> {
		return (await pool.query<Row>(sql, [...values])).rows;
	}

	function headers(): Record<string, string> {
		return mutationHeaders({ cookie: `merchantAccessToken=${owner.accessToken}; merchantRefreshToken=${owner.refreshToken}`, "x-client-type": "merchant" });
	}

	function send(method: "POST" | "PATCH", path: string, payload: object): Promise<InjectResponse> {
		return app.inject({ method, url: `${ORG_PATH}${path}`, headers: headers(), payload });
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		await query(
			`INSERT INTO public."Location" (id, "tenantId", name, code, "addressText", status, "isPrimary", "rejectionReason")
       VALUES ($1, $2, 'E2E rejected store', $3, '1 Jalan Ditolak, Kuala Lumpur', 'REJECTED', false, 'E2E: address could not be verified')`,
			[rejectedLocationId, ORG_ID, rejectedCode],
		);
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
	});

	afterAll(async () => {
		const locationIds = [...createdLocationIds, rejectedLocationId];
		await query(`DELETE FROM public."Location" WHERE id = ANY($1::text[])`, [`{${locationIds.join(",")}}`]);
		await pool.end();
		await app.close();
	});

	it("creates a PENDING_APPROVAL location in the owner's tenant transaction", async () => {
		const response = await send("POST", "/locations", { name: "E2E Bangsar outlet", addressText: "8 Jalan Telawi, Bangsar, Kuala Lumpur" });

		expect(response.statusCode, response.body).toBe(201);
		const location = parseSuccessEnvelope(response, LocationResponseSchema).data;
		createdLocationIds.push(location.id);
		expect(location.status).toBe("PENDING_APPROVAL");
		const rows = await query(`SELECT "tenantId", name, code, status, "isDeleted" FROM public."Location" WHERE id = $1`, [location.id]);
		expect(rows).toEqual([{ tenantId: ORG_ID, name: "E2E Bangsar outlet", code: location.code, status: "PENDING_APPROVAL", isDeleted: false }]);
	});

	it("resubmits a REJECTED location with the corrected name", async () => {
		const response = await send("PATCH", `/locations/${rejectedLocationId}`, { name: "E2E corrected store", addressText: "2 Jalan Betul, Kuala Lumpur" });

		expect(response.statusCode, response.body).toBe(200);
		expect(parseSuccessEnvelope(response, LocationResponseSchema).data.status).toBe("PENDING_APPROVAL");
		const [row] = await query(`SELECT name, status, "rejectionReason" FROM public."Location" WHERE id = $1`, [rejectedLocationId]);
		expect(row).toMatchObject({ name: "E2E corrected store", status: "PENDING_APPROVAL" });
	});

	it("refuses a tenant session writing a location of another tenant", async () => {
		const [ownerRow] = await query(`SELECT "userId" FROM public."Membership" WHERE "tenantId" = $1 AND role = 'OWNER' AND "isDeleted" = false`, [ORG_ID]);
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SELECT set_config('role', 'app_runtime', true)");
			await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(ownerRow?.userId)]);
			await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [ORG_ID]);
			const orphanCode = `e2e-orphan-${randomUUID().slice(0, 8)}`;

			await expect(
				client.query(
					`INSERT INTO public."Location" (id, "tenantId", name, code, "addressText", status, "isPrimary") VALUES ($1, $2, 'E2E foreign store', $3, '1 Jalan Asing', 'PENDING_APPROVAL', false)`,
					[randomUUID(), TENANT_SEED_IDS.mlkTenant, orphanCode],
				),
			).rejects.toThrow(/row-level security/);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	});
});
