import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, LocationCloseResponseSchema, TenantMemberLocationRemoveResponseSchema } from "@workspace/shared";

import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const ORG_PATH = `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.mlk}`;
const ORG_ID = TENANT_SEED_IDS.mlkTenant;
const BERUANG = TENANT_SEED_IDS.mlkLocationBeruang;
const KATIL = TENANT_SEED_IDS.mlkLocationKatil;
const CLOSURE_REASON = "E2E: franchise partner went bankrupt";

/**
 * Removing a member from a store and closing a store: soft deletes, revoked
 * access (with the location role the member's scope carried) and an audit row
 * per action, authorised server-side. Works on a location this file creates
 * (and deletes) so the seeded locations stay untouched.
 */
describe("Location member removal and location closure (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let cashier: LoginResult;
	let cashierMembershipId: string;
	const locationId = randomUUID();
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
		const [cashierRow] = await query(`SELECT m.id FROM public."Membership" m WHERE m."tenantId" = $1 AND m.role = 'CASHIER' AND m."isDeleted" = false`, [ORG_ID]);
		cashierMembershipId = String(cashierRow?.id);
		const [ownerRow] = await query(`SELECT "userId" FROM public."Membership" WHERE "tenantId" = $1 AND role = 'OWNER' AND "isDeleted" = false`, [ORG_ID]);
		const [staffRole] = await query(`SELECT id FROM public."Role" WHERE name = 'Location Staff'`);

		await query(
			`INSERT INTO public."Location" (id, "tenantId", name, code, "addressText", status, "isPrimary") VALUES ($1, $2, 'E2E closure store', $3, '1 Jalan E2E', 'ACTIVE', false)`,
			[locationId, ORG_ID, `e2e-${locationId.slice(0, 8)}`],
		);
		await query(`INSERT INTO public."MembershipLocationScope" (id, "tenantId", "membershipId", "scopeType", "locationId", "roleId") VALUES ($1, $2, $3, 'SELECTED', $4, $5)`, [
			randomUUID(),
			ORG_ID,
			cashierMembershipId,
			locationId,
			String(staffRole?.id),
		]);
		await query(
			`INSERT INTO public."TenantApiKey" (id, "tenantId", "locationId", name, "keyHash", "keyPrefix", scope, "createdByUserId") VALUES ($1, $2, $3, 'E2E closure key', $4, 'e2eclose', 'POS', $5)`,
			[apiKeyId, ORG_ID, locationId, `hash-${apiKeyId}`, String(ownerRow?.userId)],
		);
		await query(`INSERT INTO public."TenantTerminal" (id, "tenantId", "locationId", "terminalId", "createdByUserId", "apiKeyId") VALUES ($1, $2, $3, $4, $5, $6)`, [
			terminalRowId,
			ORG_ID,
			locationId,
			`E2E-CLOSE-${terminalRowId.slice(0, 6)}`,
			String(ownerRow?.userId),
			apiKeyId,
		]);

		owner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
		cashier = await login(app, "jonker.cashier@melaka-rewards.demo", "JonkerCashier@123", "merchant");
	});

	afterAll(async () => {
		await query(`DELETE FROM public."TenantTerminal" WHERE id = $1`, [terminalRowId]);
		await query(`DELETE FROM public."TenantApiKey" WHERE id = $1`, [apiKeyId]);
		await query(`DELETE FROM public."MembershipLocationScope" WHERE "locationId" = $1`, [locationId]);
		await query(`DELETE FROM public."Location" WHERE id = $1`, [locationId]);
		await pool.end();
		await app.close();
	});

	it("refuses a cashier (no manage_team / manage_locations) with 403", async () => {
		expect((await post(cashier, `/members/${cashierMembershipId}/locations/${locationId}/remove`, {})).statusCode).toBe(403);
		expect((await post(cashier, `/locations/${locationId}/close`, { reason: CLOSURE_REASON })).statusCode).toBe(403);
	});

	it("refuses to close the primary store (409) and a missing reason (400)", async () => {
		const primary = await post(owner, `/locations/${KATIL}/close`, { reason: CLOSURE_REASON });
		expect(primary.statusCode, primary.body).toBe(409);
		expect((await post(owner, `/locations/${locationId}/close`, {})).statusCode).toBe(400);
	});

	it("removes the cashier from one store: the scope row (and its location role) soft-deleted by the owner, audited", async () => {
		const response = await post(owner, `/members/${cashierMembershipId}/locations/${locationId}/remove`, {});

		expect(response.statusCode, response.body).toBe(201);
		const data = parseSuccessEnvelope(response, TenantMemberLocationRemoveResponseSchema).data;
		expect(data.remainingLocationIds).toEqual([BERUANG]);
		const scopes = await query(
			`SELECT "isDeleted", "deletedAt", "deletedBy", "roleId" FROM public."MembershipLocationScope" WHERE "membershipId" = $1 AND "locationId" = $2`,
			[cashierMembershipId, locationId],
		);
		const [scope] = scopes;
		expect(scopes).toHaveLength(1);
		expect(scope).toMatchObject({ isDeleted: true });
		expect(scope?.deletedAt).not.toBeNull();
		expect(scope?.deletedBy).not.toBeNull();
		// The role stays on the soft-deleted row as history; the grants loader reads live rows only.
		expect(scope?.roleId).not.toBeNull();
		const audit = await query(`SELECT 1 FROM public."TenantAuditLog" WHERE action = 'membership.removed_from_location' AND "resourceId" = $1`, [cashierMembershipId]);
		expect(audit.length).toBeGreaterThan(0);
	});

	it("refuses to leave the cashier without any store unless allowNoLocations is set", async () => {
		const refused = await post(owner, `/members/${cashierMembershipId}/locations/${BERUANG}/remove`, {});
		expect(refused.statusCode, refused.body).toBe(409);
		const scopes = await query(`SELECT 1 FROM public."MembershipLocationScope" WHERE "membershipId" = $1 AND "locationId" = $2 AND "isDeleted" = false`, [
			cashierMembershipId,
			BERUANG,
		]);
		expect(scopes).toHaveLength(1);
	});

	it("closes the store: soft-deleted with the reason, terminals removed, keys revoked, audited", async () => {
		const response = await post(owner, `/locations/${locationId}/close`, { reason: CLOSURE_REASON });

		expect(response.statusCode, response.body).toBe(201);
		const data = parseSuccessEnvelope(response, LocationCloseResponseSchema).data;
		expect(data).toMatchObject({ locationId, memberScopesRemoved: 0, terminalsRemoved: 1, apiKeysRevoked: 1 });
		const [location] = await query(`SELECT status, "isDeleted", "closureReason", "deletedBy" FROM public."Location" WHERE id = $1`, [locationId]);
		expect(location).toMatchObject({ status: "INACTIVE", isDeleted: true, closureReason: CLOSURE_REASON });
		expect(location?.deletedBy).not.toBeNull();
		const [terminal] = await query(`SELECT "isDeleted" FROM public."TenantTerminal" WHERE id = $1`, [terminalRowId]);
		expect(terminal).toMatchObject({ isDeleted: true });
		const [key] = await query(`SELECT "revokedAt" FROM public."TenantApiKey" WHERE id = $1`, [apiKeyId]);
		expect(key?.revokedAt).not.toBeNull();
		const audit = await query(`SELECT 1 FROM public."TenantAuditLog" WHERE action = 'tenant.location.closed' AND "resourceId" = $1`, [locationId]);
		expect(audit).toHaveLength(1);
		const liveScopes = await query(`SELECT 1 FROM public."MembershipLocationScope" WHERE "locationId" = $1 AND "isDeleted" = false`, [locationId]);
		expect(liveScopes).toHaveLength(0);
	});

	it("answers 404 when the store is already closed, and 404 when removing a member from it", async () => {
		expect((await post(owner, `/locations/${locationId}/close`, { reason: CLOSURE_REASON })).statusCode).toBe(404);
		expect((await post(owner, `/members/${cashierMembershipId}/locations/${locationId}/remove`, {})).statusCode).toBe(404);
	});
});
