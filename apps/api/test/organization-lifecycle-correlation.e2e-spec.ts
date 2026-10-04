import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdminOrganizationInviteCreatedResponseSchema, API_VERSION_PREFIX } from "@workspace/shared";

import { createE2eApp, login, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/**
 * Every organization lifecycle event carries the correlation id of the request
 * that caused it (`OrganizationLifecycleEventRecorder` reads it from the
 * transaction), so an operator can go from a lifecycle row to the request's
 * logs and audit entry.
 */
describe("Organization lifecycle event correlation (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	const runId = randomUUID().slice(0, 8);
	const correlationId = `e2e-lifecycle-${runId}`;
	const createdOrganizationIds: string[] = [];

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
	});

	afterAll(async () => {
		// Soft delete, like the app: the organization and its audit trail stay as history.
		await pool.query(`UPDATE public.organizations SET is_deleted = true, deleted_at = $2 WHERE id = ANY($1::text[])`, [createdOrganizationIds, Date.now()]);
		await pool.end();
		await app.close();
	});

	it("stamps the request's X-Correlation-Id on the PROVISIONING event of a platform invite", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/admin/organizations/invites`,
			headers: mutationHeaders({
				cookie: `adminAccessToken=${superAdmin.accessToken}; adminRefreshToken=${superAdmin.refreshToken}`,
				"x-client-type": "admin",
				"x-correlation-id": correlationId,
			}),
			payload: {
				email: `owner.${runId}@lifecycle.example.com`,
				displayName: "Lifecycle Correlation Cafe",
				slug: `e2e-lifecycle-${runId}`,
				city: "KUALA_LUMPUR",
				category: "cafe",
			},
		});

		expect(response.statusCode, response.body).toBe(201);
		expect(response.headers["x-correlation-id"]).toBe(correlationId);
		const { organizationId } = parseSuccessEnvelope(response, AdminOrganizationInviteCreatedResponseSchema).data;
		createdOrganizationIds.push(organizationId);

		const events = await pool.query<{ toState: string; correlationId: string | null }>(
			`SELECT to_state AS "toState", correlation_id AS "correlationId" FROM public.organization_lifecycle_events WHERE organization_id = $1`,
			[organizationId],
		);
		expect(events.rows).toEqual([{ toState: "PROVISIONING", correlationId }]);
	});
});
