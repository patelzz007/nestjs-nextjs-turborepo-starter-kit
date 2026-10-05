import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	ORGANIZATION_MEMBER_DISPLAY_NAME_MAX_LENGTH,
	OrganizationMemberRosterListResponseSchema,
	OrganizationMembershipResponseSchema,
} from "@workspace/shared";

import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION } from "../src/modules/organization/services/organization-own-membership.service";
import { createE2eApp, type InjectResponse, login, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const MLK_PATH = `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.mlk}`;
const CASHIER_MEMBERSHIP_ID = ORGANIZATION_SEED_IDS.mlkCashierMembership;

const AuditRowsSchema = z.array(z.object({ actorUserId: z.string(), metadata: z.object({ previousDisplayName: z.string().nullable(), displayName: z.string().nullable() }) }));

/**
 * `PATCH /orgs/:orgSlug/members/me`: a member sets or clears their OWN display
 * name for one organization — validated by the shared contract, audited with
 * the member as actor, serialized under a row lock, and visible to the
 * organization's readers (team roster, organization context).
 */
describe("Own membership display name (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let cashier: LoginResult;
	let cashierUserId: string;
	let seededDisplayName: string | null;

	function headers(session: LoginResult): Record<string, string> {
		return mutationHeaders({ cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" });
	}

	function patchOwn(session: LoginResult, payload: object, basePath: string = MLK_PATH): Promise<InjectResponse> {
		return app.inject({ method: "PATCH", url: `${basePath}/members/me`, headers: headers(session), payload });
	}

	async function displayNameAudits(): Promise<z.output<typeof AuditRowsSchema>> {
		const result = await pool.query(
			`SELECT actor_user_id AS "actorUserId", metadata FROM public.organization_audit_logs WHERE action = $1 AND resource_id = $2 AND created_at >= $3 ORDER BY created_at, id`,
			[OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION, CASHIER_MEMBERSHIP_ID, startedAt],
		);
		return AuditRowsSchema.parse(result.rows);
	}

	const startedAt = Date.now();

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		const row = await pool.query<{ userId: string; displayName: string | null }>(
			`SELECT user_id AS "userId", display_name AS "displayName" FROM public.organization_memberships WHERE id = $1`,
			[CASHIER_MEMBERSHIP_ID],
		);
		cashierUserId = z.string().parse(row.rows.at(0)?.userId);
		seededDisplayName = row.rows.at(0)?.displayName ?? null;
		owner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
		cashier = await login(app, "jonker.cashier@melaka-rewards.demo", "JonkerCashier@123", "merchant");
	});

	afterAll(async () => {
		await pool.query(`UPDATE public.organization_memberships SET display_name = $2 WHERE id = $1`, [CASHIER_MEMBERSHIP_ID, seededDisplayName]);
		await pool.end();
		await app.close();
	});

	it("sets the caller's own display name (trimmed), shows it on the roster and audits it with the member as actor", async () => {
		const response = await patchOwn(cashier, { displayName: "  Mira @ Bukit Katil  " });

		expect(response.statusCode, response.body).toBe(200);
		const membership = parseSuccessEnvelope(response, OrganizationMembershipResponseSchema).data;
		expect(membership).toMatchObject({ id: CASHIER_MEMBERSHIP_ID, userId: cashierUserId, displayName: "Mira @ Bukit Katil" });

		const roster = await app.inject({ method: "GET", url: `${MLK_PATH}/members`, headers: headers(owner) });
		expect(roster.statusCode, roster.body).toBe(200);
		const member = parseSuccessEnvelope(roster, OrganizationMemberRosterListResponseSchema).data.find((row) => row.id === CASHIER_MEMBERSHIP_ID);
		expect(member?.displayName).toBe("Mira @ Bukit Katil");

		const audits = await displayNameAudits();
		expect(audits.at(-1)).toEqual({ actorUserId: cashierUserId, metadata: { previousDisplayName: seededDisplayName, displayName: "Mira @ Bukit Katil" } });
	});

	it("clears the display name with null", async () => {
		const response = await patchOwn(cashier, { displayName: null });

		expect(response.statusCode, response.body).toBe(200);
		expect(parseSuccessEnvelope(response, OrganizationMembershipResponseSchema).data.displayName).toBeNull();
		const stored = await pool.query<{ displayName: string | null }>(`SELECT display_name AS "displayName" FROM public.organization_memberships WHERE id = $1`, [
			CASHIER_MEMBERSHIP_ID,
		]);
		expect(stored.rows.at(0)?.displayName).toBeNull();
	});

	it.each([
		["a blank name", { displayName: "   " }],
		["a name over the maximum length", { displayName: "m".repeat(ORGANIZATION_MEMBER_DISPLAY_NAME_MAX_LENGTH + 1) }],
		["a missing field", {}],
		["a field a member may not set on their own membership", { displayName: "Mira", role: "OWNER" }],
	])("rejects %s with 400 and changes nothing", async (_case: string, payload: object) => {
		const before = await displayNameAudits();

		const response = await patchOwn(cashier, payload);

		expect(response.statusCode, response.body).toBe(400);
		expect(await displayNameAudits()).toHaveLength(before.length);
	});

	it("answers 404 for an organization the caller is not a member of (no existence oracle)", async () => {
		const response = await patchOwn(cashier, { displayName: "Mira" }, `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.kl}`);

		expect(response.statusCode, response.body).toBe(404);
		expect(ApiErrorResponseSchema.parse(JSON.parse(response.body)).error.code).toBe("NOT_FOUND");
	});

	it("serializes concurrent edits: each audit row records the value it actually replaced", async () => {
		const before = await displayNameAudits();
		const initial = await pool.query<{ displayName: string | null }>(`SELECT display_name AS "displayName" FROM public.organization_memberships WHERE id = $1`, [
			CASHIER_MEMBERSHIP_ID,
		]);
		const initialDisplayName: string | null = initial.rows.at(0)?.displayName ?? null;

		const responses = await Promise.all([patchOwn(cashier, { displayName: "Mira (morning shift)" }), patchOwn(cashier, { displayName: "Mira (evening shift)" })]);

		expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
		// Both writes can land in the same millisecond, so created_at cannot order them; the audit
		// metadata can: the write that ran first replaced the initial value, the other replaced it.
		const edits = (await displayNameAudits()).slice(before.length);
		expect(edits).toHaveLength(2);
		const first = edits.find((edit) => edit.metadata.previousDisplayName === initialDisplayName);
		const second = edits.find((edit) => edit !== first);
		expect(first, "one edit must have replaced the initial value").toBeDefined();
		expect(second?.metadata.previousDisplayName).toBe(first?.metadata.displayName);
		const stored = await pool.query<{ displayName: string | null }>(`SELECT display_name AS "displayName" FROM public.organization_memberships WHERE id = $1`, [
			CASHIER_MEMBERSHIP_ID,
		]);
		expect(stored.rows.at(0)?.displayName).toBe(second?.metadata.displayName);
	});
});
