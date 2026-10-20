import { randomUUID } from "node:crypto";

import { CommandBus } from "@nestjs/cqrs";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { SupportAccessGrantResponse } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ApproveSupportAccessCommand } from "../src/contexts/authorization/application/commands/approve-support-access/approve-support-access.command";
import { RequestSupportAccessCommand } from "../src/contexts/authorization/application/commands/request-support-access/request-support-access.command";
import { RevokeSupportAccessCommand } from "../src/contexts/authorization/application/commands/revoke-support-access/revoke-support-access.command";
import { SupportAccessTenantNotFoundError } from "../src/contexts/authorization/domain/errors/authorization.errors";
import { ActorContextSchema, type ActorContext } from "../src/platform/application/actor-context";
import { createE2eApp } from "./e2e-helpers";

/**
 * Support access end to end on the real schema: the grant, tenants' ownership check and the
 * tenant audit rows (written through tenants' transactional ports) commit together.
 */

const SUPER_ADMIN_EMAIL = "superadmin@example.com";
const OWNER_EMAIL = "owner@sunrise-kopitiam.demo";

const IdRowSchema = z.object({ id: z.string() });
const MembershipRowSchema = z.object({ tenantId: z.string() });
const GrantRowSchema = z.object({ status: z.string(), tenantApprovedById: z.string().nullable() });
const AuditRowSchema = z.object({ action: z.string(), policyVersion: z.number(), actorUserId: z.string() });

describe("Support access (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdminId: string;
	let ownerId: string;
	let tenantId: string;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		superAdminId = IdRowSchema.parse((await pool.query(`SELECT id FROM public."User" WHERE email = $1`, [SUPER_ADMIN_EMAIL])).rows.at(0)).id;
		ownerId = IdRowSchema.parse((await pool.query(`SELECT id FROM public."User" WHERE email = $1`, [OWNER_EMAIL])).rows.at(0)).id;
		tenantId = MembershipRowSchema.parse(
			(
				await pool.query(
					`SELECT "tenantId" AS "tenantId" FROM public."Membership" WHERE "userId" = $1 AND role = 'OWNER' AND status = 'ACTIVE' AND "isDeleted" = false LIMIT 1`,
					[ownerId],
				)
			).rows.at(0),
		).tenantId;
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	function userActor(userId: string, isSuperAdmin: boolean): ActorContext {
		return ActorContextSchema.parse({
			kind: "user",
			userId,
			sessionId: randomUUID(),
			tenantId: null,
			isSuperAdmin,
			accessScope: "tenant",
			impersonatorUserId: null,
			request: { requestId: randomUUID(), ip: null, userAgent: null, deviceLabel: null, endpoint: null },
		});
	}

	async function grantRow(grantId: string): Promise<z.output<typeof GrantRowSchema>> {
		const result = await pool.query(`SELECT status, "tenantApprovedById" AS "tenantApprovedById" FROM public."SupportAccessGrant" WHERE id = $1`, [grantId]);
		return GrantRowSchema.parse(result.rows.at(0));
	}

	async function auditRows(grantId: string): Promise<z.output<typeof AuditRowSchema>[]> {
		const result = await pool.query(
			`SELECT action, "policyVersion" AS "policyVersion", "actorUserId" AS "actorUserId" FROM public."TenantAuditLog" WHERE "resourceId" = $1 ORDER BY "createdAt", action`,
			[grantId],
		);
		return z.array(AuditRowSchema).parse(result.rows);
	}

	it("requests, approves (as the tenant's owner) and revokes a grant, each with its tenant audit row", async () => {
		const bus = app.get(CommandBus);
		const requested: SupportAccessGrantResponse = await bus.execute(
			new RequestSupportAccessCommand(userActor(superAdminId, true), { tenantId, reason: "investigating a ticket", mode: "READ_ONLY", durationMinutes: 30 }),
		);
		expect((await grantRow(requested.id)).status).toBe("PENDING_TENANT_APPROVAL");

		await bus.execute(new ApproveSupportAccessCommand(userActor(ownerId, false), requested.id));
		expect(await grantRow(requested.id)).toEqual({ status: "ACTIVE", tenantApprovedById: ownerId });

		await bus.execute(new RevokeSupportAccessCommand(userActor(superAdminId, true), requested.id));
		expect((await grantRow(requested.id)).status).toBe("REVOKED");

		const audits = await auditRows(requested.id);
		expect(audits.map((audit) => audit.action).sort()).toEqual(["support.grant_approved", "support.grant_requested", "support.grant_revoked"]);
		expect(audits.every((audit) => audit.policyVersion > 0)).toBe(true);
	});

	it("refuses an approval by someone who does not own the tenant, writing nothing", async () => {
		const bus = app.get(CommandBus);
		const requested: SupportAccessGrantResponse = await bus.execute(
			new RequestSupportAccessCommand(userActor(superAdminId, true), { tenantId, reason: "investigating a ticket", mode: "READ_ONLY", durationMinutes: 30 }),
		);

		await expect(bus.execute(new ApproveSupportAccessCommand(userActor(superAdminId, true), requested.id))).rejects.toMatchObject({
			code: "SUPPORT_ACCESS_APPROVER_NOT_OWNER",
		});

		expect((await grantRow(requested.id)).status).toBe("PENDING_TENANT_APPROVAL");
		expect((await auditRows(requested.id)).map((audit) => audit.action)).toEqual(["support.grant_requested"]);
	});

	it("refuses a grant for a tenant that does not exist", async () => {
		await expect(
			app.get(CommandBus).execute(
				new RequestSupportAccessCommand(userActor(superAdminId, true), {
					tenantId: randomUUID(),
					reason: "investigating a ticket",
					mode: "READ_ONLY",
					durationMinutes: 30,
				}),
			),
		).rejects.toBeInstanceOf(SupportAccessTenantNotFoundError);
	});
});
