import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, ApiErrorResponseSchema } from "@workspace/shared";

import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { ORGANIZATION_MEMBERSHIP_ERROR_CODES } from "../src/modules/organization/services/organization-membership.service";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const ORG_PATH = `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.kl}`;
const ORG_ID = ORGANIZATION_SEED_IDS.klOrganization;
const APPROVED_REQUESTER_EMAIL = "grace.wilson@example.com";
const REJECTED_REQUESTER_EMAIL = "frank.miller@example.com";

type Row = Record<string, string | number | boolean | null>;

/**
 * Reviewing an organization access request: the PENDING → APPROVED/REJECTED
 * compare-and-set runs as the `organization.access_request.review` system
 * operation, so `organization_access_requests` must carry an UPDATE policy for
 * it — otherwise the claim matches no row and every review answers 409
 * "already reviewed" without approving anything.
 */
describe("Organization access request review (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let approvedRequesterId: string;
	let rejectedRequesterId: string;
	const approvedRequestId = randomUUID();
	const rejectedRequestId = randomUUID();

	async function query(sql: string, values: readonly (string | number | boolean | null)[] = []): Promise<readonly Row[]> {
		return (await pool.query<Row>(sql, [...values])).rows;
	}

	async function userIdOf(email: string): Promise<string> {
		const [row] = await query(`SELECT id FROM public.users WHERE email = $1`, [email]);
		if (row === undefined) {
			throw new Error(`Seed user ${email} is missing — run pnpm db:seed`);
		}
		return String(row.id);
	}

	async function removeFixtures(): Promise<void> {
		const userIds = `{${approvedRequesterId},${rejectedRequesterId}}`;
		await query(
			`DELETE FROM public.organization_membership_location_scopes WHERE membership_id IN (
         SELECT id FROM public.organization_memberships WHERE organization_id = $1 AND user_id = ANY($2::text[]))`,
			[ORG_ID, userIds],
		);
		await query(`DELETE FROM public.organization_memberships WHERE organization_id = $1 AND user_id = ANY($2::text[])`, [ORG_ID, userIds]);
		await query(`DELETE FROM public.organization_access_requests WHERE organization_id = $1 AND user_id = ANY($2::text[])`, [ORG_ID, userIds]);
	}

	function review(requestId: string, payload: object): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${ORG_PATH}/access-requests/${requestId}/review`,
			headers: mutationHeaders({ cookie: `merchantAccessToken=${owner.accessToken}; merchantRefreshToken=${owner.refreshToken}`, "x-client-type": "merchant" }),
			payload,
		});
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		approvedRequesterId = await userIdOf(APPROVED_REQUESTER_EMAIL);
		rejectedRequesterId = await userIdOf(REJECTED_REQUESTER_EMAIL);
		await removeFixtures();
		await query(`INSERT INTO public.organization_access_requests (id, organization_id, user_id, status, message) VALUES ($1, $2, $3, 'PENDING', 'E2E: please add me')`, [
			approvedRequestId,
			ORG_ID,
			approvedRequesterId,
		]);
		await query(`INSERT INTO public.organization_access_requests (id, organization_id, user_id, status, message) VALUES ($1, $2, $3, 'PENDING', 'E2E: please add me')`, [
			rejectedRequestId,
			ORG_ID,
			rejectedRequesterId,
		]);
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
	});

	afterAll(async () => {
		await removeFixtures();
		await pool.end();
		await app.close();
	});

	it("approves a pending request: request APPROVED and an ACTIVE membership with the granted role and scope", async () => {
		const response = await review(approvedRequestId, { approve: true, role: "CASHIER", locationScopeType: "SELECTED", locationIds: [ORGANIZATION_SEED_IDS.klLocation] });

		expect(response.statusCode, response.body).toBe(201);
		const [request] = await query(`SELECT status, reviewed_at IS NOT NULL AS reviewed FROM public.organization_access_requests WHERE id = $1`, [approvedRequestId]);
		expect(request).toEqual({ status: "APPROVED", reviewed: true });
		const memberships = await query(
			`SELECT m.role, m.status, s.scope_type, s.location_id
         FROM public.organization_memberships m
         JOIN public.organization_membership_location_scopes s ON s.membership_id = m.id
        WHERE m.organization_id = $1 AND m.user_id = $2 AND m.is_deleted = false`,
			[ORG_ID, approvedRequesterId],
		);
		expect(memberships).toEqual([{ role: "CASHIER", status: "ACTIVE", scope_type: "SELECTED", location_id: ORGANIZATION_SEED_IDS.klLocation }]);
	});

	it("rejects a pending request without creating a membership", async () => {
		const response = await review(rejectedRequestId, { approve: false });

		expect(response.statusCode, response.body).toBe(201);
		const [request] = await query(`SELECT status FROM public.organization_access_requests WHERE id = $1`, [rejectedRequestId]);
		expect(request).toEqual({ status: "REJECTED" });
		expect(await query(`SELECT 1 FROM public.organization_memberships WHERE organization_id = $1 AND user_id = $2`, [ORG_ID, rejectedRequesterId])).toHaveLength(0);
	});

	it("answers 409 for a request that was already reviewed", async () => {
		const response = await review(approvedRequestId, { approve: false });

		expect(response.statusCode, response.body).toBe(409);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe(ORGANIZATION_MEMBERSHIP_ERROR_CODES.accessRequestAlreadyReviewed);
	});
});
