import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AccountErasureResponseSchema, API_VERSION_PREFIX, OwnAccountErasureResponseSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { systemActor } from "../src/platform/application/actor-context";
import { ACCOUNT_ERASURE_SERVICE } from "../src/contexts/privacy/application/ports/account-erasure.store";
import type { AccountErasureService } from "../src/contexts/privacy/application/services/account-erasure.service";
import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const PASSWORD = "Erasure-e2e-1A!xyz";
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;
const ErrorSchema = z.object({ error: z.object({ code: z.string(), details: z.object({ reason: z.string(), blockers: z.array(z.string()) }).optional() }) });
const UserRowSchema = z.object({ email: z.string(), fullName: z.string(), phone: z.string().nullable(), erasedAt: z.string().nullable(), isActive: z.boolean() });
const CountSchema = z.object({ count: z.string() });

/**
 * "Delete my account" over HTTP on a real database (ADR 077): asking needs the password and ends every session;
 * the person can still sign in to cancel during the grace period; once due, the account becomes the
 * "Deleted user" tombstone, its own rows are removed, personal values in kept records are masked, the old
 * password no longer works, and the email is free to sign up again. A business owner is refused, and
 * support can erase only with a reason.
 */
describe("Account erasure (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;

	function headers(user: LoginResult, client: "web" | "admin" = "web"): Record<string, string> {
		return client === "admin"
			? { cookie: `adminAccessToken=${user.accessToken}; adminRefreshToken=${user.refreshToken}`, "x-client-type": "admin", "x-forwarded-for": uniqueClientIp() }
			: { cookie: `accessToken=${user.accessToken}; refreshToken=${user.refreshToken}`, "x-forwarded-for": uniqueClientIp() };
	}

	function post(user: LoginResult, path: string, payload: Record<string, string> = {}, client: "web" | "admin" = "web"): Promise<InjectResponse> {
		return app.inject({ method: "POST", url: `${API_VERSION_PREFIX}${path}`, headers: mutationHeaders(headers(user, client)), payload });
	}

	async function newPerson(): Promise<{ readonly email: string; readonly userId: string }> {
		const email = `erasure-${randomUUID()}@example.com`;
		const signup = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/signup`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
			payload: { email, password: PASSWORD, fullName: "Erasure E2E" },
		});
		expect(signup.statusCode, signup.body).toBe(HTTP_CREATED);
		const row = z
			.object({ id: z.string() })
			.parse(
				(
					await pool.query(`UPDATE public."User" SET "emailVerifiedAt" = $1, phone = '+60123334444' WHERE email = $2 AND "isDeleted" = false RETURNING id`, [
						Date.now(),
						email,
					])
				).rows.at(0),
			);
		return { email, userId: row.id };
	}

	function erasures(): AccountErasureService {
		return app.get<AccountErasureService>(ACCOUNT_ERASURE_SERVICE);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("asks with the password, ends every session, lets the person cancel, then carries the erasure out once due", async () => {
		const { email, userId } = await newPerson();
		let me = await login(app, email, PASSWORD);
		await pool.query(`INSERT INTO public."UserPreference" (id, "userId", key, value, version) VALUES ($1, $2, 'ui.theme', '"dark"', 1)`, [randomUUID(), userId]);

		expect((await post(me, "/me/erasure", { password: "not-the-password" })).statusCode).toBe(HTTP_UNAUTHORIZED);
		const asked = await post(me, "/me/erasure", { password: PASSWORD });
		expect(asked.statusCode, asked.body).toBe(HTTP_CREATED);
		expect(parseSuccessEnvelope(asked, AccountErasureResponseSchema).data).toMatchObject({ status: "PENDING", requestedBy: "self" });
		expect(
			CountSchema.parse((await pool.query(`SELECT count(*)::text AS count FROM public."RefreshToken" WHERE "userId" = $1 AND "isDeleted" = false`, [userId])).rows.at(0))
				.count,
		).toBe("0");

		// The grace period: signing in still works, to see it and change one's mind.
		me = await login(app, email, PASSWORD);
		const status = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/me/erasure`, headers: headers(me) });
		expect(parseSuccessEnvelope(status, OwnAccountErasureResponseSchema).data.erasure?.status).toBe("PENDING");
		const cancelled = await post(me, "/me/erasure/cancel");
		expect(cancelled.statusCode).toBe(HTTP_OK);
		expect(parseSuccessEnvelope(cancelled, AccountErasureResponseSchema).data.status).toBe("CANCELLED");

		me = await login(app, email, PASSWORD);
		expect((await post(me, "/me/erasure", { password: PASSWORD })).statusCode).toBe(HTTP_CREATED);
		await pool.query(`UPDATE public."AccountErasure" SET "scheduledFor" = $1 WHERE "userId" = $2 AND status = 'PENDING'`, [Date.now() - 1_000, userId]);

		const run = await erasures().completeDue(systemActor("privacy.account.erase", "cron", null, "e2e", null));
		expect(run.completed).toBeGreaterThanOrEqual(1);

		const user = UserRowSchema.parse(
			(await pool.query(`SELECT email, "fullName", phone, "erasedAt"::text AS "erasedAt", "isActive" FROM public."User" WHERE id = $1`, [userId])).rows.at(0),
		);
		expect(user).toMatchObject({ email: `erased+${userId}@erased.invalid`, fullName: "Deleted user", phone: null, isActive: false });
		expect(user.erasedAt).not.toBeNull();
		const preferences = z
			.object({ value: z.object({}).strict(), isDeleted: z.boolean() })
			.array()
			.parse((await pool.query(`SELECT value, "isDeleted" FROM public."UserPreference" WHERE "userId" = $1`, [userId])).rows);
		expect(preferences.every((row) => row.isDeleted)).toBe(true);
		const unmaskedAudit = CountSchema.parse(
			(await pool.query(`SELECT count(*)::text AS count FROM public."AuditLog" WHERE "actorUserId" = $1 AND "ipAddress" IS NOT NULL`, [userId])).rows.at(0),
		);
		expect(unmaskedAudit.count).toBe("0");
		const completed = z
			.object({ status: z.string() })
			.parse((await pool.query(`SELECT status FROM public."AccountErasure" WHERE "userId" = $1 ORDER BY "requestedAt" DESC LIMIT 1`, [userId])).rows.at(0));
		expect(completed.status).toBe("COMPLETED");

		const oldPassword = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/login`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
			payload: { email, password: PASSWORD },
		});
		expect(oldPassword.statusCode).toBe(HTTP_UNAUTHORIZED);
		// The email is free again (Q9: unique among live accounts only).
		const again = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/signup`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
			payload: { email, password: PASSWORD, fullName: "Back Again" },
		});
		expect(again.statusCode).toBe(HTTP_CREATED);
		expect(CountSchema.parse((await pool.query(`SELECT count(*)::text AS count FROM public."User" WHERE email = $1 AND "isDeleted" = false`, [email])).rows.at(0)).count).toBe(
			"1",
		);
	});

	it("refuses a business owner, saying why", async () => {
		const owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/me/erasure`,
			headers: mutationHeaders({
				cookie: `merchantAccessToken=${owner.accessToken}; merchantRefreshToken=${owner.refreshToken}`,
				"x-client-type": "merchant",
				"x-forwarded-for": uniqueClientIp(),
			}),
			payload: { password: "BrewOwner@123" },
		});
		expect(response.statusCode, response.body).toBe(HTTP_CONFLICT);
		const error = ErrorSchema.parse(response.json()).error;
		expect(error.details?.reason).toBe("ACCOUNT_ERASURE_BLOCKED");
		expect(error.details?.blockers.join(" ")).toMatch(/own a business/u);
	});

	it("lets support erase someone's account only with a reason, and cancel it", async () => {
		const { userId } = await newPerson();
		const superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		expect((await post(superAdmin, `/admin/users/${userId}/erasure`, {}, "admin")).statusCode).toBe(HTTP_BAD_REQUEST);
		const asked = await post(superAdmin, `/admin/users/${userId}/erasure`, { reason: "Asked by email on 2 November (ticket 4411)" }, "admin");
		expect(asked.statusCode, asked.body).toBe(HTTP_CREATED);
		expect(parseSuccessEnvelope(asked, AccountErasureResponseSchema).data).toMatchObject({ requestedBy: "support", reason: "Asked by email on 2 November (ticket 4411)" });
		const seen = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/admin/users/${userId}/erasure`, headers: headers(superAdmin, "admin") });
		expect(parseSuccessEnvelope(seen, OwnAccountErasureResponseSchema).data.erasure?.status).toBe("PENDING");
		const cancelled = await post(superAdmin, `/admin/users/${userId}/erasure/cancel`, {}, "admin");
		expect(parseSuccessEnvelope(cancelled, AccountErasureResponseSchema).data.status).toBe("CANCELLED");
	});
});
