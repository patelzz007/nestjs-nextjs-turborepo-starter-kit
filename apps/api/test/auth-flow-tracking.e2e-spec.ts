import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { CryptoService } from "../src/modules/auth/services/crypto.service";
import { TokenService } from "../src/modules/auth/services/token.service";
import { createE2eApp, login, mutationHeaders, uniqueClientIp, type InjectResponse } from "./e2e-helpers";

/**
 * Every `@TrackAuthFlow` flow, end to end: the `auth.flow` outbox event names
 * the user the flow acted on (also on failures for a known user) and carries
 * the stable error CODE, never the human-readable message.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const SUPER_ADMIN_EMAIL = "superadmin@example.com";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";
const INITIAL_PASSWORD = "FlowTrack@123";
const RESET_PASSWORD = "FlowTrackReset@456";

interface RecordedFlow {
	readonly userId: string | null;
	readonly status: string;
	readonly error: string | null;
}

describe("Auth flow tracking (e2e)", () => {
	const email = `flow-tracking-${randomUUID()}@example.com`;
	const startedAt = Date.now();
	let app: NestFastifyApplication;
	let verifier: Pool;

	async function post(path: string, payload: object, extraHeaders: Record<string, string> = {}): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/${path}`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp(), ...extraHeaders }),
			payload,
		});
	}

	/** The newest `auth.flow` event of `flow` written during this run. */
	async function latestFlow(flow: string): Promise<RecordedFlow> {
		const result = await verifier.query<RecordedFlow>(
			`SELECT payload->'payload'->>'userId' AS "userId", payload->'payload'->>'status' AS status, payload->'payload'->>'error' AS error
			 FROM public.outbox_events
			 WHERE event_type = 'auth.flow' AND payload->'payload'->>'flow' = $1 AND created_at >= $2
			 ORDER BY created_at DESC LIMIT 1`,
			[flow, startedAt],
		);
		const row = result.rows.at(0);
		if (row === undefined) {
			throw new Error(`no auth.flow event recorded for ${flow}`);
		}
		return row;
	}

	async function userIdOf(address: string): Promise<string> {
		const result = await verifier.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", [address]);
		const row = result.rows.at(0);
		if (row === undefined) {
			throw new Error(`no user ${address}`);
		}
		return row.id;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		// Superuser pool — verification and cleanup only (bypasses RLS).
		verifier = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await verifier.query("UPDATE public.users SET is_deleted = true, deleted_at = $2 WHERE email = $1", [email, Date.now()]);
		await verifier.end();
		await app.close();
	});

	it("signup records the newly created user", async () => {
		const response = await post("signup", { email, password: INITIAL_PASSWORD, fullName: "Flow Tracking" });

		expect(response.statusCode, response.body).toBe(201);
		expect(await latestFlow("signup")).toEqual({ userId: await userIdOf(email), status: "succeeded", error: null });
	});

	it("verify-email records the verified user", async () => {
		const token = await app.get(TokenService).generateEmailVerificationToken(email);

		const response = await post("verify-email", { token });

		expect(response.statusCode, response.body).toBe(201);
		expect(await latestFlow("verify-email")).toEqual({ userId: await userIdOf(email), status: "succeeded", error: null });
	});

	it("a wrong password for a known user records that user and the INVALID_CREDENTIALS code", async () => {
		const response = await post("login", { email, password: "Wrong@Password1" });

		expect(response.statusCode).toBe(401);
		expect(await latestFlow("login")).toEqual({ userId: await userIdOf(email), status: "failed", error: "INVALID_CREDENTIALS" });
	});

	it("a successful login records the user", async () => {
		await login(app, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

		expect(await latestFlow("login")).toEqual({ userId: await userIdOf(SUPER_ADMIN_EMAIL), status: "succeeded", error: null });
	});

	it("forgot-password and reset-password record the user whose password is reset", async () => {
		const tokens = vi.spyOn(app.get(CryptoService), "generateRandomToken");
		const forgot = await post("forgot-password", { email });
		const rawToken = z.string().safeParse(tokens.mock.results.at(-1)?.value);
		tokens.mockRestore();

		expect(forgot.statusCode, forgot.body).toBe(200);
		expect(await latestFlow("forgot-password")).toEqual({ userId: await userIdOf(email), status: "succeeded", error: null });
		expect(rawToken.success).toBe(true);

		const reset = await post("reset-password", { token: rawToken.data, password: RESET_PASSWORD });

		expect(reset.statusCode, reset.body).toBe(200);
		expect(await latestFlow("reset-password")).toEqual({ userId: await userIdOf(email), status: "succeeded", error: null });
	});

	it("an invalid reset token records no user and the UNAUTHORIZED code", async () => {
		const response = await post("reset-password", { token: "not-a-real-reset-token", password: RESET_PASSWORD });

		expect(response.statusCode).toBe(401);
		expect(await latestFlow("reset-password")).toEqual({ userId: null, status: "failed", error: "UNAUTHORIZED" });
	});

	it("change-password records the authenticated user (also when the current password is wrong)", async () => {
		const session = await login(app, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

		const response = await post(
			"change-password",
			{ currentPassword: "Not@TheCurrent1", newPassword: "Never@Applied123", confirmPassword: "Never@Applied123" },
			{ cookie: `accessToken=${session.accessToken}` },
		);

		expect(response.statusCode).toBe(401);
		expect(await latestFlow("change-password")).toEqual({ userId: await userIdOf(SUPER_ADMIN_EMAIL), status: "failed", error: "UNAUTHORIZED" });
	});
});
