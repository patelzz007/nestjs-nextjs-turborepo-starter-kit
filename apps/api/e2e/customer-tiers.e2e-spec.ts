import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { CommandBus } from "@nestjs/cqrs";
import {
	AdminUserTierSchema,
	API_VERSION_PREFIX,
	DEFAULT_TIER_RULES,
	MyTierSchema,
	RewardResponseSchema,
	TierAvailabilitySchema,
	TierDistributionSchema,
	TierSettingsResponseSchema,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { deterministicUuid } from "../prisma/seed/deterministic-uuid";
import { TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { systemActor } from "../src/platform/application/actor-context";
import { ReviewCustomerTiersCommand, type TierReviewResult } from "../src/contexts/tiers/application/commands/review-customer-tiers/review-customer-tiers.command";
import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DataSchema = z.object({ data: z.looseObject({}) });
const ItemsSchema = z.object({ data: z.array(z.looseObject({ id: z.string() })) });
const ErrorSchema = z.object({ error: z.object({ code: z.string() }) });
const REASON = "Tightening Gold after the first quarter (e2e)";
/** A stored standing as the idempotency check compares it (timestamps as text, so bigint columns compare exactly). */
const StandingRowsSchema = z.array(z.object({ userId: z.string(), tier: z.string(), demotionDueAt: z.string().nullable(), holdUntil: z.string().nullable() }));
type StandingRow = z.output<typeof StandingRowsSchema>[number];
const CountRowsSchema = z.array(z.object({ n: z.coerce.number() }));

/** Seeded running rewards (analytics-history.ts) and the minimum tier customer-tiers.ts gave them. */
const GOLD_REWARD_ID = deterministicUuid("reward-seed-history-reward", "mlk-heritage-set");
const DIAMOND_REWARD_ID = deterministicUuid("reward-seed-history-reward", "mlk-beruang-brunch");
const OPEN_REWARD_ID = deterministicUuid("reward-seed-history-reward", "kl-morning-brew");

/** ADR 085: customer tiers over the real API and the seeded database. */
describe("Customer tiers (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let customer: LoginResult;
	let klOwner: LoginResult;
	let customerId: string;

	function call(method: "GET" | "PUT" | "POST", path: string, session: LoginResult | null, payload?: object): Promise<InjectResponse> {
		const auth: Record<string, string> = { "x-forwarded-for": uniqueClientIp(), ...(session === null ? {} : { authorization: `Bearer ${session.accessToken}` }) };
		return app.inject({
			method,
			url: `${API_VERSION_PREFIX}${path}`,
			headers: method === "GET" ? auth : mutationHeaders(auth),
			...(payload === undefined ? {} : { payload }),
		});
	}

	function setTiersFlag(mode: "DEFAULT" | "OFF"): Promise<InjectResponse> {
		return call("PUT", "/admin/feature-flags/customer-tiers", superAdmin, { mode, percentage: null, reason: `Customer tiers ${mode} for the e2e suite` });
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, ["superadmin@example.com", "alice.johnson@example.com"]);
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		customer = await login(app, "alice.johnson@example.com", "Alice@123");
		klOwner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		const row = await pool.query(`SELECT id FROM public."User" WHERE email = $1 AND "isDeleted" = false`, ["alice.johnson@example.com"]);
		customerId = z.object({ id: z.string() }).array().length(1).parse(row.rows).at(0)?.id ?? "";
	});

	afterAll(async () => {
		// Back to the seeded state, so the suite can run again on the same database.
		await setTiersFlag("DEFAULT");
		await call("PUT", "/admin/tiers/settings", superAdmin, { ...DEFAULT_TIER_RULES, reason: "Back to the launch rules (e2e)" });
		await call("PUT", `/tenants/${TENANT_SEED_SLUGS.kl}/rewards/${OPEN_REWARD_ID}/minimum-tier`, klOwner, { minimumTier: "BRONZE" });
		await pool.end();
		await app.close();
	});

	it("says tiers are on, to anyone, with the caller's tier: Bronze signed out, the stored one signed in", async () => {
		const response = await call("GET", "/tiers/availability", null);
		expect(response.statusCode).toBe(200);
		expect(response.headers["cache-control"]).toBe("private, no-store, max-age=0");
		expect(TierAvailabilitySchema.parse(DataSchema.parse(response.json()).data)).toStrictEqual({ enabled: true, viewerTier: "BRONZE" });
		const signedIn = TierAvailabilitySchema.parse(DataSchema.parse((await call("GET", "/tiers/availability", customer)).json()).data);
		const stored = await pool.query(`SELECT tier FROM public."CustomerTierStanding" WHERE "userId" = $1 AND "isDeleted" = false`, [customerId]);
		expect(signedIn).toStrictEqual({ enabled: true, viewerTier: z.object({ tier: z.string() }).array().parse(stored.rows).at(0)?.tier ?? "BRONZE" });
	});

	it("shows the customer their own tier page, matching their stored standing", async () => {
		const response = await call("GET", "/tiers/me", customer);
		expect(response.statusCode, response.body).toBe(200);
		const page = MyTierSchema.parse(DataSchema.parse(response.json()).data);
		const stored = await pool.query(`SELECT tier FROM public."CustomerTierStanding" WHERE "userId" = $1 AND "isDeleted" = false`, [customerId]);
		expect(page.tier).toBe(z.object({ tier: z.string() }).array().parse(stored.rows).at(0)?.tier ?? "BRONZE");
		expect(page.rules).toStrictEqual(DEFAULT_TIER_RULES);
		expect(page.merchants.every((merchant) => merchant.counted <= DEFAULT_TIER_RULES.perMerchantCap)).toBe(true);
	});

	it("lists only the rewards the viewer's tier reaches, and the locked ones too when asked", async () => {
		const plain = ItemsSchema.parse((await call("GET", "/rewards?limit=100", null)).json()).data.map((reward) => reward.id);
		expect(plain).not.toContain(GOLD_REWARD_ID);
		expect(plain).not.toContain(DIAMOND_REWARD_ID);
		const withLocked = ItemsSchema.parse((await call("GET", "/rewards?limit=100&includeLocked=true", null)).json()).data;
		const gold = withLocked.find((reward) => reward.id === GOLD_REWARD_ID);
		expect(RewardResponseSchema.parse(gold).minimumTier).toBe("GOLD");
		// A signed-out visitor is Bronze: every reward they can claim comes before every locked one.
		const lockedFlags = withLocked.map((reward): boolean => RewardResponseSchema.parse(reward).minimumTier !== "BRONZE");
		expect(lockedFlags).toStrictEqual([...lockedFlags].sort((left: boolean, right: boolean): number => Number(left) - Number(right)));
		expect(lockedFlags).toContain(true);
		expect(lockedFlags).toContain(false);
	});

	it("refuses a claim code for a reward above the customer's tier, holding nothing", async () => {
		const before = await pool.query(`SELECT "quantityRemaining" FROM public."Reward" WHERE id = $1`, [DIAMOND_REWARD_ID]);
		const response = await call("POST", "/claims/otp", customer, { rewardId: DIAMOND_REWARD_ID, phone: "+60123459999" });
		expect(response.statusCode).toBe(403);
		expect(ErrorSchema.parse(response.json()).error.code).toBe("REWARD_TIER_LOCKED");
		const after = await pool.query(`SELECT "quantityRemaining" FROM public."Reward" WHERE id = $1`, [DIAMOND_REWARD_ID]);
		expect(after.rows).toStrictEqual(before.rows);
	});

	it("lets a merchant change a published reward's minimum tier without another review", async () => {
		const response = await call("PUT", `/tenants/${TENANT_SEED_SLUGS.kl}/rewards/${OPEN_REWARD_ID}/minimum-tier`, klOwner, { minimumTier: "GOLD" });
		expect(response.statusCode).toBe(200);
		expect(RewardResponseSchema.parse(DataSchema.parse(response.json()).data)).toMatchObject({ minimumTier: "GOLD", status: "PUBLISHED" });
	});

	it("keeps the tier rules for platform staff: readable, changed with a reason, refused when they do not rise", async () => {
		const settings = await call("GET", "/admin/tiers/settings", superAdmin);
		expect(settings.statusCode, settings.body).toBe(200);
		const read = TierSettingsResponseSchema.parse(DataSchema.parse(settings.json()).data);
		expect(read).toMatchObject(DEFAULT_TIER_RULES);

		const changed = await call("PUT", "/admin/tiers/settings", superAdmin, { ...DEFAULT_TIER_RULES, goldThreshold: 30, reason: REASON });
		expect(changed.statusCode).toBe(200);
		expect(TierSettingsResponseSchema.parse(DataSchema.parse(changed.json()).data)).toMatchObject({ goldThreshold: 30, reason: REASON });

		const flat = await call("PUT", "/admin/tiers/settings", superAdmin, { ...DEFAULT_TIER_RULES, goldThreshold: 5, reason: REASON });
		expect(flat.statusCode).toBe(400);
		expect((await call("GET", "/admin/tiers/settings", customer)).statusCode).toBe(403);
	});

	it("gives platform staff the distribution and one customer's tier, read-only", async () => {
		const distribution = TierDistributionSchema.parse(DataSchema.parse((await call("GET", "/admin/tiers/distribution", superAdmin)).json()).data);
		expect(Object.values(distribution.counts).reduce((sum, count) => sum + count, 0)).toBe(distribution.total);
		const tier = await call("GET", `/admin/users/${customerId}/tier`, superAdmin);
		expect(tier.statusCode).toBe(200);
		expect(AdminUserTierSchema.parse(DataSchema.parse(tier.json()).data).history.every((change) => change.toTier !== change.fromTier)).toBe(true);
	});

	it("runs the nightly review idempotently: a second run changes nothing", async () => {
		const bus = app.get(CommandBus);
		const run = (): Promise<TierReviewResult> => bus.execute(new ReviewCustomerTiersCommand(systemActor("tiers.standing.evaluate", "cron", null, "e2e nightly review", null)));
		await run();
		const snapshot = async (): Promise<StandingRow[]> =>
			StandingRowsSchema.parse(
				(
					await pool.query(
						`SELECT "userId", tier, "demotionDueAt"::text AS "demotionDueAt", "holdUntil"::text AS "holdUntil" FROM public."CustomerTierStanding" WHERE "isDeleted" = false ORDER BY "userId"`,
					)
				).rows,
			);
		const changes = async (): Promise<number> => CountRowsSchema.parse((await pool.query(`SELECT count(*) AS n FROM public."CustomerTierChange"`)).rows).at(0)?.n ?? 0;
		const [standingsAfterFirst, changesAfterFirst] = [await snapshot(), await changes()];
		await run();
		expect(await snapshot()).toStrictEqual(standingsAfterFirst);
		expect(await changes()).toBe(changesAfterFirst);
	});

	it("hides every tier page while tiers are off, and opens every reward", async () => {
		expect((await setTiersFlag("OFF")).statusCode).toBe(200);
		expect(TierAvailabilitySchema.parse(DataSchema.parse((await call("GET", "/tiers/availability", null)).json()).data)).toStrictEqual({ enabled: false });
		const page = await call("GET", "/tiers/me", customer);
		expect(page.statusCode).toBe(404);
		expect(ErrorSchema.parse(page.json()).error.code).toBe("TIERS_DISABLED");
		const plain = ItemsSchema.parse((await call("GET", "/rewards?limit=100", null)).json()).data.map((reward) => reward.id);
		expect(plain).toContain(GOLD_REWARD_ID);
		await setTiersFlag("DEFAULT");
	});
});
