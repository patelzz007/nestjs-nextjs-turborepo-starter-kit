import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, ApiPaginatedMetaSchema, ProductSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createE2eApp, login, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * Real-Postgres proof of the list-query grammar end to end (docs/technical/api/list-queries.md):
 * Fastify query string → bracket nesting → strict shared schema → filter AST →
 * per-resource Prisma translator → SQL. Uses `GET /product` with a private set
 * of rows (unique search marker) that deliberately share sort values, so the
 * `id` tie-breaker is what keeps pages disjoint and stable.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const PRODUCT_LIST_URL = `${API_VERSION_PREFIX}/product`;
const PAGE_SIZE = 2;
const FIXTURE_EPOCH = 1_790_812_800_000;
/** Two rows share this createdAt, three share price 10 — sort values with duplicates on purpose. */
const SHARED_PRICE = 10;
const HIGHER_PRICE = 20;
const HIGHEST_PRICE = 30;

interface ProductFixture {
	readonly id: string;
	readonly name: string;
	readonly price: number;
	readonly brand: string | null;
	readonly isActive: boolean;
	readonly createdAt: number;
}

const ListResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(ProductSchema),
	meta: ApiPaginatedMetaSchema,
});
type ListResponse = z.output<typeof ListResponseSchema>;

const ErrorBodySchema = z.object({ success: z.literal(false), error: z.object({ message: z.string() }) });

