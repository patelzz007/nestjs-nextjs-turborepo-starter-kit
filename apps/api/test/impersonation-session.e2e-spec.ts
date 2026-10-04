import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { runWithSystemRlsContext } from "../src/prisma/rls-context";
import { ImpersonationService } from "../src/modules/impersonation/impersonation.service";
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

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		const lookup = async (email: string): Promise<string> => {
			const result = await pool.query<{ id: string }>(`SELECT id FROM public.users WHERE email = $1`, [email]);
			const id = result.rows.at(0)?.id;
			if (id === undefined) {
				throw new Error(`Seed user missing: ${email} — run pnpm db:seed`);
			}
			return id;
		};
		superAdminId = await lookup(SUPER_ADMIN_EMAIL);
		targetId = await lookup(TARGET_EMAIL);
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	async function startImpersonation(): Promise<string> {
		const started = await runWithSystemRlsContext("platform.superadmin", () => app.get(ImpersonationService).impersonateUser(superAdminId, targetId));
		return started.accessToken;
	}

	function getSessions(token: string): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/auth/sessions`,
			headers: { authorization: `Bearer ${token}`, "x-forwarded-for": uniqueClientIp() },
		});
	}

	function stop(token: string): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/stop-impersonation`,
			headers: mutationHeaders({ authorization: `Bearer ${token}`, "x-forwarded-for": uniqueClientIp() }),
		});
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
});
