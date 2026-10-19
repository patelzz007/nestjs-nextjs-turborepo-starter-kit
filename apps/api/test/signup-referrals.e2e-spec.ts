import { randomUUID } from "node:crypto";

import { CommandBus } from "@nestjs/cqrs";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, SignupReferralDashboardSchema, SignupReferralRefereeItemSchema } from "@workspace/shared";
import { z } from "zod";

import { SweepSignupSuccessNoticesCommand } from "../src/contexts/claims/application/commands/sweep-signup-success-notices/sweep-signup-success-notices.command";
import { SIGNUP_SUCCESS_NOTICE_OPERATION } from "../src/contexts/claims/application/services/signup-success-notice.application-service";
import { systemActor } from "../src/platform/application/actor-context";
import { createE2eApp, login, markSeedUserEmailVerified, parseSuccessEnvelope, type LoginResult } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const DASHBOARD_URL = `${API_VERSION_PREFIX}/auth/signup-referrals/dashboard`;
const REFEREES_URL = `${API_VERSION_PREFIX}/auth/signup-referrals/referees`;
/** The seeded demo referrer has at least these referees (one redeemed and notified, one owed, one not redeemed). */
const SEEDED_REFEREES = 3;

const RefereesPageSchema = z.object({ data: z.array(SignupReferralRefereeItemSchema), meta: z.object({ total: z.number(), limit: z.number(), page: z.number() }) });

