import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { ImpersonationGrantRequiredError } from "../../../src/contexts/identity/domain/errors/identity.errors";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { createE2eApp, login, uniqueClientIp } from "../../e2e-helpers";
import { startImpersonation } from "../../support/impersonation";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../../support/two-tenant-fixture";

/**
 * Platform staff on tenant data (D4, D21): a SuperAdmin is an ordinary user on a tenant route, so
 * tenant A is out of reach until A approves a support grant; with one, the request is bound to
 * tenant A and its audit entry names the grant. A refusal is the same 404 a missing tenant gets,
 * so a non-member cannot tell that a tenant exists. Runs in multi mode against the two-tenant
 * fixture (plan §8.1).
 */

const SUPER_ADMIN_EMAIL = "superadmin@example.com";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";
const TENANT_A_SLUG = "fixture-tenant-a";
const TENANT_A_REWARDS = `${API_VERSION_PREFIX}/tenants/${TENANT_A_SLUG}/rewards`;
const HTTP_NOT_FOUND = 404;
/** Long enough for any one test; the grant is revoked before the next one. */
const GRANT_TTL_MS = 3_600_000;

const IdRowSchema = z.object({ id: z.string() });
const AuditGrantRowSchema = z.object({ tenantId: z.string().nullable(), supportAccessGrantId: z.string().nullable() });
const SessionGrantRowSchema = z.object({ supportAccessGrantIds: z.array(z.string()) });
const AuditActionRowSchema = z.object({ action: z.string() });

describe("tenancy multi: platform staff on tenant routes", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdminId: string;
	let accessToken: string;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await seedTwoTenantFixture(app.get(PrismaService));
		superAdminId = IdRowSchema.parse((await pool.query(`SELECT id FROM public."User" WHERE email = $1`, [SUPER_ADMIN_EMAIL])).rows.at(0)).id;
		accessToken = (await login(app, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)).accessToken;
	});

	beforeEach(async () => {
		// Each test starts with no live grant for tenant A (arranged as the database owner).
		await pool.query(`UPDATE public."SupportAccessGrant" SET status = 'REVOKED', "revokedAt" = $3 WHERE "tenantId" = $1 AND "supportUserId" = $2 AND status = 'ACTIVE'`, [
			TWO_TENANT_FIXTURE.tenantA,
			superAdminId,
			Date.now(),
		]);
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	/** An ACTIVE grant for tenant A, approved by A-Owner, as the approval flow leaves it. */
	async function approveGrant(): Promise<string> {
		const grantId: string = randomUUID();
		await pool.query(
			`INSERT INTO public."SupportAccessGrant" (id, "tenantId", "supportUserId", mode, status, reason, "ticketRef", "tenantApprovedById", "expiresAt")
			 VALUES ($1, $2, $3, 'READ_ONLY', 'ACTIVE', 'e2e: investigating a ticket', 'SUP-E2E', $4, $5)`,
			[grantId, TWO_TENANT_FIXTURE.tenantA, superAdminId, TWO_TENANT_FIXTURE.userAOwner, Date.now() + GRANT_TTL_MS],
		);
		return grantId;
	}

	function readTenantA(): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({ method: "GET", url: TENANT_A_REWARDS, headers: { authorization: `Bearer ${accessToken}`, "x-forwarded-for": uniqueClientIp() } });
	}

	async function latestTenantAReadAudit(): Promise<z.output<typeof AuditGrantRowSchema>> {
		const result = await pool.query(
			`SELECT "tenantId" AS "tenantId", "supportAccessGrantId" AS "supportAccessGrantId" FROM public."AuditLog"
			 WHERE "actorUserId" = $1 AND path = $2 ORDER BY "occurredAt" DESC LIMIT 1`,
			[superAdminId, TENANT_A_REWARDS],
		);
		return AuditGrantRowSchema.parse(result.rows.at(0));
	}

	it("PLAT-002: a SuperAdmin without a grant is refused on tenant A's route and is bound to no tenant", async () => {
		const response = await readTenantA();

		expect(response.statusCode, response.body).toBe(HTTP_NOT_FOUND);
		expect(await latestTenantAReadAudit()).toEqual({ tenantId: null, supportAccessGrantId: null });
	});

	it("PLAT-003: with an approved grant the request is bound to tenant A, and the audit entry names the grant", async () => {
		const grantId: string = await approveGrant();

		await readTenantA();

		expect(await latestTenantAReadAudit()).toEqual({ tenantId: TWO_TENANT_FIXTURE.tenantA, supportAccessGrantId: grantId });
	});

	it("PLAT-004: impersonating A-Cashier needs a grant for tenant A, and the session records it", async () => {
		await expect(startImpersonation(app, pool, superAdminId, TWO_TENANT_FIXTURE.userACashier)).rejects.toBeInstanceOf(ImpersonationGrantRequiredError);

		const grantId: string = await approveGrant();
		const started = await startImpersonation(app, pool, superAdminId, TWO_TENANT_FIXTURE.userACashier);
		expect(started.impersonating).toBe(true);

		const session = await pool.query(
			`SELECT id, "supportAccessGrantIds" AS "supportAccessGrantIds" FROM public."ImpersonationSession"
			 WHERE "impersonatorId" = $1 AND "targetUserId" = $2 AND "endedAt" IS NULL`,
			[superAdminId, TWO_TENANT_FIXTURE.userACashier],
		);
		expect(SessionGrantRowSchema.parse(session.rows.at(0))).toEqual({ supportAccessGrantIds: [grantId] });
		const sessionId: string = IdRowSchema.parse(session.rows.at(0)).id;
		const audits = await pool.query(`SELECT action FROM public."ImpersonationAuditLog" WHERE "sessionId" = $1`, [sessionId]);
		expect(z.array(AuditActionRowSchema).parse(audits.rows)).toEqual([{ action: "START" }]);
	});
});
