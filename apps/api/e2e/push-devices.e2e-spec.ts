import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, PushDeviceResponseSchema } from "@workspace/shared";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DataSchema = z.object({ data: z.looseObject({}) });
const StoredSchema = z.object({ installationIdCiphertext: z.string().nullable(), tokenCiphertext: z.string() });
/** A token's size as FCM hands them out, near enough. */
const TOKEN_BYTES = 120;
/** A Firebase Installation ID as Firebase generates it. */
const FID = "fH3kVq9TzR1aB2cD3eF4g_";

/** Enhancement 5.3: a phone reports its Firebase Installation ID with its token, kept encrypted at rest. */
describe("Push devices: the Firebase Installation ID (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let customer: LoginResult;

	function register(body: object): Promise<InjectResponse> {
		return app.inject({
			method: "PUT",
			url: `${API_VERSION_PREFIX}/notifications/push-devices`,
			headers: mutationHeaders({ authorization: `Bearer ${customer.accessToken}`, "x-forwarded-for": uniqueClientIp() }),
			payload: body,
		});
	}

	async function stored(deviceId: string): Promise<z.output<typeof StoredSchema>> {
		const { rows } = await pool.query(`SELECT "installationIdCiphertext", "tokenCiphertext" FROM public."PushDevice" WHERE id = $1`, [deviceId]);
		return StoredSchema.parse(rows.at(0));
	}

	function device(token: string, patch: object = {}): object {
		return { token, platform: "ANDROID", surface: "CUSTOMER", deviceLabel: "Pixel 9", appVersion: "1.4.0", ...patch };
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, ["alice.johnson@example.com"]);
		customer = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("keeps an Android install's ID encrypted, and fills it in when an updated app re-registers", async () => {
		const token = randomBytes(TOKEN_BYTES).toString("base64url");
		const first = await register(device(token));
		expect(first.statusCode).toBe(200);
		const { id } = PushDeviceResponseSchema.parse(DataSchema.parse(first.json()).data);
		// An older app build: no ID, so the device is sent by token.
		expect((await stored(id)).installationIdCiphertext).toBeNull();

		const again = await register(device(token, { installationId: FID }));
		expect(PushDeviceResponseSchema.parse(DataSchema.parse(again.json()).data).id).toBe(id);
		const row = await stored(id);
		expect(row.installationIdCiphertext).toMatch(/^v\d+:/u);
		expect(row.installationIdCiphertext).not.toContain(FID);
	});

	it("refuses an ID that isn't one, and an ID on iOS", async () => {
		expect((await register(device(randomBytes(TOKEN_BYTES).toString("base64url"), { installationId: "not-an-installation" }))).statusCode).toBe(400);
		expect((await register(device(randomBytes(TOKEN_BYTES).toString("base64url"), { platform: "IOS", installationId: FID }))).statusCode).toBe(400);
	});
});