/** The referrer's own signup referral screen (ADR 035): read-only, signed-in users only, scoped to the caller. */
describe("signup referrals (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let alice: LoginResult;
	let bob: LoginResult;
	const createdReferralIds: string[] = [];

	function cookies(session: LoginResult): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		// Seed users may be unverified (verify-email demo, or a reused database); this suite needs full sessions.
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		await markSeedUserEmailVerified(pool, "bob.smith@example.com");
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
		bob = await login(app, "bob.smith@example.com", "Bob@123");
	});

	afterAll(async () => {
		const client = await pool.connect();
		try {
			await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
			for (const id of createdReferralIds) {
				await client.query(`DELETE FROM public."RewardNotification" WHERE metadata->>'signupReferralId' = $1`, [id]);
				await client.query(`DELETE FROM public."SignupReferral" WHERE id = $1`, [id]);
			}
		} finally {
			client.release();
		}
		await pool.end();
		await app.close();
	});

	it("shows the referrer their current, shareable code", async () => {
		const response = await app.inject({ method: "GET", url: DASHBOARD_URL, headers: { cookie: cookies(alice) } });

		expect(response.statusCode, response.body).toBe(200);
		const dashboard = parseSuccessEnvelope(response, SignupReferralDashboardSchema).data;
		expect(dashboard).toMatchObject({ shareable: true, codeState: "active" });
		expect(dashboard.code).toMatch(/^[A-Z2-9]{8}$/u);
		expect(dashboard.expiresAt).toBeGreaterThan(Date.now());
		const [row] = (await pool.query<{ code: string }>(`SELECT code FROM public."SignupReferralCode" WHERE code = $1 AND "isDeleted" = false`, [dashboard.code])).rows;
		expect(row?.code).toBe(dashboard.code);
	});

	it("pages the referrer's own referees with their status, newest first", async () => {
		const response = await app.inject({ method: "GET", url: REFEREES_URL, query: { limit: "2" }, headers: { cookie: cookies(alice) } });

		expect(response.statusCode, response.body).toBe(200);
		const page = RefereesPageSchema.parse(response.json());
		expect(page.data).toHaveLength(2);
		expect(page.meta).toMatchObject({ limit: 2, page: 1 });
		expect(page.meta.total).toBeGreaterThanOrEqual(SEEDED_REFEREES);
		const [newer, older] = page.data;
		expect((newer?.createdAt ?? 0) >= (older?.createdAt ?? 0)).toBe(true);

		// Each referee's status is the referral's own state: redeemed once its first redemption stamped it.
		const all = RefereesPageSchema.parse((await app.inject({ method: "GET", url: REFEREES_URL, query: { limit: "100" }, headers: { cookie: cookies(alice) } })).json());
		const stored = await pool.query<{ fullName: string; createdAt: string; successfulAt: string | null }>(
			`SELECT u."fullName" AS "fullName", sr."createdAt" AS "createdAt", sr."successfulAt" AS "successfulAt"
			   FROM public."SignupReferral" sr JOIN public."User" u ON u.id = sr."refereeUserId"
			  WHERE sr."referrerUserId" = (SELECT id FROM public."User" WHERE email = 'alice.johnson@example.com') AND sr."isDeleted" = false
			  ORDER BY sr."createdAt" DESC, sr.id DESC`,
		);
		expect(all.data).toEqual(
			stored.rows.map((row) => ({ fullName: row.fullName, createdAt: Number(row.createdAt), status: row.successfulAt === null ? "not_redeemed" : "redeemed" })),
		);
	});

	it("never shows one referrer another's referees", async () => {
		const aliceReferees = RefereesPageSchema.parse(
			(await app.inject({ method: "GET", url: REFEREES_URL, query: { limit: "100" }, headers: { cookie: cookies(alice) } })).json(),
		);
		const bobReferees = RefereesPageSchema.parse((await app.inject({ method: "GET", url: REFEREES_URL, query: { limit: "100" }, headers: { cookie: cookies(bob) } })).json());

		const aliceNames = new Set(aliceReferees.data.map((referee) => `${referee.fullName}@${String(referee.createdAt)}`));
		expect(bobReferees.data.some((referee) => aliceNames.has(`${referee.fullName}@${String(referee.createdAt)}`))).toBe(false);
	});

	it("is for signed-in users only", async () => {
		for (const url of [DASHBOARD_URL, REFEREES_URL]) {
			const response = await app.inject({ method: "GET", url });
			expect(response.statusCode).toBe(401);
			expect(ApiErrorResponseSchema.safeParse(response.json()).success).toBe(true);
		}
	});

	it("delivers an owed signup-success notice to the referrer's inbox through claims' sweeper, once", async () => {
		const client = await pool.connect();
		let signupReferralId = "";
		try {
			await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
			const referrer = (
				await client.query<{ id: string; codeId: string }>(
					`SELECT u.id, c.id AS "codeId" FROM public."User" u JOIN public."SignupReferralCode" c ON c."userId" = u.id WHERE u.email = 'alice.johnson@example.com' LIMIT 1`,
				)
			).rows.at(0);
			const referee = (
				await client.query<{ id: string; fullName: string }>(
					`SELECT u.id, u."fullName" AS "fullName" FROM public."User" u
				  WHERE u."isDeleted" = false AND u.email <> 'alice.johnson@example.com'
				    AND NOT EXISTS (SELECT 1 FROM public."SignupReferral" sr WHERE sr."refereeUserId" = u.id)
				  LIMIT 1`,
				)
			).rows.at(0);
			if (referrer === undefined || referee === undefined) {
				throw new Error("seed has no referrer code or no free referee");
			}
			signupReferralId = randomUUID();
			createdReferralIds.push(signupReferralId);
			const now = Date.now();
			await client.query(
				`INSERT INTO public."SignupReferral" (id, "referrerUserId", "refereeUserId", "referralCodeId", "createdAt", "updatedAt", "successfulAt")
				 VALUES ($1, $2, $3, $4, $5, $5, $5)`,
				[signupReferralId, referrer.id, referee.id, referrer.codeId, now],
			);

			const sweep = (): Promise<{ readonly delivered: number }> =>
				app
					.get(CommandBus)
					.execute(
						new SweepSignupSuccessNoticesCommand(systemActor(SIGNUP_SUCCESS_NOTICE_OPERATION, "cron", null, "Deliver owed signup referral success notifications", null)),
					);
			expect((await sweep()).delivered).toBeGreaterThanOrEqual(1);
			await sweep();

			const notices = await client.query<{ userId: string; body: string }>(
				`SELECT "userId" AS "userId", body FROM public."RewardNotification" WHERE type = 'signup_referral_redeemed' AND metadata->>'signupReferralId' = $1`,
				[signupReferralId],
			);
			expect(notices.rows).toEqual([{ userId: referrer.id, body: `${referee.fullName} redeemed a reward. Your referral is successful.` }]);
			const [row] = (await client.query<{ notified: string | null }>(`SELECT "successNotifiedAt" AS notified FROM public."SignupReferral" WHERE id = $1`, [signupReferralId]))
				.rows;
			expect(row?.notified).not.toBeNull();
		} finally {
			client.release();
		}
	});
});
