import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, LIST_MAX_LIMIT } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, grantSeedUsersFullSession, login, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const PageSchema = z.object({ data: z.array(z.object({ userId: z.string(), fullName: z.string() })), meta: z.looseObject({}) });
const IdRowsSchema = z.array(z.object({ userId: z.string() }));
const OWNER_EMAIL = "brew.owner@kl-rewards.demo";

/** Enhancement 5.5: a draft broadcast's picked people looked up by id, so each is named whatever page they are on. */
describe("Broadcast customers looked up by id (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let klCustomers: readonly string[];
	let otherTenantCustomer: string;

	function customers(query: string): Promise<InjectResponse> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}/broadcasts/customers?${query}`,
			headers: { authorization: `Bearer ${owner.accessToken}`, "x-client-type": "merchant", "x-forwarded-for": uniqueClientIp() },
		});
	}

	async function idsOf(sql: string, values: readonly string[]): Promise<readonly string[]> {
		return IdRowsSchema.parse((await pool.query(sql, [...values])).rows).map((row) => row.userId);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, [OWNER_EMAIL]);
		owner = await login(app, OWNER_EMAIL, "BrewOwner@123", "merchant");
		const ofKl = `FROM public."TenantCustomer" tc JOIN public."Tenant" t ON t.id = tc."tenantId" WHERE t.slug = $1 AND tc."isDeleted" = false`;
		klCustomers = await idsOf(`SELECT tc."userId" AS "userId" ${ofKl} ORDER BY tc."lastClaimedAt" ASC`, [TENANT_SEED_SLUGS.kl]);
		// Someone who is not this store's customer at all (they must never be returned).
		const [outsider] = await idsOf(`SELECT u.id AS "userId" FROM public."User" u WHERE u."isDeleted" = false AND u.id NOT IN (SELECT tc."userId" ${ofKl}) LIMIT 1`, [
			TENANT_SEED_SLUGS.kl,
		]);
		otherTenantCustomer = z.string().parse(outsider);
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("returns exactly the picked people of this store, including ones beyond the first page, and never anyone who isn't its customer", async () => {
		expect(klCustomers.length).toBeGreaterThanOrEqual(2);
		const oldest = klCustomers.at(0) ?? "";
		const newest = klCustomers.at(-1) ?? "";
		// The oldest and the newest customer (opposite ends of the default order) and an outsider, in one lookup.
		const response = await customers(`limit=${String(LIST_MAX_LIMIT)}&ids=${oldest},${newest},${otherTenantCustomer}`);
		expect(response.statusCode).toBe(200);
		const page = PageSchema.parse(response.json());
		expect(page.data.map((customer) => customer.userId).sort()).toStrictEqual([oldest, newest].sort());
		expect(page.data.every((customer) => customer.fullName.length > 0)).toBe(true);
	});

	it("refuses anything that isn't a list of ids, or more than one page of them", async () => {
		expect((await customers("ids=not-a-uuid")).statusCode).toBe(400);
		expect((await customers(`ids=${klCustomers.at(0) ?? ""},1;DROP TABLE x`)).statusCode).toBe(400);
		const tooMany = Array.from({ length: LIST_MAX_LIMIT + 1 }, (_unused, index) => `0190f0e0-0000-7000-8000-${String(index).padStart(12, "0")}`).join(",");
		expect((await customers(`ids=${tooMany}`)).statusCode).toBe(400);
	});
});
