import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, PersonalDataManifestSchema } from "@workspace/shared";
import { unzipSync } from "fflate";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createE2eApp, login, markSeedUserEmailVerified, uniqueClientIp, type LoginResult } from "./e2e-helpers";

const EXPORT_URL = `${API_VERSION_PREFIX}/me/data-export`;
const HTTP_OK = 200;
const HTTP_TOO_MANY_REQUESTS = 429;
/** Column names that must never appear in an export: secrets, or hashes that stand in for them. */
const SECRET_COLUMNS = ["passwordHash", "twoFactorSecret", "tokenHash", "tokenCiphertext", "redemptionTokenHash", "backupCodeHash", "previousTokenHash", '"token"'];
const AuditRowSchema = z.object({
	outcome: z.string(),
	responseBody: z.object({ export: z.literal("personal-data"), sections: z.array(z.object({ name: z.string(), records: z.number() })) }),
});

/**
 * "Download my data" over HTTP (ADR 077): the signed-in person gets one ZIP of their own data (a manifest and
 * one JSON file per section), no secret ever leaves, the export is audited, and only once a day.
 */
describe("Personal-data export (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let alice: LoginResult;
	let aliceId: string;

	function download(user: LoginResult): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "GET",
			url: EXPORT_URL,
			headers: { cookie: `accessToken=${user.accessToken}; refreshToken=${user.refreshToken}`, "x-forwarded-for": uniqueClientIp() },
		});
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		// A restricted session (email not verified) can't export: the export needs a fully verified sign-in.
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
		aliceId = z
			.object({ id: z.string() })
			.parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'alice.johnson@example.com' AND "isDeleted" = false`)).rows.at(0)).id;
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("gives the person one ZIP of their own data, with no secret in it, audited, and only once a day", async () => {
		const response = await download(alice);
		expect(response.statusCode, response.body).toBe(HTTP_OK);
		expect(response.headers["content-type"]).toBe("application/zip");
		expect(response.headers["content-disposition"]).toMatch(/^attachment; filename="personal-data-\d{4}-\d{2}-\d{2}\.zip"/u);
		expect(response.headers["cache-control"]).toContain("no-store");

		const files = unzipSync(new Uint8Array(response.rawPayload));
		const text = (name: string): string => Buffer.from(files[name] ?? new Uint8Array()).toString("utf8");
		const manifest = PersonalDataManifestSchema.parse(JSON.parse(text("manifest.json")));
		expect(manifest.userId).toBe(aliceId);
		expect(manifest.sections.map((section) => section.name)).toStrictEqual(["account", "claims", "notifications", "referrals"]);
		expect(Object.keys(files).sort()).toStrictEqual(["account.json", "claims.json", "manifest.json", "notifications.json", "referrals.json"]);

		const account = z.object({ profile: z.object({ id: z.string(), email: z.string() }) }).parse(JSON.parse(text("account.json")));
		expect(account.profile).toMatchObject({ id: aliceId, email: "alice.johnson@example.com" });
		const everything = Object.keys(files).map(text).join("\n");
		for (const secret of SECRET_COLUMNS) {
			expect(everything, `the export must not contain ${secret}`).not.toContain(secret);
		}

		const audit = await pool.query(
			`SELECT outcome, "responseBody" FROM public."AuditLog" WHERE "actorUserId" = $1 AND path LIKE '%/me/data-export' ORDER BY "occurredAt" DESC LIMIT 1`,
			[aliceId],
		);
		const row = AuditRowSchema.parse(audit.rows.at(0));
		expect(row.outcome).toBe("SUCCEEDED");
		expect(row.responseBody.sections.map((section) => section.name)).toStrictEqual(manifest.sections.map((section) => section.name));

		expect((await download(alice)).statusCode).toBe(HTTP_TOO_MANY_REQUESTS);
	});

	it("refuses someone who isn't signed in", async () => {
		const response = await app.inject({ method: "GET", url: EXPORT_URL, headers: { "x-forwarded-for": uniqueClientIp() } });
		expect(response.statusCode).toBe(401);
	});
});
