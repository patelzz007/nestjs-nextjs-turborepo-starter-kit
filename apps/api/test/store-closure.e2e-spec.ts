import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, OrganizationLocationCloseResponseSchema, OrganizationMemberStoreRemoveResponseSchema } from "@workspace/shared";

import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const ORG_PATH = `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.mlk}`;
const ORG_ID = ORGANIZATION_SEED_IDS.mlkOrganization;
const BERUANG = ORGANIZATION_SEED_IDS.mlkLocationBeruang;
const KATIL = ORGANIZATION_SEED_IDS.mlkLocationKatil;
const CLOSURE_REASON = "E2E: franchise partner went bankrupt";

/**
 * Removing a member from a store and closing a store: soft deletes, revoked
 * access and an audit row per action, authorised server-side. Works on a
 * store this file creates (and deletes) so the seeded stores stay untouched.
 */
describe("Store member removal and store closure (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let cashier: LoginResult;
	let cashierUserId: string;
	let cashierMembershipId: string;
	const locationId = randomUUID();
	const storeId = randomUUID();
	const terminalRowId = randomUUID();
	const apiKeyId = randomUUID();

	async function query(sql: string, values: readonly (string | number | boolean | null)[] = []): Promise<readonly Record<string, string | number | null>[]> {
		const client = await pool.connect();
		try {
			await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
			return (await client.query<Record<string, string | number | null>>(sql, [...values])).rows;
		} finally {
			client.release();
		}
	}

	function headers(session: LoginResult): Record<string, string> {
		return mutationHeaders({ cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" });
	}

	function post(session: LoginResult, path: string, payload: object): Promise<InjectResponse> {
		return app.inject({ method: "POST", url: `${ORG_PATH}${path}`, headers: headers(session), payload });
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		const [cashierRow] = await query(
			`SELECT m.id, m.user_id FROM public.organization_memberships m WHERE m.organization_id = $1 AND m.role = 'CASHIER' AND m.is_deleted = false`,
			[ORG_ID],
		);
		cashierMembershipId = String(cashierRow?.id);
		cashierUserId = String(cashierRow?.user_id);
		const [ownerRow] = await query(`SELECT user_id FROM public.organization_memberships WHERE organization_id = $1 AND role = 'OWNER' AND is_deleted = false`, [ORG_ID]);
		const [staffRole] = await query(`SELECT id FROM public.roles WHERE name = 'Store Staff'`);

		await query(
			`INSERT INTO public.organization_locations (id, organization_id, name, code, address_text, status, is_primary) VALUES ($1, $2, 'E2E closure store', $3, '1 Jalan E2E', 'ACTIVE', false)`,
			[locationId, ORG_ID, `e2e-${locationId.slice(0, 8)}`],
		);
		await query(`INSERT INTO public.stores (id, organization_id, location_id, name, code, status) VALUES ($1, $2, $3, 'E2E closure store', $4, 'ACTIVE')`, [
			storeId,
			ORG_ID,
			locationId,
			`e2e-${locationId.slice(0, 8)}`,
		]);
		await query(
			`INSERT INTO public.organization_membership_location_scopes (id, organization_id, membership_id, scope_type, location_id) VALUES ($1, $2, $3, 'SELECTED', $4)`,
			[randomUUID(), ORG_ID, cashierMembershipId, locationId],
		);
		await query(`INSERT INTO public.store_memberships (id, organization_id, store_id, user_id, role_id, status) VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`, [
			randomUUID(),
			ORG_ID,
			storeId,
			cashierUserId,
			String(staffRole?.id),
		]);
		await query(
			`INSERT INTO public.organization_api_keys (id, organization_id, location_id, name, key_hash, key_prefix, scope, created_by_user_id) VALUES ($1, $2, $3, 'E2E closure key', $4, 'e2eclose', 'POS', $5)`,
			[apiKeyId, ORG_ID, locationId, `hash-${apiKeyId}`, String(ownerRow?.user_id)],
		);
		await query(`INSERT INTO public.organization_terminals (id, organization_id, location_id, terminal_id, created_by_user_id, api_key_id) VALUES ($1, $2, $3, $4, $5, $6)`, [
			terminalRowId,
			ORG_ID,
			locationId,
			`E2E-CLOSE-${terminalRowId.slice(0, 6)}`,
			String(ownerRow?.user_id),
			apiKeyId,
		]);

		owner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
		cashier = await login(app, "jonker.cashier@melaka-rewards.demo", "JonkerCashier@123", "merchant");
	});

	afterAll(async () => {
		await query(`DELETE FROM public.organization_terminals WHERE id = $1`, [terminalRowId]);
		await query(`DELETE FROM public.organization_api_keys WHERE id = $1`, [apiKeyId]);
		await query(`DELETE FROM public.organization_membership_location_scopes WHERE location_id = $1`, [locationId]);
		await query(`DELETE FROM public.store_memberships WHERE store_id = $1`, [storeId]);
		await query(`DELETE FROM public.stores WHERE id = $1`, [storeId]);
		await query(`DELETE FROM public.organization_locations WHERE id = $1`, [locationId]);
		await pool.end();
		await app.close();
	});

	it("refuses a cashier (no manage_team / manage_locations) with 403", async () => {
		expect((await post(cashier, `/members/${cashierMembershipId}/stores/${locationId}/remove`, {})).statusCode).toBe(403);
		expect((await post(cashier, `/locations/${locationId}/close`, { reason: CLOSURE_REASON })).statusCode).toBe(403);
	});

	it("refuses to close the primary store (409) and a missing reason (400)", async () => {
		const primary = await post(owner, `/locations/${KATIL}/close`, { reason: CLOSURE_REASON });
		expect(primary.statusCode, primary.body).toBe(409);
		expect((await post(owner, `/locations/${locationId}/close`, {})).statusCode).toBe(400);
	});

	it("removes the cashier from one store: scope row gone, store membership soft-deleted by the owner, audited", async () => {
		const response = await post(owner, `/members/${cashierMembershipId}/stores/${locationId}/remove`, {});

		expect(response.statusCode, response.body).toBe(201);
		const data = parseSuccessEnvelope(response, OrganizationMemberStoreRemoveResponseSchema).data;
		expect(data.remainingLocationIds).toEqual([BERUANG]);
		const scopes = await query(`SELECT 1 FROM public.organization_membership_location_scopes WHERE membership_id = $1 AND location_id = $2`, [
			cashierMembershipId,
			locationId,
		]);
		expect(scopes).toHaveLength(0);
		const [storeMembership] = await query(`SELECT is_deleted, deleted_at, deleted_by FROM public.store_memberships WHERE store_id = $1 AND user_id = $2`, [
			storeId,
			cashierUserId,
		]);
		expect(storeMembership).toMatchObject({ is_deleted: true });
		expect(storeMembership?.deleted_by).not.toBeNull();
		const audit = await query(`SELECT 1 FROM public.organization_audit_logs WHERE action = 'membership.removed_from_store' AND resource_id = $1`, [cashierMembershipId]);
		expect(audit.length).toBeGreaterThan(0);
	});

	it("refuses to leave the cashier without any store unless allowNoStores is set", async () => {
		const refused = await post(owner, `/members/${cashierMembershipId}/stores/${BERUANG}/remove`, {});
		expect(refused.statusCode, refused.body).toBe(409);
		const scopes = await query(`SELECT 1 FROM public.organization_membership_location_scopes WHERE membership_id = $1 AND location_id = $2`, [cashierMembershipId, BERUANG]);
		expect(scopes).toHaveLength(1);
	});

	it("closes the store: soft-deleted with the reason, terminals removed, keys revoked, audited", async () => {
		const response = await post(owner, `/locations/${locationId}/close`, { reason: CLOSURE_REASON });

		expect(response.statusCode, response.body).toBe(201);
		const data = parseSuccessEnvelope(response, OrganizationLocationCloseResponseSchema).data;
		expect(data).toMatchObject({ locationId, storeId, terminalsRemoved: 1, apiKeysRevoked: 1 });
		const [location] = await query(`SELECT status, is_deleted, closure_reason, deleted_by FROM public.organization_locations WHERE id = $1`, [locationId]);
		expect(location).toMatchObject({ status: "INACTIVE", is_deleted: true, closure_reason: CLOSURE_REASON });
		expect(location?.deleted_by).not.toBeNull();
		const [store] = await query(`SELECT status, is_deleted FROM public.stores WHERE id = $1`, [storeId]);
		expect(store).toMatchObject({ status: "INACTIVE", is_deleted: true });
		const [terminal] = await query(`SELECT is_deleted FROM public.organization_terminals WHERE id = $1`, [terminalRowId]);
		expect(terminal).toMatchObject({ is_deleted: true });
		const [key] = await query(`SELECT revoked_at FROM public.organization_api_keys WHERE id = $1`, [apiKeyId]);
		expect(key?.revoked_at).not.toBeNull();
		const audit = await query(`SELECT 1 FROM public.organization_audit_logs WHERE action = 'organization.location.closed' AND resource_id = $1`, [locationId]);
		expect(audit).toHaveLength(1);
	});

	it("answers 404 when the store is already closed, and 404 when removing a member from it", async () => {
		expect((await post(owner, `/locations/${locationId}/close`, { reason: CLOSURE_REASON })).statusCode).toBe(404);
		expect((await post(owner, `/members/${cashierMembershipId}/stores/${locationId}/remove`, {})).statusCode).toBe(404);
	});
});
