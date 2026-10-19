import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/prisma/prisma.service";
import { createE2eApp, login, type LoginResult } from "./e2e-helpers";
import { expectNoNPlusOne } from "./support/sql-statement-counter";

/**
 * GET /product must issue the same number of SQL statements for a 1-row page
 * and a 25-row page (migration plan §11). Housekeeping (BEGIN, set_config, COMMIT)
 * is ignored by the counter.
 */
const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const PRODUCT_LIST_URL = `${API_VERSION_PREFIX}/product`;
const FIXTURE_EPOCH = 1_790_812_800_000;

describe("product list has no N+1 (e2e)", () => {
	const marker = `n1${randomUUID().slice(0, 8)}`;
	const categoryId = randomUUID();
	let app: NestFastifyApplication;
	let session: LoginResult;
	let pool: Pool;

	async function seed(rows: number): Promise<void> {
		await pool.query('DELETE FROM public."Product" WHERE "categoryId" = $1', [categoryId]);
		for (let row = 1; row <= rows; row += 1) {
			const id = randomUUID();
			await pool.query(
				`INSERT INTO public."Product" (id, "categoryId", name, sku, slug, price, brand, "isActive", "createdAt", "updatedAt")
				 VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8)`,
				[id, categoryId, `${marker} ${String(row)}`, `${marker}-${id}`, `${marker}-${id}`, row, marker, FIXTURE_EPOCH],
			);
		}
	}

	beforeAll(async (): Promise<void> => {
		pool = new Pool({ connectionString: DATABASE_URL });
		await pool.query(`INSERT INTO public."SampleCategory" (id, name, slug, "isActive") VALUES ($1, $2, $3, true)`, [categoryId, `${marker} category`, `${marker}-category`]);
		app = await createE2eApp();
		session = await login(app, "superadmin@example.com", "SuperAdmin@123");
	});

	afterAll(async (): Promise<void> => {
		await pool.query('DELETE FROM public."Product" WHERE "categoryId" = $1', [categoryId]);
		await pool.query('DELETE FROM public."SampleCategory" WHERE id = $1', [categoryId]);
		await pool.end();
		await app.close();
	});

	it("counts the same statements for one row and a full page", async (): Promise<void> => {
		await seed(1);
		const warmed = await app.inject({
			method: "GET",
			url: `${PRODUCT_LIST_URL}?search=${marker}&limit=1`,
			headers: { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}` },
		});
		expect(warmed.statusCode).toBe(200);
		const statementPool = app.get(PrismaService).connectionPool();
		await expectNoNPlusOne(
			statementPool,
			async (pageSize: number): Promise<void> => {
				const response = await app.inject({
					method: "GET",
					url: `${PRODUCT_LIST_URL}?search=${marker}&limit=${String(pageSize)}`,
					headers: { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}` },
				});
				expect(response.statusCode).toBe(200);
			},
			seed,
		);
	});
});
