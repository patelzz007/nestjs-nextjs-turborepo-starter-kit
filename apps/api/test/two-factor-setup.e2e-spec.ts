import { Pool } from "pg";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, BACKUP_CODE_COUNT, TwoFactorSetupResponseSchema } from "@workspace/shared";

import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type LoginResult } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const SETUP_URL = `${API_VERSION_PREFIX}/auth/2fa/setup`;
const USER_EMAIL = "user@example.com";
const HTTP_CREATED = 201;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

/** The session cookie plus a fresh synthetic client address, so the per-IP throttle of this route never couples runs. */
function sessionHeaders(session: LoginResult): Record<string, string> {
	return { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`, "x-forwarded-for": uniqueClientIp() };
}

/**
 * Starting a 2FA enrollment writes a pending secret, so it is a POST that goes
 * through the same mutation-intent check and authorization audit as every
 * other state change — never a GET a link, an image tag or a prefetch could
 * trigger.
 */
describe("POST /auth/2fa/setup (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let userId: string;
	let session: LoginResult;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		const user = await pool.query<{ id: string }>(`SELECT id FROM public.users WHERE email = $1`, [USER_EMAIL]);
		const id = user.rows.at(0)?.id;
		if (id === undefined) {
			throw new Error(`Seed data missing for ${USER_EMAIL} — run pnpm db:seed`);
		}
		userId = id;
		// A full session for a member who has not enrolled yet.
		await pool.query(`UPDATE public.users SET email_verified_at = $1, mfa_enrollment_deadline = $2, two_factor_enabled = false WHERE id = $3`, [
			Date.now(),
			Date.now() + 86_400_000,
			userId,
		]);
		session = await login(app, USER_EMAIL, "User@123");
	});

	afterAll(async () => {
		await pool.query(`DELETE FROM public.two_factor_pending_setups WHERE user_id = $1`, [userId]);
		await pool.end();
		await app.close();
	});

	it("starts an enrollment: stores the pending setup, answers the secret + backup codes and records an authorization audit entry", async () => {
		const startedAt: number = Date.now();

		const response = await app.inject({ method: "POST", url: SETUP_URL, headers: mutationHeaders(sessionHeaders(session)), payload: {} });

		expect(response.statusCode, response.body).toBe(HTTP_CREATED);
		expect(parseSuccessEnvelope(response, TwoFactorSetupResponseSchema).data.backupCodes).toHaveLength(BACKUP_CODE_COUNT);
		const pending = await pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM public.two_factor_pending_setups WHERE user_id = $1`, [userId]);
		expect(pending.rows.at(0)?.count).toBe("1");
		const audits = await pool.query<{ count: string }>(
			`SELECT count(*)::text AS count FROM public.authorization_audits WHERE actor_id = $1 AND action = 'UPDATE' AND resource = 'USER' AND "createdAt" >= $2`,
			[userId, startedAt],
		);
		expect(Number(audits.rows.at(0)?.count)).toBeGreaterThanOrEqual(1);
	});

	it("rejects a cross-site request without the mutation-intent header", async () => {
		const response = await app.inject({ method: "POST", url: SETUP_URL, headers: sessionHeaders(session), payload: {} });

		expect(response.statusCode).toBe(HTTP_FORBIDDEN);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("MUTATION_INTENT_REQUIRED");
	});

	it("no longer answers a GET (a state change must never be a safe method)", async () => {
		const response = await app.inject({ method: "GET", url: SETUP_URL, headers: sessionHeaders(session) });

		expect(response.statusCode).toBe(HTTP_NOT_FOUND);
	});
});
