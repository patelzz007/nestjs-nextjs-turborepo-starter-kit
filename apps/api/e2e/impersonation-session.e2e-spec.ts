import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, AUTH_COOKIE_NAMES } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TokenService } from "../src/contexts/identity/infrastructure/security/token.service";
import { openAdminDeviceSession, startImpersonation as startImpersonationAs } from "./support/impersonation";
import { createE2eApp, mutationHeaders, uniqueClientIp } from "./e2e-helpers";

/**
 * H4 — impersonation tokens are bound to a server-side session. Stopping the
 * impersonation ends that session, so the SAME (still unexpired, validly
 * signed) impersonation token is rejected by AuthGuard afterwards, and a
 * replayed stop cannot mint another admin token.
 */

const SUPER_ADMIN_EMAIL = "superadmin@example.com";
const TARGET_EMAIL = "user@example.com";

const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });

describe("Impersonation sessions (e2e)", () => {
	let app: NestFastifyApplication;
	let superAdminId: string;
	let targetId: string;
	let pool: Pool;
	let adminSession: { readonly sessionId: string; readonly refreshToken: string };

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		const lookup = async (email: string): Promise<string> => {
			const result = await pool.query<{ id: string }>(`SELECT id FROM public."User" WHERE email = $1`, [email]);
			const id = result.rows.at(0)?.id;
			if (id === undefined) {
				throw new Error(`Seed user missing: ${email} — run pnpm db:seed`);
			}
			return id;
		};
		superAdminId = await lookup(SUPER_ADMIN_EMAIL);
		targetId = await lookup(TARGET_EMAIL);
		adminSession = await openAdminDeviceSession(app, pool, superAdminId);
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	async function startImpersonation(): Promise<string> {
		const started = await startImpersonationAs(app, pool, superAdminId, targetId);
		return started.accessToken;
	}

	function getSessions(token: string): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/auth/sessions`,
			headers: { authorization: `Bearer ${token}`, "x-forwarded-for": uniqueClientIp() },
		});
	}

	/** Stops with the administrator's own refresh cookie (the web client), unless `refreshToken` is null. */
	function stop(token: string, refreshToken: string | null = adminSession.refreshToken): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/stop-impersonation`,
			headers: mutationHeaders({ authorization: `Bearer ${token}`, "x-forwarded-for": uniqueClientIp() }),
			...(refreshToken === null ? {} : { cookies: { [AUTH_COOKIE_NAMES.web.refreshToken]: refreshToken } }),
		});
	}

	/** The access token a stop answer set as the web app's cookie. */
	function restoredAccessToken(response: Awaited<ReturnType<typeof stop>>): string {
		const cookie = response.cookies.find((candidate): boolean => candidate.name === AUTH_COOKIE_NAMES.web.accessToken);
		return z.string().min(1).parse(cookie?.value);
	}

	it("accepts the impersonation token while its session is live", async () => {
		const token = await startImpersonation();

		const response = await getSessions(token);

		expect(response.statusCode, response.body).toBe(200);
	});

	it("revokes the impersonation token server-side once impersonation is stopped", async () => {
		const token = await startImpersonation();

		const stopped = await stop(token);
		expect(stopped.statusCode, stopped.body).toBe(201);

		const afterStop = await getSessions(token);
		expect(afterStop.statusCode).toBe(401);
		expect(ErrorEnvelopeSchema.parse(afterStop.json()).error.code).toBe("IMPERSONATION_SESSION_INVALID");
	});

	it("refuses a replayed stop with the same token (no second admin session is minted)", async () => {
		const token = await startImpersonation();
		expect((await stop(token)).statusCode).toBe(201);

		const replay = await stop(token);

		expect(replay.statusCode).toBe(401);
		expect(replay.headers["set-cookie"]).toBeUndefined();
	});

	it("binds the restored admin token to the administrator's own device session (sid), so it is usable", async () => {
		const stopped = await stop(await startImpersonation());
		expect(stopped.statusCode, stopped.body).toBe(201);
		const restored = restoredAccessToken(stopped);

		const sessions = await getSessions(restored);

		expect(sessions.statusCode, sessions.body).toBe(200);
		expect((await app.get(TokenService).verifyAccessToken(restored)).sid).toBe(adminSession.sessionId);
	});

	it("refuses to stop without the administrator's refresh token, leaving the impersonation live", async () => {
		const token = await startImpersonation();

		const refused = await stop(token, null);

		expect(refused.statusCode).toBe(401);
		expect(ErrorEnvelopeSchema.parse(refused.json()).error.code).toBe("REFRESH_TOKEN_MISSING");
		expect((await getSessions(token)).statusCode).toBe(200);
	});

	it("refuses a refresh token whose device session was revoked", async () => {
		const revoked = await openAdminDeviceSession(app, pool, superAdminId);
		await pool.query(`UPDATE public."RefreshToken" SET "isDeleted" = true, "deletedAt" = $2, "deletedBy" = $3 WHERE id = $1`, [revoked.sessionId, Date.now(), superAdminId]);
		const token = await startImpersonation();

		const refused = await stop(token, revoked.refreshToken);

		expect(refused.statusCode).toBe(401);
		expect((await getSessions(token)).statusCode).toBe(200);
	});
});
