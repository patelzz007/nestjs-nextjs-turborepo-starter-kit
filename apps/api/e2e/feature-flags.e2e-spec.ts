import { randomBytes } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	FeatureFlagListSchema,
	FeatureFlagSchema,
	FeatureFlagSettingsSchema,
	FeatureFlagStoreOverrideListSchema,
	FeatureFlagStoreOverrideSchema,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { DEMO_MERCHANT_API_KEYS } from "../prisma/seed/rewards";
import { TENANT_SEED_IDS } from "../prisma/seed/tenant-seed-ids";
import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DataSchema = z.object({ data: z.looseObject({}) });
const WAIT = { timeout: 20_000, interval: 100 };
const KATIL_TERMINAL = "MLK-KATIL-01";
/** A redemption token's size, as the claims issue them. */
const TOKEN_BYTES = 32;
const ErrorSchema = z.object({ error: z.object({ code: z.string() }) });

/** Enhancement 5.6: runtime feature flags over the real API and database (seeded: the gallery ON, invites DEFAULT). */
describe("Runtime feature flags (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let customer: LoginResult;

	function call(method: "GET" | "PUT" | "POST", path: string, session: LoginResult, payload?: object): Promise<InjectResponse> {
		const auth = { authorization: `Bearer ${session.accessToken}`, "x-forwarded-for": uniqueClientIp() };
		return app.inject({
			method,
			url: `${API_VERSION_PREFIX}${path}`,
			headers: method === "GET" ? auth : mutationHeaders(auth),
			...(payload === undefined ? {} : { payload }),
		});
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, ["superadmin@example.com", "alice.johnson@example.com"]);
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		customer = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	/** The Bukit Katil till (seeded key and terminal) previewing a code. */
	function tillPreview(): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/integration/redemptions/validate`,
			headers: { "x-api-key": DEMO_MERCHANT_API_KEYS.mlk, "x-terminal-id": KATIL_TERMINAL, "content-type": "application/json" },
			// Well-formed (32 random bytes) but no one's code: past the gate, it is simply unknown.
			payload: JSON.stringify({ token: randomBytes(TOKEN_BYTES).toString("base64url") }),
		});
	}

	afterAll(async () => {
		// Bukit Katil back to its seeded setting (off), so the suite can run again on the same database.
		await call("PUT", "/admin/feature-flags/till-redemption/overrides", superAdmin, {
			tenantId: TENANT_SEED_IDS.mlkTenant,
			locationId: TENANT_SEED_IDS.mlkLocationKatil,
			enabled: false,
			reason: "Bukit Katil's tills are being replaced this week (e2e)",
		});
		// Put the seeded setting back, so the suite can run again on the same database.
		await call("PUT", "/admin/feature-flags/merchant-invites", superAdmin, { mode: "DEFAULT", percentage: null, reason: "Back to the deployment's own setting (e2e)" });
		await pool.end();
		await app.close();
	});

	it("lists every declared flag with its setting and who changed it, and answers the bare settings", async () => {
		const list = FeatureFlagListSchema.parse(DataSchema.parse((await call("GET", "/admin/feature-flags", superAdmin)).json()).data);
		expect(list.flags.map((flag) => [flag.key, flag.mode])).toStrictEqual([
			["component-gallery", "ON"],
			["merchant-invites", "DEFAULT"],
			["till-redemption", "DEFAULT"],
		]);
		expect(list.flags.at(0)).toMatchObject({ title: "Component gallery", reason: "Everyone on staff uses the gallery now" });
		expect(list.flags.at(0)?.updatedByName).toMatch(/.+/u);

		const settings = FeatureFlagSettingsSchema.parse(DataSchema.parse((await call("GET", "/admin/feature-flags/settings", superAdmin)).json()).data);
		expect(settings.settings).toStrictEqual([
			{ key: "component-gallery", mode: "ON", percentage: null },
			{ key: "merchant-invites", mode: "DEFAULT", percentage: null },
			{ key: "till-redemption", mode: "DEFAULT", percentage: null },
		]);
	});

	it("changes a flag with a reason (audited), and refuses a mismatched percentage or an unknown flag", async () => {
		const changed = await call("PUT", "/admin/feature-flags/merchant-invites", superAdmin, {
			mode: "PERCENTAGE",
			percentage: 25,
			reason: "A quarter of staff try invites first",
		});
		expect(changed.statusCode).toBe(200);
		expect(FeatureFlagSchema.parse(DataSchema.parse(changed.json()).data)).toMatchObject({
			mode: "PERCENTAGE",
			percentage: 25,
			reason: "A quarter of staff try invites first",
		});
		const settings = FeatureFlagSettingsSchema.parse(DataSchema.parse((await call("GET", "/admin/feature-flags/settings", superAdmin)).json()).data);
		expect(settings.settings.find((setting) => setting.key === "merchant-invites")).toStrictEqual({ key: "merchant-invites", mode: "PERCENTAGE", percentage: 25 });

		const correlationId = z.string().parse(changed.headers["x-correlation-id"]);
		await vi.waitFor(async () => {
			const rows = (await pool.query(`SELECT "requestBody" FROM public."AuditLog" WHERE "correlationId" = $1`, [correlationId])).rows;
			expect(rows).toMatchObject([{ requestBody: { mode: "PERCENTAGE", percentage: 25, reason: "A quarter of staff try invites first" } }]);
		}, WAIT);

		expect((await call("PUT", "/admin/feature-flags/merchant-invites", superAdmin, { mode: "ON", percentage: 25, reason: "Everyone gets invites now" })).statusCode).toBe(400);
		expect((await call("PUT", "/admin/feature-flags/not-a-flag", superAdmin, { mode: "ON", percentage: null, reason: "Everyone gets this now" })).statusCode).toBe(400);
	});

	it("is for admin staff only", async () => {
		expect((await call("GET", "/admin/feature-flags/settings", customer)).statusCode).toBeGreaterThanOrEqual(401);
		expect(
			(await call("PUT", "/admin/feature-flags/component-gallery", customer, { mode: "OFF", percentage: null, reason: "Customers can't do this" })).statusCode,
		).toBeGreaterThanOrEqual(401);
	});

	it("lets a branch decide over its merchant: the Bukit Katil till refuses while its branch is off (enhancement 5.11)", async () => {
		const overrides = FeatureFlagStoreOverrideListSchema.parse(
			DataSchema.parse((await call("GET", "/admin/feature-flags/till-redemption/overrides", superAdmin)).json()).data,
		);
		expect(overrides.overrides.map((override) => [override.tenantName, override.locationName, override.enabled])).toStrictEqual([
			["Jonker Street Kitchen", null, true],
			["Jonker Street Kitchen", "Jonker Street Kitchen — Bukit Katil", false],
		]);

		// Off at the branch, though on for the merchant: the till is refused before its code is looked at.
		const refused = await tillPreview();
		expect(refused.statusCode).toBe(403);
		expect(ErrorSchema.parse(refused.json()).error.code).toBe("TILL_REDEMPTION_DISABLED");

		const opened = await call("PUT", "/admin/feature-flags/till-redemption/overrides", superAdmin, {
			tenantId: TENANT_SEED_IDS.mlkTenant,
			locationId: TENANT_SEED_IDS.mlkLocationKatil,
			enabled: true,
			reason: "Bukit Katil's new tills are in",
		});
		const openedSetting = FeatureFlagStoreOverrideSchema.parse(DataSchema.parse(opened.json()).data);
		expect(openedSetting.enabled).toBe(true);
		expect(openedSetting.updatedByName).toMatch(/.+/u);
		// Past the gate now: the made-up code itself is what the till hears about.
		expect(ErrorSchema.parse((await tillPreview()).json()).error.code).not.toBe("TILL_REDEMPTION_DISABLED");
	});

	it("refuses a branch that isn't the merchant's, and removes a setting once", async () => {
		const mismatched = await call("PUT", "/admin/feature-flags/till-redemption/overrides", superAdmin, {
			tenantId: TENANT_SEED_IDS.mlkTenant,
			locationId: TENANT_SEED_IDS.klLocation,
			enabled: false,
			reason: "A KL branch is not Jonker's",
		});
		expect(mismatched.statusCode).toBe(404);
		expect(ErrorSchema.parse(mismatched.json()).error.code).toBe("FEATURE_FLAG_STORE_NOT_FOUND");

		const set = FeatureFlagStoreOverrideSchema.parse(
			DataSchema.parse(
				(
					await call("PUT", "/admin/feature-flags/till-redemption/overrides", superAdmin, {
						tenantId: TENANT_SEED_IDS.klTenant,
						locationId: null,
						enabled: true,
						reason: "Brew & Bean redeems everywhere",
					})
				).json(),
			).data,
		);
		const remove = (): Promise<InjectResponse> =>
			call("POST", `/admin/feature-flags/till-redemption/overrides/${set.id}/remove`, superAdmin, { reason: "Back to the deployment's setting" });
		expect((await remove()).statusCode).toBe(200);
		expect((await remove()).statusCode).toBe(404);
		expect(
			(
				await call("PUT", "/admin/feature-flags/component-gallery/overrides", superAdmin, {
					tenantId: TENANT_SEED_IDS.klTenant,
					locationId: null,
					enabled: true,
					reason: "Not a store flag at all",
				})
			).statusCode,
		).toBe(400);
	});

	it("keeps the per-store settings to staff", async () => {
		expect((await call("GET", "/admin/feature-flags/till-redemption/overrides", customer)).statusCode).toBeGreaterThanOrEqual(401);
	});
});
