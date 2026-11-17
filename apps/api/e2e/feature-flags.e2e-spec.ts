import { randomBytes, randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	ChangeFlagGroupMembersResultSchema,
	DEVICE_ID_HEADER,
	ExperimentListSchema,
	ExposureBatchResultSchema,
	FeatureFlagBundleSchema,
	FeatureFlagSummaryListSchema,
	FlagCheckResultSchema,
	FlagGroupSchema,
	FlagOverrideSchema,
	KillSwitchStateSchema,
	PromotionFileSchema,
	RevisionSchema,
	type FeatureFlagBundle,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { DEMO_MERCHANT_API_KEYS } from "../prisma/seed/rewards";
import { TENANT_SEED_IDS } from "../prisma/seed/tenant-seed-ids";
import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DataSchema = z.object({ data: z.looseObject({}) });
const ErrorSchema = z.object({ error: z.object({ code: z.string() }) });
const WAIT = { timeout: 20_000, interval: 100 };
const KATIL_TERMINAL = "MLK-KATIL-01";
/** A redemption token's size, as the claims issue them. */
const TOKEN_BYTES = 32;

function data<T>(schema: z.ZodType<T>, response: InjectResponse): T {
	return schema.parse(DataSchema.parse(response.json()).data);
}

function flagOn(bundle: FeatureFlagBundle, key: string): boolean | undefined {
	return bundle.flags.find((flag) => flag.key === key)?.on;
}

/** Feature flags v2 (ADR 087) over the real API and database, on the seeded catalogue (`prisma/seed/feature-flags.ts`). */
describe("Feature flags v2 (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let admin: LoginResult;
	let customer: LoginResult;

	function call(method: "GET" | "PUT" | "POST", path: string, session: LoginResult | null, payload?: object, extra: Record<string, string> = {}): Promise<InjectResponse> {
		const auth = { ...(session === null ? {} : { authorization: `Bearer ${session.accessToken}` }), "x-forwarded-for": uniqueClientIp(), ...extra };
		return app.inject({
			method,
			url: `${API_VERSION_PREFIX}${path}`,
			headers: method === "GET" ? auth : mutationHeaders(auth),
			...(payload === undefined ? {} : { payload }),
		});
	}

	/** The Bukit Katil till (seeded key and terminal) previewing a well-formed but unknown code. */
	function tillPreview(): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/integration/redemptions/validate`,
			headers: { "x-api-key": DEMO_MERCHANT_API_KEYS.mlk, "x-terminal-id": KATIL_TERMINAL, "content-type": "application/json" },
			payload: JSON.stringify({ token: randomBytes(TOKEN_BYTES).toString("base64url") }),
		});
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, ["superadmin@example.com", "admin@example.com", "alice.johnson@example.com"]);
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		admin = await login(app, "admin@example.com", "Admin@123", "admin");
		customer = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		// Everything this suite changed goes back to its seeded state, so it can run again on the same database.
		await call("PUT", "/admin/feature-flags/merchant-invites/kill-switch", superAdmin, { on: false, reason: "Released again after the e2e run" });
		await call("PUT", "/admin/feature-flags/till-redemption/overrides", superAdmin, {
			unit: "LOCATION",
			subjectId: TENANT_SEED_IDS.mlkLocationKatil,
			on: false,
			reason: "Bukit Katil's tills are being replaced this week (e2e)",
		});
		await pool.end();
		await app.close();
	});

	it("lists every declared flag with its live revision, kill switch and overrides", async () => {
		const list = data(FeatureFlagSummaryListSchema, await call("GET", "/admin/feature-flags", superAdmin));
		expect(list.flags.map((flag) => flag.key)).toStrictEqual([
			"showcase",
			"merchant-invites",
			"till-redemption",
			"customer-tiers",
			"merchant-analytics",
			"web-activity",
			"mobile-analytics",
		]);
		const showcase = list.flags.find((flag) => flag.key === "showcase");
		expect(showcase).toMatchObject({ defaultOn: false, liveRevision: 2, ruleCount: 1 });
		expect(list.flags.find((flag) => flag.key === "till-redemption")?.overrideCount).toBeGreaterThanOrEqual(2);
	});

	it("answers each app only its own flags, worked out by the API (rules never leave it)", async () => {
		const deviceId = randomUUID();
		const web = data(FeatureFlagBundleSchema, await call("GET", "/feature-flags/bundle?app=web", null, undefined, { [DEVICE_ID_HEADER]: deviceId }));
		expect(web.flags.map((flag) => flag.key)).toStrictEqual(["web-activity"]);
		expect(flagOn(web, "web-activity")).toBe(true);
		expect(web.configs.map((config) => config.key)).toStrictEqual(["reward-claim-cta"]);
		expect(JSON.stringify(web)).not.toContain("conditions");

		const adminBundle = data(FeatureFlagBundleSchema, await call("GET", "/feature-flags/bundle?app=admin", superAdmin));
		// The seeded rule turns the showcase on outside production (this run's environment is development).
		expect(adminBundle.flags.find((flag) => flag.key === "showcase")).toMatchObject({ on: true, source: "RULE", revision: 2 });
		expect(adminBundle.flags.some((flag) => flag.key === "till-redemption")).toBe(false);
	});

	it("throws a kill switch at once (no approval) and the bundle follows", async () => {
		const thrown = await call("PUT", "/admin/feature-flags/merchant-invites/kill-switch", superAdmin, { on: true, reason: "Invite emails are bouncing (e2e)" });
		expect(data(KillSwitchStateSchema, thrown)).toMatchObject({ on: true, reason: "Invite emails are bouncing (e2e)" });
		const bundle = data(FeatureFlagBundleSchema, await call("GET", "/feature-flags/bundle?app=admin", superAdmin));
		expect(bundle.flags.find((flag) => flag.key === "merchant-invites")).toMatchObject({ on: false, source: "KILL_SWITCH" });

		const correlationId = z.string().parse(thrown.headers["x-correlation-id"]);
		await vi.waitFor(async () => {
			const rows = (await pool.query(`SELECT "requestBody" FROM public."AuditLog" WHERE "correlationId" = $1`, [correlationId])).rows;
			expect(rows).toMatchObject([{ requestBody: { on: true, reason: "Invite emails are bouncing (e2e)" } }]);
		}, WAIT);
	});

	it("saves rules as a new revision, and refuses a save based on a revision that's no longer live", async () => {
		const stale = await call("POST", "/admin/feature-flags/customer-tiers/revisions", superAdmin, { rules: [], reason: "Based on an old revision (e2e)", basedOn: 99 });
		expect(stale.statusCode).toBe(409);
		expect(ErrorSchema.parse(stale.json()).error.code).toBe("FEATURE_FLAG_REVISION_CONFLICT");

		const before =
			data(FeatureFlagSummaryListSchema, await call("GET", "/admin/feature-flags", superAdmin)).flags.find((flag) => flag.key === "customer-tiers")?.liveRevision ?? null;
		const saved = await call("POST", "/admin/feature-flags/customer-tiers/revisions", superAdmin, {
			rules: [],
			reason: "No rules: the code default decides (e2e)",
			basedOn: before,
		});
		expect(saved.statusCode).toBe(201);
		expect(data(RevisionSchema, saved)).toMatchObject({ status: "LIVE", source: "CONSOLE" });

		const unknownGroup = await call("POST", "/admin/feature-flags/customer-tiers/revisions", superAdmin, {
			rules: [
				{
					id: randomUUID(),
					name: "Nobody",
					conditions: [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "no-such-group" }],
					rollout: { kind: "FIXED", percentage: 100 },
				},
			],
			reason: "Names a group that doesn't exist (e2e)",
			basedOn: data(RevisionSchema, saved).number,
		});
		expect(unknownGroup.statusCode).toBe(422);
	});

	it("lets a location override decide over its tenant's: the Bukit Katil till refuses while it's off", async () => {
		const refused = await tillPreview();
		expect(refused.statusCode).toBe(403);
		expect(ErrorSchema.parse(refused.json()).error.code).toBe("TILL_REDEMPTION_DISABLED");

		const opened = await call("PUT", "/admin/feature-flags/till-redemption/overrides", superAdmin, {
			unit: "LOCATION",
			subjectId: TENANT_SEED_IDS.mlkLocationKatil,
			on: true,
			reason: "Bukit Katil's new tills are in (e2e)",
		});
		expect(data(FlagOverrideSchema, opened)).toMatchObject({ unit: "LOCATION", on: true });
		expect(ErrorSchema.parse((await tillPreview()).json()).error.code).not.toBe("TILL_REDEMPTION_DISABLED");
	});

	it("explains a decision step by step (Check a subject)", async () => {
		const developer = await pool.query(`SELECT id FROM public."User" WHERE email = 'developer@example.com'`);
		const userId = z.object({ id: z.string() }).parse(developer.rows.at(0)).id;
		const checked = await call("POST", "/admin/feature-flags/web-activity/check", superAdmin, {
			subject: { userId, tenantId: null, locationId: null, deviceId: null, app: "web", platform: "web", appVersion: null, locale: null },
		});
		const result = data(FlagCheckResultSchema, checked);
		expect(result.result).toMatchObject({ on: true, source: "OVERRIDE_USER" });
		expect(result.trace.map((step) => step.step)).toStrictEqual(["KILL_SWITCH", "OVERRIDE"]);
	});

	it("records exposures only for subjects the API can name (a signed-out visitor counts for device flags only)", async () => {
		const exposure = { kind: "FLAG", key: "web-activity", on: true, source: "RULE", revision: 1, ruleId: null, at: Date.now() };
		const signedOut = await call("POST", "/feature-flags/exposures", null, { app: "web", exposures: [exposure] }, { [DEVICE_ID_HEADER]: randomUUID() });
		expect(data(ExposureBatchResultSchema, signedOut)).toStrictEqual({ accepted: 0, ignored: 1 });
		const signedIn = await call("POST", "/feature-flags/exposures", customer, { app: "web", exposures: [exposure] });
		expect(data(ExposureBatchResultSchema, signedIn)).toStrictEqual({ accepted: 1, ignored: 0 });
		// A flag the app never receives is ignored, whoever sends it.
		const foreign = await call("POST", "/feature-flags/exposures", customer, { app: "web", exposures: [{ ...exposure, key: "showcase" }] });
		expect(data(ExposureBatchResultSchema, foreign)).toStrictEqual({ accepted: 0, ignored: 1 });
	});

	it("keeps a listed group's members real, and a group rules name can't be removed", async () => {
		const created = await call("POST", "/admin/flag-groups", admin, {
			key: `e2e-${randomUUID().slice(0, 8)}`,
			name: "E2E testers",
			description: "Made by the e2e suite",
			definition: { kind: "LIST", unit: "USER" },
			reason: "A group for the e2e run",
		});
		expect(created.statusCode).toBe(201);
		const group = data(FlagGroupSchema, created);
		const unknown = await call("POST", `/admin/flag-groups/${group.id}/members`, admin, { action: "ADD", subjectIds: [randomUUID()], reason: "Someone who doesn't exist" });
		expect(unknown.statusCode).toBe(422);
		const developer = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'developer@example.com'`)).rows.at(0)).id;
		const added = await call("POST", `/admin/flag-groups/${group.id}/members`, admin, { action: "ADD", subjectIds: [developer, developer], reason: "The developer joins" });
		expect(data(ChangeFlagGroupMembersResultSchema, added)).toStrictEqual({ changed: 1, memberCount: 1 });
		expect((await call("POST", `/admin/flag-groups/${group.id}/remove`, admin, { reason: "Done with the e2e group" })).statusCode).toBe(200);

		const betaTesters = z
			.object({ id: z.string() })
			.parse((await pool.query(`SELECT id FROM public."FlagGroup" WHERE key = 'beta-testers' AND "isDeleted" = false`)).rows.at(0)).id;
		const inUse = await call("POST", `/admin/flag-groups/${betaTesters}/remove`, admin, { reason: "Rules still name it" });
		expect(inUse.statusCode).toBe(409);
		expect(ErrorSchema.parse(inUse.json()).error.code).toBe("FLAG_GROUP_IN_USE");
	});

	it("plans experiments only on values the config has", async () => {
		const list = data(ExperimentListSchema, await call("GET", "/admin/experiments", admin));
		expect(list.experiments.map((experiment) => experiment.status)).toContain("RUNNING");
		const invalid = await call("POST", "/admin/experiments", admin, {
			key: `e2e-${randomUUID().slice(0, 8)}`,
			configKey: "reward-claim-cta",
			name: "Unknown value",
			hypothesis: "A value the config doesn't have",
			trafficPercentage: 10,
			variants: [
				{ valueName: "standard", allocation: 50 },
				{ valueName: "neon", allocation: 50 },
			],
			controlValueName: "standard",
			primaryMetric: "reward-claims",
			guardrailMetrics: [],
			plannedEndAt: null,
			reason: "Should be refused (e2e)",
		});
		expect(invalid.statusCode).toBe(422);
		expect(ErrorSchema.parse(invalid.json()).error.code).toBe("EXPERIMENT_PLAN_INVALID");
	});

	it("exports a live revision, and refuses to import it into the environment it came from", async () => {
		const file = data(PromotionFileSchema, await call("GET", "/admin/feature-flags/promotion/export?kind=FLAG&key=web-activity", admin));
		expect(file).toMatchObject({ kind: "FLAG", key: "web-activity", environment: "development", listedGroupKeys: ["beta-testers"] });
		const imported = await call("POST", "/admin/feature-flags/promotion/import", admin, { file, reason: "Same environment (e2e)" });
		expect(imported.statusCode).toBe(422);
		expect(ErrorSchema.parse(imported.json()).error.code).toBe("PROMOTION_INVALID");
	});

	it("is for platform staff only", async () => {
		expect((await call("GET", "/admin/feature-flags", customer)).statusCode).toBeGreaterThanOrEqual(401);
		expect((await call("PUT", "/admin/feature-flags/showcase/kill-switch", customer, { on: true, reason: "Customers can't do this" })).statusCode).toBeGreaterThanOrEqual(401);
		expect((await call("GET", "/admin/flag-groups", customer)).statusCode).toBeGreaterThanOrEqual(401);
		expect((await call("GET", "/admin/experiments", customer)).statusCode).toBeGreaterThanOrEqual(401);
	});
});
