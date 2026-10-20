import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { PrismaService } from "../../../src/prisma/prisma.service";
import { createE2eApp, login, markSeedUserEmailVerified, uniqueClientIp } from "../../e2e-helpers";
import { seedTwoTenantFixture } from "../../support/two-tenant-fixture";

/**
 * A customer is a user with no membership (D7): customer routes never set a tenant, and tenant
 * routes refuse them with the same 404 a missing tenant gets.
 */

const CUSTOMER_EMAIL = "user@example.com";
const CUSTOMER_PASSWORD = "User@123";
const HTTP_NOT_FOUND = 404;

describe("tenancy multi: customers", () => {
	let app: NestFastifyApplication;
	let accessToken: string;

	beforeAll(async () => {
		app = await createE2eApp();
		await seedTwoTenantFixture(app.get(PrismaService));
		// A full session (verified email), so the refusal below is the tenancy rule and not the restricted-session gate.
		const pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await markSeedUserEmailVerified(pool, CUSTOMER_EMAIL);
		await pool.end();
		accessToken = (await login(app, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)).accessToken;
	});

	afterAll(async () => {
		await app.close();
	});

	it("CU-003: a customer calling tenant A's route is refused", async () => {
		const response = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/tenants/fixture-tenant-a/rewards`,
			headers: { authorization: `Bearer ${accessToken}`, "x-forwarded-for": uniqueClientIp() },
		});

		expect(response.statusCode, response.body).toBe(HTTP_NOT_FOUND);
		expect(response.json()).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
	});
});
