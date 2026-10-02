// ── Response contracts on the real app (ADR 022) ───────────────────────────
// Proves, through the full AppModule pipeline (guards → route interceptors →
// ResponseInterceptor → GlobalExceptionFilter), that a response contract is
// enforced on the wire:
//   - fields a handler returns but the contract does not declare are STRIPPED
//     (an internal value can never leave the API),
//   - login tokens travel only in httpOnly cookies, never in the JSON body,
//   - a handler result that violates its contract becomes a generic 500.
import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, ProductSchema, type Product } from "@workspace/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ProductService } from "../src/modules/product/product.service";
import { createE2eApp, extractCookie, login, mutationHeaders, uniqueClientIp, type LoginResult } from "./e2e-helpers";

const SUPER_ADMIN_EMAIL = "superadmin@example.com";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";
const FIXTURE_EPOCH = 1_790_812_800_000;
/** Values that exist on the server side only — none of them may appear in a response body. */
const INTERNAL_SUPPLIER_SECRET = "supplier-contract-7f3a";
const INTERNAL_COST_PRICE = 4.2;

const PRODUCT: Product = {
	id: randomUUID(),
	brand: "Acme",
	categoryId: randomUUID(),
	compareAtPrice: null,
	description: null,
	imageUrl: null,
	isActive: true,
	isFeatured: false,
	name: "Contract probe",
	price: 10,
	shortDescription: null,
	sku: "contract-probe",
	slug: "contract-probe",
	stockQuantity: 3,
	weightGrams: null,
	version: 1,
	deletedAt: null,
	createdAt: FIXTURE_EPOCH,
	updatedAt: FIXTURE_EPOCH,
};

describe("Response contracts (e2e)", () => {
	let app: NestFastifyApplication;
	let session: LoginResult;

	function productDetail(): Promise<Awaited<ReturnType<NestFastifyApplication["inject"]>>> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/product/${PRODUCT.id}`,
			headers: { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}` },
		});
	}

	beforeAll(async () => {
		app = await createE2eApp();
		session = await login(app, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(async () => {
		await app.close();
	});

	it("strips internal fields a service returns: they never leave the API", async () => {
		const internalRow = { ...PRODUCT, supplierSecret: INTERNAL_SUPPLIER_SECRET, costPrice: INTERNAL_COST_PRICE };
		vi.spyOn(app.get(ProductService), "getById").mockResolvedValue(internalRow);

		const response = await productDetail();

		expect(response.statusCode, response.body).toBe(200);
		expect(response.body).not.toContain(INTERNAL_SUPPLIER_SECRET);
		expect(response.body).not.toContain("supplierSecret");
		expect(response.body).not.toContain("costPrice");
		// Exactly the contract's fields, nothing more.
		expect(z.object({ data: ProductSchema.strict() }).parse(response.json()).data).toEqual(PRODUCT);
	});

	it("answers a handler result that violates its contract with a generic 500 that echoes nothing", async () => {
		// `id` must be a UUID — a string that is not one type-checks but violates the contract.
		const brokenRow: Product = { ...PRODUCT, id: INTERNAL_SUPPLIER_SECRET };
		vi.spyOn(app.get(ProductService), "getById").mockResolvedValue(brokenRow);

		const response = await productDetail();

		expect(response.statusCode).toBe(500);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("INTERNAL_ERROR");
		expect(response.body).not.toContain(INTERNAL_SUPPLIER_SECRET);
	});

	it("keeps login tokens out of the JSON body — they only travel as httpOnly cookies", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/login`,
			headers: mutationHeaders({ "cf-connecting-ip": uniqueClientIp() }),
			payload: { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD },
		});
		const accessToken: string | undefined = extractCookie(response.headers["set-cookie"], "accessToken");
		const refreshToken: string | undefined = extractCookie(response.headers["set-cookie"], "refreshToken");

		// POST /auth/login has always answered 201 (status preserved by its response contract).
		expect(response.statusCode, response.body).toBe(201);
		expect(accessToken).toBeDefined();
		expect(refreshToken).toBeDefined();
		expect(response.body).not.toContain(accessToken ?? "missing-access-token");
		expect(response.body).not.toContain(refreshToken ?? "missing-refresh-token");
		expect(response.body).not.toContain("accessToken");
		expect(response.body).not.toContain("refreshToken");
		expect(response.body).not.toContain("passwordHash");
	});

	it("never exposes credential material on the profile endpoint", async () => {
		const response = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/auth/me`,
			headers: { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}` },
		});

		expect(response.statusCode, response.body).toBe(200);
		expect(response.body).not.toContain("passwordHash");
		expect(response.body).not.toContain("twoFactorSecret");
	});
});
