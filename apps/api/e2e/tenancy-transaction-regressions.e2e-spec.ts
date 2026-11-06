import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminTenantInviteCreatedResponseSchema, API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const XminRowSchema = z.object({ xmin: z.string() });
const CountRowSchema = z.object({ count: z.string() });
const CreatedCategorySchema = z.object({ id: z.string().min(1) });

/**
 * Regressions the DDD + CQRS gap list asked for (multi-tenancy plan §11):
 *
 * - a business change, its email record and its outbox events commit in ONE transaction (ADR 060): Postgres
 *   stamps every row a transaction writes with the same `xmin`, so equal `xmin`s prove it;
 * - an `Idempotency-Key` retry of a tenant invite and of a sample-category create replays the
 *   first answer and writes nothing twice.
 */
describe("Transaction and idempotency regressions (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	const createdTenantIds: string[] = [];
	const createdCategorySlugs: string[] = [];
	const invitedEmails: string[] = [];

	function adminPost(path: string, payload: Record<string, string | number | boolean>, extraHeaders: Record<string, string>): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}${path}`,
			headers: mutationHeaders({
				cookie: `adminAccessToken=${superAdmin.accessToken}; adminRefreshToken=${superAdmin.refreshToken}`,
				"x-client-type": "admin",
				...extraHeaders,
			}),
			payload,
		});
	}

	function invitePayload(runId: string): Record<string, string> {
		return {
			email: `owner.${runId}@regression.example.com`,
			displayName: `Regression Cafe ${runId}`,
			slug: `e2e-regression-${runId}`,
			city: "KUALA_LUMPUR",
			category: "cafe",
		};
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
	});

	afterAll(async () => {
		// Soft delete, like the app: the rows stay as history.
		await pool.query(`UPDATE public."Tenant" SET "isDeleted" = true, "deletedAt" = $2 WHERE id = ANY($1::text[])`, [createdTenantIds, Date.now()]);
		await pool.query(`UPDATE public."SampleCategory" SET "isDeleted" = true, "deletedAt" = $2 WHERE slug = ANY($1::text[])`, [createdCategorySlugs, Date.now()]);
		await pool.query(`UPDATE public."TenantInvitation" SET status = 'REVOKED', "isDeleted" = true, "deletedAt" = $2 WHERE email = ANY($1::text[]) AND status = 'PENDING'`, [
			invitedEmails,
			Date.now(),
		]);
		await pool.end();
		await app.close();
	});

	it("writes a team invitation, its invite email record and its outbox events in one transaction", async () => {
		const runId = randomUUID().slice(0, 8);
		const correlationId = `e2e-tx-${runId}`;
		const email = `cashier.${runId}@regression.example.com`;
		const owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");

		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}/members/invite`,
			headers: mutationHeaders({
				cookie: `merchantAccessToken=${owner.accessToken}; merchantRefreshToken=${owner.refreshToken}`,
				"x-client-type": "merchant",
				"x-correlation-id": correlationId,
			}),
			payload: { email, role: "CASHIER" },
		});
		expect(response.statusCode, response.body).toBe(201);
		invitedEmails.push(email);

		const invitations = z.array(XminRowSchema).parse((await pool.query(`SELECT xmin::text AS xmin FROM public."TenantInvitation" WHERE email = $1`, [email])).rows);
		const emails = z.array(XminRowSchema).parse((await pool.query(`SELECT xmin::text AS xmin FROM public."EmailLog" WHERE "to" = $1`, [email])).rows);
		const outbox = z.array(XminRowSchema).parse((await pool.query(`SELECT xmin::text AS xmin FROM public."OutboxEvent" WHERE "correlationId" = $1`, [correlationId])).rows);

		expect(invitations).toHaveLength(1);
		expect(emails.length).toBeGreaterThan(0);
		expect(outbox.length).toBeGreaterThan(0);
		const [invitation] = invitations;
		expect(new Set([...invitations, ...emails, ...outbox].map((row) => row.xmin))).toEqual(new Set([invitation?.xmin]));
	});

	it("replays an invite retried with the same Idempotency-Key and provisions one tenant", async () => {
		const runId = randomUUID().slice(0, 8);
		const key = randomUUID();
		const payload = invitePayload(runId);

		const first = await adminPost("/admin/tenants/invites", payload, { "idempotency-key": key });
		const retry = await adminPost("/admin/tenants/invites", payload, { "idempotency-key": key });

		expect(first.statusCode, first.body).toBe(201);
		expect(retry.statusCode, retry.body).toBe(201);
		expect(retry.headers["idempotent-replayed"]).toBe("true");
		const created = parseSuccessEnvelope(first, AdminTenantInviteCreatedResponseSchema).data;
		createdTenantIds.push(created.tenantId);
		expect(parseSuccessEnvelope(retry, AdminTenantInviteCreatedResponseSchema).data).toEqual(created);
		const tenants = CountRowSchema.parse((await pool.query(`SELECT count(*)::text AS count FROM public."Tenant" WHERE slug = $1`, [payload.slug])).rows.at(0));
		expect(tenants.count).toBe("1");
	});

	it("replays a sample category create retried with the same Idempotency-Key and stores one row", async () => {
		const runId = randomUUID().slice(0, 8);
		const key = randomUUID();
		const slug = `e2e-idem-${runId}`;
		createdCategorySlugs.push(slug);
		const payload = { name: `Idempotent ${runId}`, slug };

		const first = await adminPost("/sample-category", payload, { "idempotency-key": key });
		const retry = await adminPost("/sample-category", payload, { "idempotency-key": key });

		expect(first.statusCode, first.body).toBe(201);
		expect(retry.statusCode, retry.body).toBe(201);
		expect(retry.headers["idempotent-replayed"]).toBe("true");
		expect(parseSuccessEnvelope(retry, CreatedCategorySchema).data.id).toBe(parseSuccessEnvelope(first, CreatedCategorySchema).data.id);
		const rows = CountRowSchema.parse((await pool.query(`SELECT count(*)::text AS count FROM public."SampleCategory" WHERE slug = $1`, [slug])).rows.at(0));
		expect(rows.count).toBe("1");
	});
});
