import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, UserPreferenceSchema, UserPreferencesSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * A person's remembered choices end to end on real Postgres: the registry is
 * enforced on the server, a second write replaces the live row (one per key),
 * "Reset to default" soft-deletes it, and a value the registry no longer
 * accepts reads as unset. The spec signs in as the seeded consumer and removes
 * every preference row of theirs afterwards.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const PREFERENCES = `${API_VERSION_PREFIX}/auth/preferences`;
const CONSUMER = { email: "user@example.com", password: "User@123" };

describe("User preferences (e2e, real Postgres)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let consumer: LoginResult;
	let consumerId = "";

	function send(method: "GET" | "PUT" | "DELETE", url: string, payload?: Readonly<Record<string, string | boolean>>): Promise<InjectResponse> {
		const cookie = { cookie: `accessToken=${consumer.accessToken}; refreshToken=${consumer.refreshToken}` };
		return app.inject({
			method,
			url,
			headers: { ...(method === "GET" ? cookie : mutationHeaders(cookie)), "x-forwarded-for": uniqueClientIp() },
			...(payload === undefined ? {} : { payload }),
		});
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		await grantSeedUsersFullSession(pool, [CONSUMER.email]);
		consumer = await login(app, CONSUMER.email, CONSUMER.password);
		consumerId = z.object({ id: z.string() }).parse((await pool.query('SELECT id FROM public."User" WHERE email = $1', [CONSUMER.email])).rows.at(0)).id;
		await pool.query('DELETE FROM public."UserPreference" WHERE "userId" = $1', [consumerId]);
	});

	afterAll(async () => {
		await pool.query('DELETE FROM public."UserPreference" WHERE "userId" = $1', [consumerId]);
		await pool.end();
		await app.close();
	});

	it("remembers a choice, replaces it on the same row, and resets it to the default", async () => {
		const first = await send("PUT", `${PREFERENCES}/board.execution.groupBy`, { value: "story" });
		expect(first.statusCode, first.body).toBe(200);
		expect(parseSuccessEnvelope(first, UserPreferenceSchema).data).toEqual({ key: "board.execution.groupBy", value: "story", version: 0 });

		const second = await send("PUT", `${PREFERENCES}/board.execution.groupBy`, { value: "none" });
		expect(parseSuccessEnvelope(second, UserPreferenceSchema).data).toEqual({ key: "board.execution.groupBy", value: "none", version: 1 });
		const listed = await send("GET", PREFERENCES);
		expect(parseSuccessEnvelope(listed, UserPreferencesSchema).data.preferences).toEqual([{ key: "board.execution.groupBy", value: "none", version: 1 }]);

		const reset = await send("DELETE", `${PREFERENCES}/board.execution.groupBy`);
		expect(reset.statusCode, reset.body).toBe(200);
		expect(parseSuccessEnvelope(reset, UserPreferencesSchema).data.preferences).toEqual([]);
		const rows = await pool.query('SELECT "isDeleted" FROM public."UserPreference" WHERE "userId" = $1', [consumerId]);
		expect(rows.rows).toEqual([{ isDeleted: true }]);
	});

	it("refuses a value the key does not accept, and an unknown key", async () => {
		const wrongValue = await send("PUT", `${PREFERENCES}/board.planning.groupBy`, { value: "story" });
		expect(wrongValue.statusCode).toBe(400);
		expect(ApiErrorResponseSchema.parse(wrongValue.json()).error.code).toBe("VALIDATION_ERROR");
		expect((await send("PUT", `${PREFERENCES}/theme`, { value: true })).statusCode).toBe(400);
	});

	it("reads a stored value the registry no longer accepts as unset", async () => {
		await pool.query(
			`INSERT INTO public."UserPreference" (id, "userId", key, value) VALUES (gen_random_uuid()::text, $1, 'board.execution.showSubtasks', '"sometimes"'::jsonb)`,
			[consumerId],
		);

		const listed = await send("GET", PREFERENCES);
		expect(parseSuccessEnvelope(listed, UserPreferencesSchema).data.preferences).toEqual([]);
	});
});
