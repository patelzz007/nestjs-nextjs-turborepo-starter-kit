import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, OrganizationLocationResponseSchema } from "@workspace/shared";

import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const ORG_PATH = `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.kl}`;
const ORG_ID = ORGANIZATION_SEED_IDS.klOrganization;

type Row = Record<string, string | number | boolean | null>;

/**
 * A merchant OWNER requesting a new store and resubmitting a rejected one.
 * Both run in the owner's TENANT transaction (not a system operation), and the
 * location write mirrors onto its 1:1 `stores` row in the same transaction —
 * so the `stores` RLS policy must accept that mirror write for a member of the
 * session's tenant, and only for a store that mirrors one of that tenant's
 * locations.
 */
describe("Merchant store requests mirror onto stores under tenant RLS (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	const createdLocationIds: string[] = [];
	const rejectedLocationId = randomUUID();
	const rejectedStoreId = randomUUID();
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
			`INSERT INTO public.organization_locations (id, organization_id, name, code, address_text, status, is_primary, rejection_reason)
       VALUES ($1, $2, 'E2E rejected store', $3, '1 Jalan Ditolak, Kuala Lumpur', 'REJECTED', false, 'E2E: address could not be verified')`,
			[rejectedLocationId, ORG_ID, rejectedCode],
		);
		await query(`INSERT INTO public.stores (id, organization_id, location_id, name, code, status) VALUES ($1, $2, $3, 'E2E rejected store', $4, 'INACTIVE')`, [
			rejectedStoreId,
			ORG_ID,
			rejectedLocationId,
			rejectedCode,
		]);
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
	});

	afterAll(async () => {
		const locationIds = [...createdLocationIds, rejectedLocationId];
		await query(`DELETE FROM public.stores WHERE location_id = ANY($1::text[])`, [`{${locationIds.join(",")}}`]);
		await query(`DELETE FROM public.organization_locations WHERE id = ANY($1::text[])`, [`{${locationIds.join(",")}}`]);
		await pool.end();
		await app.close();
	});

	it("creates a PENDING_APPROVAL location and its INACTIVE store mirror in one transaction", async () => {
		const response = await send("POST", "/locations", { name: "E2E Bangsar outlet", addressText: "8 Jalan Telawi, Bangsar, Kuala Lumpur" });

		expect(response.statusCode, response.body).toBe(201);
		const location = parseSuccessEnvelope(response, OrganizationLocationResponseSchema).data;
		createdLocationIds.push(location.id);
		expect(location.status).toBe("PENDING_APPROVAL");
		const stores = await query(`SELECT organization_id, name, code, status, is_deleted FROM public.stores WHERE location_id = $1`, [location.id]);
		expect(stores).toEqual([{ organization_id: ORG_ID, name: "E2E Bangsar outlet", code: location.code, status: "INACTIVE", is_deleted: false }]);
	});

	it("resubmits a REJECTED location and mirrors the corrected name onto its store", async () => {
		const response = await send("PATCH", `/locations/${rejectedLocationId}`, { name: "E2E corrected store", addressText: "2 Jalan Betul, Kuala Lumpur" });

		expect(response.statusCode, response.body).toBe(200);
		expect(parseSuccessEnvelope(response, OrganizationLocationResponseSchema).data.status).toBe("PENDING_APPROVAL");
		const [store] = await query(`SELECT name, status FROM public.stores WHERE id = $1`, [rejectedStoreId]);
		expect(store).toEqual({ name: "E2E corrected store", status: "INACTIVE" });
	});

	it("still refuses a tenant session writing a store that does not mirror one of its own locations", async () => {
		const [ownerRow] = await query(`SELECT user_id FROM public.organization_memberships WHERE organization_id = $1 AND role = 'OWNER' AND is_deleted = false`, [ORG_ID]);
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SELECT set_config('role', 'app_runtime', true)");
			await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(ownerRow?.user_id)]);
			await client.query("SELECT set_config('app.current_organization_id', $1, true)", [ORG_ID]);
			const orphanCode = `e2e-orphan-${randomUUID().slice(0, 8)}`;

			await expect(
				client.query(`INSERT INTO public.stores (id, organization_id, location_id, name, code, status) VALUES ($1, $2, $3, 'E2E orphan store', $4, 'ACTIVE')`, [
					randomUUID(),
					ORG_ID,
					ORGANIZATION_SEED_IDS.mlkLocationKatil,
					orphanCode,
				]),
			).rejects.toThrow(/row-level security/);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	});
});