describe("List query grammar on GET /product (e2e, real Postgres)", () => {
	const marker = `c1list${randomUUID().slice(0, 8)}`;
	const categoryId = randomUUID();
	const fixtures: readonly ProductFixture[] = [
		{ id: randomUUID(), name: `${marker} alpha`, price: SHARED_PRICE, brand: "Acme", isActive: true, createdAt: FIXTURE_EPOCH },
		{ id: randomUUID(), name: `${marker} bravo`, price: SHARED_PRICE, brand: "ACME Labs", isActive: true, createdAt: FIXTURE_EPOCH },
		{ id: randomUUID(), name: `${marker} charlie`, price: SHARED_PRICE, brand: null, isActive: false, createdAt: FIXTURE_EPOCH + 1 },
		{ id: randomUUID(), name: `${marker} delta`, price: HIGHER_PRICE, brand: "Other", isActive: true, createdAt: FIXTURE_EPOCH + 2 },
		{ id: randomUUID(), name: `${marker} echo`, price: HIGHEST_PRICE, brand: "acme", isActive: true, createdAt: FIXTURE_EPOCH + 3 },
	];
	let app: NestFastifyApplication;
	let session: LoginResult;
	let pool: Pool;

	async function list(query: string): Promise<InjectResponse> {
		return app.inject({
			method: "GET",
			url: `${PRODUCT_LIST_URL}?${query}`,
			headers: { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}` },
		});
	}

	async function listOk(query: string): Promise<ListResponse> {
		const response = await list(query);
		if (response.statusCode !== 200) {
			throw new Error(`GET ${query} → ${String(response.statusCode)} ${response.body}`);
		}
		return ListResponseSchema.parse(response.json());
	}

	/** Expected order: the given comparator, then `id` in the same direction as the last term (the tie-breaker). */
	function expectedIds(compare: (left: ProductFixture, right: ProductFixture) => number, tieBreak: "asc" | "desc"): string[] {
		return [...fixtures]
			.sort((left, right) => compare(left, right) || (tieBreak === "asc" ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id)))
			.map((fixture) => fixture.id);
	}

	beforeAll(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		await pool.query(`INSERT INTO public.sample_category (id, name, slug, is_active) VALUES ($1, $2, $3, true)`, [categoryId, `${marker} category`, `${marker}-category`]);
		for (const fixture of fixtures) {
			await pool.query(
				`INSERT INTO public.product (id, category_id, name, sku, slug, price, brand, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
				[fixture.id, categoryId, fixture.name, `${marker}-${fixture.id}`, `${marker}-${fixture.id}`, fixture.price, fixture.brand, fixture.isActive, fixture.createdAt],
			);
		}
		app = await createE2eApp();
		session = await login(app, "superadmin@example.com", "SuperAdmin@123");
	});

	afterAll(async () => {
		await pool.query("DELETE FROM public.product WHERE category_id = $1", [categoryId]);
		await pool.query("DELETE FROM public.sample_category WHERE id = $1", [categoryId]);
		await pool.end();
		await app.close();
	});

	it("search + sort + offset pages: every row exactly once, duplicates ordered by the id tie-breaker", async () => {
		const seen: string[] = [];
		let page = 1;
		let totalPages = 1;
		do {
			const body = await listOk(`search=${marker}&sort=price&limit=${String(PAGE_SIZE)}&page=${String(page)}`);
			expect(body.meta.total).toBe(fixtures.length);
			// A custom sort never hands out a keyset cursor.
			expect(body.meta.nextCursor).toBeNull();
			seen.push(...body.data.map((product) => product.id));
			totalPages = body.meta.totalPages;
			page += 1;
		} while (page <= totalPages);

		expect(seen).toEqual(expectedIds((left, right) => left.price - right.price, "asc"));
	});

	it("descending multi-key sort", async () => {
		const body = await listOk(`search=${marker}&sort=-price,name&limit=10`);
		expect(body.data.map((product) => product.id)).toEqual(expectedIds((left, right) => right.price - left.price || left.name.localeCompare(right.name), "asc"));
	});

	it("filters with range, case-insensitive text and boolean operators combined", async () => {
		const body = await listOk(
			`search=${marker}&filter[price][gte]=${String(SHARED_PRICE)}&filter[price][lte]=${String(HIGHER_PRICE)}&filter[brand][contains]=acm&filter[isActive]=true`,
		);
		expect(new Set(body.data.map((product) => product.id))).toEqual(new Set([fixtures[0]?.id, fixtures[1]?.id]));
		expect(body.meta.total).toBe(2);
	});

	it("filters with in-lists and isNull", async () => {
		const inList = await listOk(`search=${marker}&filter[price][gte]=${String(HIGHER_PRICE)}&filter[categoryId][in]=${categoryId}`);
		expect(inList.meta.total).toBe(2);
		const withoutBrand = await listOk(`search=${marker}&filter[brand][isNull]=true`);
		expect(withoutBrand.data.map((product) => product.id)).toEqual([fixtures[2]?.id]);
	});

	it("keyset pages in the default order (createdAt desc, id desc) never skip or repeat rows that share a timestamp", async () => {
		const seen: string[] = [];
		let cursor: string | null = null;
		let first = true;
		while (first || cursor !== null) {
			const query = `search=${marker}&limit=${String(PAGE_SIZE)}${cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`}`;
			const body: ListResponse = await listOk(query);
			seen.push(...body.data.map((product) => product.id));
			cursor = body.meta.nextCursor;
			first = false;
		}
		expect(seen).toEqual(expectedIds((left, right) => right.createdAt - left.createdAt, "desc"));
	});

	it.each([
		["a non-whitelisted sort field", "sort=passwordHash", "Unknown sort field"],
		["a non-whitelisted filter field", "filter[deletedAt][isNull]=false", "Unknown filter field"],
		["an operator the field does not allow", "filter[isActive][gte]=1", "not allowed"],
		["a cursor combined with a custom sort", "cursor=abc&sort=name", "Cursor pagination follows the default order"],
		["a tampered cursor", "cursor=bm90LWEtY3Vyc29y", "cursor"],
		["the removed sortBy parameter", "sortBy=name", "sortBy"],
	])("rejects %s with 400", async (_label: string, query: string, expected: string) => {
		const response = await list(query);
		expect(response.statusCode).toBe(400);
		const body = ErrorBodySchema.parse(response.json());
		expect(JSON.stringify(response.json())).toContain(expected);
		expect(body.success).toBe(false);
	});
});
