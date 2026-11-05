import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, SavedListViewListSchema, SavedListViewSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DataSchema = z.object({ data: z.looseObject({}) });
const PATH = "/me/saved-views";
/** A name of this run only, so the suite can run again on the same database. */
const NAME = `Created in e2e ${randomUUID()}`;

/**
 * Enhancement 5.10: saved views on admin lists over the real API and database. The seed gives the super admin
 * two views on the users list (one shared) and one on the audit logs, and the Platform Developer one shared
 * view on the audit logs.
 */
describe("Saved views on admin lists (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let developer: LoginResult;
	let customer: LoginResult;

	function call(method: "GET" | "POST" | "DELETE", path: string, session: LoginResult, payload?: object): Promise<InjectResponse> {
		const auth = { authorization: `Bearer ${session.accessToken}`, "x-forwarded-for": uniqueClientIp() };
		return app.inject({
			method,
			url: `${API_VERSION_PREFIX}${path}`,
			headers: method === "GET" ? auth : mutationHeaders(auth),
			...(payload === undefined ? {} : { payload }),
		});
	}

	async function viewsOf(session: LoginResult, listKey: string): Promise<z.output<typeof SavedListViewListSchema>["views"]> {
		const response = await call("GET", `${PATH}?listKey=${listKey}`, session);
		expect(response.statusCode).toBe(200);
		return SavedListViewListSchema.parse(DataSchema.parse(response.json()).data).views;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, ["superadmin@example.com", "developer@example.com", "alice.johnson@example.com"]);
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		developer = await login(app, "developer@example.com", "Developer@123", "admin");
		customer = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("lists your own views first, then other staff's shared ones with who shared them, and never anyone's private view", async () => {
		const audit = await viewsOf(superAdmin, "admin.audit-logs");
		expect(audit.map((view) => [view.name, view.mine, view.ownerName])).toStrictEqual([
			["Failed requests", true, null],
			["Background changes", false, "Platform Developer"],
		]);

		const developersUsers = await viewsOf(developer, "admin.users");
		expect(developersUsers.map((view) => view.name)).toStrictEqual(["Active accounts"]);
		expect(developersUsers.map((view) => view.name)).not.toContain("Locked out");
		expect(developersUsers.every((view) => !view.mine)).toBe(true);
	});

	it("saves a view, refuses the same name twice and a query that isn't one, and lets only the owner remove it", async () => {
		const created = await call("POST", PATH, superAdmin, { listKey: "admin.users", name: NAME, query: "?search=e2e&filter[status]=active" });
		expect(created.statusCode).toBe(201);
		const view = SavedListViewSchema.parse(DataSchema.parse(created.json()).data);
		expect(view).toMatchObject({ name: NAME, shared: false, mine: true, query: "?search=e2e&filter[status]=active" });

		expect((await call("POST", PATH, superAdmin, { listKey: "admin.users", name: NAME, query: "" })).statusCode).toBe(409);
		expect((await call("POST", PATH, superAdmin, { listKey: "admin.users", name: "Bad", query: "https://example.com/?x" })).statusCode).toBe(400);
		expect((await call("POST", PATH, superAdmin, { listKey: "not.a.list", name: "Bad", query: "" })).statusCode).toBe(400);

		expect((await call("DELETE", `${PATH}/${view.id}`, developer)).statusCode).toBe(404);
		expect((await viewsOf(superAdmin, "admin.users")).map((entry) => entry.name)).toContain(NAME);
		expect((await call("DELETE", `${PATH}/${view.id}`, superAdmin)).statusCode).toBe(200);
		expect((await viewsOf(superAdmin, "admin.users")).map((entry) => entry.name)).not.toContain(NAME);
		// The name is free again once removed (the unique only counts views still kept).
		const again = await call("POST", PATH, superAdmin, { listKey: "admin.users", name: NAME, query: "" });
		expect(again.statusCode).toBe(201);
		const recreated = SavedListViewSchema.parse(DataSchema.parse(again.json()).data);
		expect((await call("DELETE", `${PATH}/${recreated.id}`, superAdmin)).statusCode).toBe(200);
	});

	it("is for admin staff only", async () => {
		expect((await call("GET", `${PATH}?listKey=admin.users`, customer)).statusCode).toBeGreaterThanOrEqual(401);
		expect((await call("POST", PATH, customer, { listKey: "admin.users", name: "Mine", query: "" })).statusCode).toBeGreaterThanOrEqual(401);
	});
});
