import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminMerchantInviteCreatedResponseSchema, API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type LoginResult } from "./e2e-helpers";

/**
 * Merchant onboarding is all or nothing: the owner account, the claimed invite, the membership, the
 * stores and activation commit together, and the verify-email message is sent only after that commit.
 * A failure anywhere inside leaves no account, sends no email, and keeps the invite open for a retry.
 */

const OWNER_PASSWORD = "Merchant!Onboard2026";
const COUNT = z.object({ count: z.coerce.number().int() });
const InviteRowSchema = z.object({ status: z.string(), tenantId: z.string() });

describe("Merchant onboarding (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	/** A platform admin invites a new merchant (the admin panel's "Invite merchant"). */
	async function invite(email: string): Promise<{ readonly inviteId: string; readonly token: string }> {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/admin/invites`,
			headers: mutationHeaders({ authorization: `Bearer ${superAdmin.accessToken}`, "x-forwarded-for": uniqueClientIp() }),
			payload: { email, businessName: `Onboarding ${email}`, city: "KUALA_LUMPUR" },
		});
		expect(response.statusCode, response.body).toBe(201);
		const created = parseSuccessEnvelope(response, AdminMerchantInviteCreatedResponseSchema).data;
		return { inviteId: created.inviteId, token: created.inviteToken };
	}

	function complete(token: string): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/tenants/onboarding/complete`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp(), "x-client-type": "merchant" }),
			payload: {
				token,
				category: "restaurant",
				legalName: "Onboarding Test Sdn Bhd",
				registrationNo: "202601012345",
				taxId: "C2584563202",
				documentType: "SSM",
				fullName: "Onboarding Owner",
				password: OWNER_PASSWORD,
				primaryLocation: { name: "Onboarding Test — Main", addressText: "1 Jalan Ujian, 50000 Kuala Lumpur", contactPhone: "+60 3-1234 5678" },
			},
		});
	}

	async function count(sql: string, params: readonly string[]): Promise<number> {
		return COUNT.parse((await pool.query(sql, [...params])).rows.at(0)).count;
	}

	const accounts = (email: string): Promise<number> => count(`SELECT count(*) FROM public."User" WHERE email = $1`, [email]);
	const verificationEmails = (email: string): Promise<number> => count(`SELECT count(*) FROM public."EmailLog" WHERE "to" = $1 AND "templateKey" = 'verification'`, [email]);

	async function inviteRow(inviteId: string): Promise<z.output<typeof InviteRowSchema>> {
		return InviteRowSchema.parse((await pool.query(`SELECT status, "tenantId" AS "tenantId" FROM public."TenantInvitation" WHERE id = $1`, [inviteId])).rows.at(0));
	}

	it("creates the owner account, the owner membership and one verification email when it succeeds", async () => {
		const email = `onboard-ok-${randomUUID().slice(0, 8)}@example.com`;
		const { inviteId, token } = await invite(email);

		const response = await complete(token);

		expect(response.statusCode, response.body).toBe(201);
		const { tenantId, status } = await inviteRow(inviteId);
		expect(status).toBe("ACCEPTED");
		expect(await accounts(email)).toBe(1);
		expect(
			await count(
				`SELECT count(*) FROM public."Membership" m JOIN public."User" u ON u.id = m."userId" WHERE u.email = $1 AND m."tenantId" = $2 AND m.role = 'OWNER' AND m.status = 'ACTIVE'`,
				[email, tenantId],
			),
		).toBe(1);
		expect(await verificationEmails(email)).toBe(1);
	});

	it("creates no account and sends no email when the onboarding transaction fails, and the retry succeeds", async () => {
		const email = `onboard-fail-${randomUUID().slice(0, 8)}@example.com`;
		const { inviteId, token } = await invite(email);
		const { tenantId } = await inviteRow(inviteId);
		// Arranged as the database owner on one connection: the merchant profile the transaction updates is
		// set aside, so the transaction fails AFTER it would have created the account.
		const arrange = await pool.connect();
		await arrange.query(`CREATE TEMP TABLE set_aside_profile AS SELECT * FROM public."TenantMerchantProfile" WHERE "tenantId" = $1`, [tenantId]);
		expect((await arrange.query(`DELETE FROM public."TenantMerchantProfile" WHERE "tenantId" = $1`, [tenantId])).rowCount).toBe(1);

		const failed = await complete(token);

		expect(failed.statusCode).toBeGreaterThanOrEqual(400);
		expect(await accounts(email)).toBe(0);
		expect(await verificationEmails(email)).toBe(0);
		expect((await inviteRow(inviteId)).status).toBe("PENDING");

		// Restore the profile; the same link now completes, with exactly one account and one email.
		await arrange.query(`INSERT INTO public."TenantMerchantProfile" SELECT * FROM set_aside_profile`);
		await arrange.query("DROP TABLE set_aside_profile");
		arrange.release();
		const retried = await complete(token);
		expect(retried.statusCode, retried.body).toBe(201);
		expect(await accounts(email)).toBe(1);
		expect(await verificationEmails(email)).toBe(1);
	});
});
