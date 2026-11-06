import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX } from "@workspace/shared";

import { SEED_TEAM_INVITE_TOKEN_KL_ALICE, TENANT_SEED_IDS } from "../prisma/seed/tenants";
import { createE2eApp, login, mutationHeaders } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const ORG_ID = TENANT_SEED_IDS.klTenant;
/** The seeded invitee: an existing account with a pending Brew & Bean KL cashier invitation and no live membership. */
const INVITEE_EMAIL = "alice.kl@kl-rewards.demo";
const INVITEE_PASSWORD = "AliceKl@123";

type Row = Record<string, string | number | boolean | null>;

/**
 * Accepting a team invitation as an EXISTING account (`POST /tenants/invites/accept`). The new membership
 * takes the tenant's own copy of the invited role (ADR 067), read inside the `tenant.membership.accept`
 * system operation — so that operation must reach `Role`, or the accepter (not a member yet) cannot see
 * the tenant's roles and every acceptance fails with `TenantRoleMissingError` (500).
 */
describe("Team invite acceptance by an existing account (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let inviteeId: string;
	let invitation: Row;

	async function query(sql: string, values: readonly (string | number | boolean | null)[] = []): Promise<readonly Row[]> {
		return (await pool.query<Row>(sql, [...values])).rows;
	}

	/** Puts the seeded invitation back and removes the membership this spec created, so other specs see the seed. */
	async function restoreSeed(): Promise<void> {
		await query(
			`DELETE FROM public."MembershipLocationScope" WHERE "membershipId" IN (
         SELECT id FROM public."Membership" WHERE "tenantId" = $1 AND "userId" = $2 AND "isDeleted" = false AND status = 'ACTIVE')`,
			[ORG_ID, inviteeId],
		);
		await query(`DELETE FROM public."Membership" WHERE "tenantId" = $1 AND "userId" = $2 AND "isDeleted" = false AND status = 'ACTIVE'`, [ORG_ID, inviteeId]);
		await query(`UPDATE public."TenantInvitation" SET status = 'PENDING', "acceptedByUserId" = NULL, "acceptedAt" = NULL WHERE id = $1`, [String(invitation.id)]);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		const [user] = await query(`SELECT id FROM public."User" WHERE email = $1`, [INVITEE_EMAIL]);
		const [row] = await query(`SELECT id, status FROM public."TenantInvitation" WHERE "tenantId" = $1 AND email = $2 AND kind = 'TEAM_MEMBER'`, [ORG_ID, INVITEE_EMAIL]);
		if (user === undefined || row === undefined) {
			throw new Error("Seeded invitee or invitation is missing — run pnpm db:seed");
		}
		inviteeId = String(user.id);
		invitation = row;
	});

	afterAll(async () => {
		await restoreSeed();
		await pool.end();
		await app.close();
	});

	it("creates an ACTIVE membership holding the tenant's own Cashier role, and claims the invitation", async () => {
		const invitee = await login(app, INVITEE_EMAIL, INVITEE_PASSWORD, "merchant");

		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/tenants/invites/accept`,
			headers: mutationHeaders({ cookie: `merchantAccessToken=${invitee.accessToken}; merchantRefreshToken=${invitee.refreshToken}`, "x-client-type": "merchant" }),
			payload: { token: SEED_TEAM_INVITE_TOKEN_KL_ALICE },
		});

		expect(response.statusCode, response.body).toBe(201);
		const [membership] = await query(
			`SELECT m.status, r."tenantId" AS "roleTenantId", r."templateKey"
         FROM public."Membership" m JOIN public."Role" r ON r.id = m."roleId"
        WHERE m."tenantId" = $1 AND m."userId" = $2 AND m."isDeleted" = false AND m.status = 'ACTIVE'`,
			[ORG_ID, inviteeId],
		);
		expect(membership).toEqual({ status: "ACTIVE", roleTenantId: ORG_ID, templateKey: "CASHIER" });
		const [claimed] = await query(`SELECT status, "acceptedByUserId" FROM public."TenantInvitation" WHERE id = $1`, [String(invitation.id)]);
		expect(claimed).toEqual({ status: "ACCEPTED", acceptedByUserId: inviteeId });
	});
});
