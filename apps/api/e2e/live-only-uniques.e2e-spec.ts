import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_IDS } from "../prisma/seed/tenants";
import { createE2eApp, mutationHeaders, uniqueClientIp } from "./e2e-helpers";

const PASSWORD = "Live-only-e2e-1A!";
const HTTP_CREATED = 201;
/** PostgreSQL's unique_violation. */
const UNIQUE_VIOLATION = "23505";
const IdRowSchema = z.object({ id: z.string() });
const PgErrorSchema = z.object({ code: z.string(), constraint: z.string().optional() });

/**
 * Q9 (2026-11-03): `User.email` and a store's `(tenantId, code)` are unique among **live** rows only. A
 * soft-deleted account no longer keeps its email taken, and a deleted store no longer keeps its code; two
 * live rows still can't share either.
 */
describe("Live-only uniques (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;

	function signUp(email: string): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/signup`,
			headers: mutationHeaders({ "x-forwarded-for": uniqueClientIp() }),
			payload: { email, password: PASSWORD, fullName: "Live Only E2E" },
		});
	}

	/** A copy of a seeded store of the KL tenant, with its own id and `code`, live or soft-deleted. */
	async function insertStore(code: string, isDeleted: boolean): Promise<void> {
		await pool.query(
			`INSERT INTO public."Location"
			 SELECT (jsonb_populate_record(NULL::public."Location", to_jsonb(l) || jsonb_build_object('id', $1::text, 'code', $2::text, 'isPrimary', false, 'isDeleted', $3::boolean, 'deletedAt', CASE WHEN $3::boolean THEN (extract(epoch FROM now()) * 1000)::bigint END))).*
			 FROM public."Location" l WHERE l."tenantId" = $4 LIMIT 1`,
			[randomUUID(), code, isDeleted, TENANT_SEED_IDS.klTenant],
		);
	}

	async function uniqueViolationOf<TResult>(work: Promise<TResult>): Promise<string | undefined> {
		try {
			await work;
			return undefined;
		} catch (error) {
			const parsed = PgErrorSchema.parse(error);
			expect(parsed.code).toBe(UNIQUE_VIOLATION);
			return parsed.constraint;
		}
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("lets someone sign up again with a deleted account's email, and never makes a second live account with it", async () => {
		const email = `live-only-${randomUUID()}@example.com`;
		expect((await signUp(email)).statusCode).toBe(HTTP_CREATED);
		const first = IdRowSchema.parse(
			(await pool.query(`UPDATE public."User" SET "isDeleted" = true, "deletedAt" = $1 WHERE email = $2 RETURNING id`, [Date.now(), email])).rows.at(0),
		);

		const again = await signUp(email);
		expect(again.statusCode, again.body).toBe(HTTP_CREATED);
		const live = z.array(IdRowSchema).parse((await pool.query(`SELECT id FROM public."User" WHERE email = $1 AND "isDeleted" = false`, [email])).rows);
		expect(live).toHaveLength(1);
		expect(live.map((row) => row.id)).not.toContain(first.id);

		// A taken email gets the same generic answer as a new one (no account enumeration), and no account.
		expect((await signUp(email)).statusCode).toBe(HTTP_CREATED);
		const stillOne = z.array(IdRowSchema).parse((await pool.query(`SELECT id FROM public."User" WHERE email = $1 AND "isDeleted" = false`, [email])).rows);
		expect(stillOne).toStrictEqual(live);
	});

	it("refuses a second live account with the same email at the database too (a race the API's check can't see)", async () => {
		const email = `live-only-db-${randomUUID()}@example.com`;
		expect((await signUp(email)).statusCode).toBe(HTTP_CREATED);
		const duplicate = pool.query(
			`INSERT INTO public."User" SELECT (jsonb_populate_record(NULL::public."User", to_jsonb(u) || jsonb_build_object('id', $1::text))).* FROM public."User" u WHERE email = $2`,
			[randomUUID(), email],
		);
		await expect(uniqueViolationOf(duplicate)).resolves.toBe("User_email_key");
	});

	it("frees a deleted store's code for a new store, and keeps one code per live store", async () => {
		const code = `reuse-${randomUUID().slice(0, 8)}`;
		await insertStore(code, true);
		await expect(insertStore(code, false)).resolves.toBeUndefined();
		await expect(uniqueViolationOf(insertStore(code, false))).resolves.toBe("Location_tenantId_code_key");
	});
});
