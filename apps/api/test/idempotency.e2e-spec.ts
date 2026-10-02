import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, ApiErrorResponseSchema } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, type LoginResult } from "./e2e-helpers";

/** The slice of the created product this spec asserts on: its server-generated id. */
const CreatedProductSchema = z.object({ id: z.string().min(1) });

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/**
 * `@Idempotent()` on `POST /api/v1/product` against the real AppModule,
 * database, RLS policies and `http.idempotency` system operation.
 */
describe("Idempotency-Key on product create (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let session: LoginResult;
	let categoryId: string;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		session = await login(app, "superadmin@example.com", "SuperAdmin@123");
		const category = await pool.query<{ id: string }>("SELECT id FROM public.sample_category WHERE deleted_at IS NULL LIMIT 1");
		const id = category.rows.at(0)?.id;
		if (id === undefined) {
			throw new Error("Seed data missing: no sample_category rows — run pnpm db:seed");
		}
		categoryId = id;
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	function createProduct(idempotencyKey: string, sku: string, price: number): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/product`,
			headers: mutationHeaders({ cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`, "idempotency-key": idempotencyKey }),
			payload: { categoryId, name: `Idempotent ${sku}`, slug: sku.toLowerCase(), sku, price },
		});
	}

	it("creates once and replays the identical retry", async () => {
		const key: string = randomUUID();
		const sku = `IDEMP-${key.slice(0, 8)}`;

		const first = await createProduct(key, sku, 10);
		const retry = await createProduct(key, sku, 10);

		expect(first.statusCode, first.body).toBe(201);
		expect(retry.statusCode, retry.body).toBe(201);
		expect(retry.headers["idempotent-replayed"]).toBe("true");
		expect(parseSuccessEnvelope(retry, CreatedProductSchema).data.id).toBe(parseSuccessEnvelope(first, CreatedProductSchema).data.id);

		const rows = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM public.product WHERE sku = $1", [sku]);
		expect(rows.rows.at(0)?.count).toBe("1");
	});

	it("answers 409 IDEMPOTENCY_KEY_REUSED when the key is reused for a different payload", async () => {
		const key: string = randomUUID();
		const sku = `IDEMP-${key.slice(0, 8)}`;

		await createProduct(key, sku, 10);
		const reused = await createProduct(key, sku, 11);

		expect(reused.statusCode).toBe(409);
		expect(ApiErrorResponseSchema.parse(reused.json()).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
	});
});
