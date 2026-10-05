import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	AdminAnalyticsDashboardSchema,
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	CustomerAnalyticsDashboardSchema,
	MAX_ANALYTICS_RANGE_DAYS,
	MerchantAnalyticsDashboardSchema,
	OrganizationContextResponseSchema,
	type AnalyticsBucket,
} from "@workspace/shared";

import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { createE2eApp, login, markSeedUserEmailVerified, parseSuccessEnvelope, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** Kuala Lumpur / Melaka: UTC+8, no DST. */
const KL_OFFSET_MS = 8 * HOUR_MS;
/** Local midnight in KL of a calendar day, as epoch ms. */
const klMidnight = (year: number, monthIndex: number, day: number): number => Date.UTC(year, monthIndex, day) - KL_OFFSET_MS;

const KATIL = ORGANIZATION_SEED_IDS.mlkLocationKatil;
const BERUANG = ORGANIZATION_SEED_IDS.mlkLocationBeruang;

/**
 * A quiet stretch of 2020 (before any seeded history) holds this file's own
 * bills at exact bucket edges, so placement is checked to the millisecond.
 */
const FIXTURE_TERMINAL = "E2E-ANALYTICS-TILL";
/** 2020-03-01 23:30 in KL (15:30 UTC): KL's Mar 1 — also UTC's Mar 1. */
const KL_LATE_MAR_1 = klMidnight(2020, 2, 1) + 23 * HOUR_MS + 30 * 60_000;
/** 2020-03-02 00:30 in KL (2020-03-01 16:30 UTC): KL's Mar 2, but still UTC's Mar 1. */
const KL_EARLY_MAR_2 = klMidnight(2020, 2, 2) + 30 * 60_000;
/** 2020-03-02 09:00 in KL (01:00 UTC): Mar 2 in both zones. */
const KL_MORNING_MAR_2 = klMidnight(2020, 2, 2) + 9 * HOUR_MS;
const FIXTURE_BILLS: readonly { readonly paidAt: number; readonly locationId: string; readonly billTotalMinor: number }[] = [
	{ paidAt: KL_LATE_MAR_1, locationId: KATIL, billTotalMinor: 1_000 },
	{ paidAt: KL_EARLY_MAR_2, locationId: KATIL, billTotalMinor: 2_000 },
	{ paidAt: KL_MORNING_MAR_2, locationId: BERUANG, billTotalMinor: 4_000 },
];

/** Alice's own claims in the quiet March 2020 range: status, and whether it is a referrer credit. */
const FIXTURE_CLAIMS: readonly { readonly claimedAt: number; readonly status: "PENDING" | "REDEEMED" | "EXPIRED"; readonly isReferrerCredit: boolean }[] = [
	{ claimedAt: Date.UTC(2020, 2, 1, 10), status: "PENDING", isReferrerCredit: false },
	{ claimedAt: Date.UTC(2020, 2, 1, 11), status: "REDEEMED", isReferrerCredit: false },
	{ claimedAt: Date.UTC(2020, 2, 2, 10), status: "EXPIRED", isReferrerCredit: false },
	{ claimedAt: Date.UTC(2020, 2, 2, 11), status: "EXPIRED", isReferrerCredit: false },
	// The reward her credited referral earned her.
	{ claimedAt: Date.UTC(2020, 2, 3, 9), status: "PENDING", isReferrerCredit: true },
	// Just before the range: counted for neither status nor rewards earned of March.
	{ claimedAt: Date.UTC(2020, 1, 29, 23), status: "PENDING", isReferrerCredit: false },
];

/** Alice's referrals: two started in March (one credited in March), one started in the previous range. */
const FIXTURE_REFERRALS: readonly { readonly createdAt: number; readonly status: "PENDING" | "CREDITED"; readonly creditedAt: number | null }[] = [
	{ createdAt: Date.UTC(2020, 2, 2, 8), status: "CREDITED", creditedAt: Date.UTC(2020, 2, 3, 8) },
	{ createdAt: Date.UTC(2020, 2, 2, 9), status: "PENDING", creditedAt: null },
	{ createdAt: Date.UTC(2020, 1, 28, 9), status: "PENDING", creditedAt: null },
];

describe("Analytics dashboards (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let cashier: LoginResult;
	let superAdmin: LoginResult;
	let alice: LoginResult;
	const saleIds: string[] = [];
	const claimIds: string[] = [];
	const referralIds: string[] = [];

	function merchantGet(session: LoginResult, path: string): Promise<InjectResponse> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.mlk}/analytics${path}`,
			headers: { cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" },
		});
	}

	function webGet(session: LoginResult | null, url: string): Promise<InjectResponse> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}${url}`,
			headers: session === null ? {} : { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}` },
		});
	}

	function errorOf(response: InjectResponse): { readonly code: string; readonly message: string; readonly issues: string } {
		const { error } = ApiErrorResponseSchema.parse(response.json());
		return { code: error.code, message: error.message, issues: JSON.stringify(error.details ?? {}) };
	}

	function sumOf<TPoint>(points: readonly TPoint[], value: (point: TPoint) => number): number {
		return points.reduce((total, point) => total + value(point), 0);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		await markSeedUserEmailVerified(pool, "bob.smith@example.com");
		const [aliceRow] = (await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", ["alice.johnson@example.com"])).rows;
		for (const bill of FIXTURE_BILLS) {
			const saleId = randomUUID();
			saleIds.push(saleId);
			await pool.query(
				`INSERT INTO public.reward_sales (id, organization_id, location_id, user_id, terminal_id, bill_total_minor, currency, idempotency_key, request_hash, paid_at)
				 VALUES ($1, $2, $3, $4, $5, $6, 'MYR', $7, $8, $9)`,
				[saleId, ORGANIZATION_SEED_IDS.mlkOrganization, bill.locationId, aliceRow?.id, FIXTURE_TERMINAL, bill.billTotalMinor, randomUUID(), saleId, bill.paidAt],
			);
		}
		const [rewardRow] = (
			await pool.query<{ id: string }>("SELECT id FROM public.rewards WHERE organization_id = $1 AND is_deleted = false ORDER BY id LIMIT 1", [
				ORGANIZATION_SEED_IDS.mlkOrganization,
			])
		).rows;
		for (const claim of FIXTURE_CLAIMS) {
			const claimId = randomUUID();
			claimIds.push(claimId);
			await pool.query(
				`INSERT INTO public.reward_claims (id, user_id, reward_id, redemption_token_hash, backup_code_hash, status, is_referrer_credit, claimed_at, claim_expires_at)
				 VALUES ($1, $2, $3, $4, $5, $6::"RewardClaimStatus", $7, $8, $9)`,
				[
					claimId,
					aliceRow?.id,
					rewardRow?.id,
					`e2e-token-${claimId}`,
					`e2e-backup-${claimId}`,
					claim.status,
					claim.isReferrerCredit,
					claim.claimedAt,
					claim.claimedAt + DAY_MS,
				],
			);
		}
		for (const referral of FIXTURE_REFERRALS) {
			const referralId = randomUUID();
			referralIds.push(referralId);
			await pool.query(
				`INSERT INTO public.reward_referrals (id, referrer_user_id, reward_id, attribution_token, status, credited_at, created_at)
				 VALUES ($1, $2, $3, $4, $5::"RewardReferralStatus", $6, $7)`,
				[referralId, aliceRow?.id, rewardRow?.id, `e2e-${referralId.slice(0, 32)}`, referral.status, referral.creditedAt, referral.createdAt],
			);
		}
		owner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
		cashier = await login(app, "jonker.cashier@melaka-rewards.demo", "JonkerCashier@123", "merchant");
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		await pool.query("DELETE FROM public.reward_sales WHERE id = ANY($1::text[])", [saleIds]);
		await pool.query("DELETE FROM public.reward_claims WHERE id = ANY($1::text[])", [claimIds]);
		await pool.query("DELETE FROM public.reward_referrals WHERE id = ANY($1::text[])", [referralIds]);
		await pool.end();
		await app.close();
	});

	describe("merchant", () => {
		it("names the organization's zone in its context — the zone the dashboard is cut in", async () => {
			const context = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.mlk}/context`,
				headers: { cookie: `merchantAccessToken=${owner.accessToken}; merchantRefreshToken=${owner.refreshToken}`, "x-client-type": "merchant" },
			});
			const dashboard = parseSuccessEnvelope(await merchantGet(owner, "/dashboard"), MerchantAnalyticsDashboardSchema).data;

			expect(context.statusCode, context.body).toBe(200);
			expect(parseSuccessEnvelope(context, OrganizationContextResponseSchema).data.organization.timeZone).toBe("Asia/Kuala_Lumpur");
			expect(dashboard.range.timeZone).toBe("Asia/Kuala_Lumpur");
		});

		it("buckets bills by the merchant's LOCAL day (Asia/Kuala_Lumpur), every day present, totals = the sum of the series", async () => {
			const from = klMidnight(2020, 2, 1);
			const to = klMidnight(2020, 2, 4);
			const response = await merchantGet(owner, `/dashboard?from=${String(from)}&to=${String(to)}&interval=day`);

			expect(response.statusCode, response.body).toBe(200);
			const dashboard = parseSuccessEnvelope(response, MerchantAnalyticsDashboardSchema).data;
			expect(dashboard.range).toMatchObject({ from, to, timeZone: "Asia/Kuala_Lumpur", interval: "day", previousFrom: from - 3 * DAY_MS, previousTo: from });
			expect(dashboard.series.map((point) => [point.start, point.end, point.isPartial])).toEqual([
				[klMidnight(2020, 2, 1), klMidnight(2020, 2, 2), false],
				[klMidnight(2020, 2, 2), klMidnight(2020, 2, 3), false],
				[klMidnight(2020, 2, 3), klMidnight(2020, 2, 4), false],
			]);
			expect(dashboard.series.map((point) => point.salesMinor)).toEqual([1_000, 6_000, 0]);
			expect(dashboard.series.map((point) => point.bills)).toEqual([1, 2, 0]);
			expect(dashboard.series.map((point) => point.averageBillMinor)).toEqual([1_000, 3_000, 0]);
			expect(dashboard.totals.salesMinor).toEqual({ value: 7_000, previous: 0, change: 7_000, changePercent: null });
			expect(dashboard.totals.bills.value).toBe(sumOf(dashboard.series, (point) => point.bills));
			expect(dashboard.totals.customers.value).toBe(1);
		});

		it("clips the first and last bucket to the range and marks them partial", async () => {
			const from = klMidnight(2020, 2, 1) + 12 * HOUR_MS;
			const to = klMidnight(2020, 2, 2) + 6 * HOUR_MS;
			const dashboard = parseSuccessEnvelope(await merchantGet(owner, `/dashboard?from=${String(from)}&to=${String(to)}&interval=day`), MerchantAnalyticsDashboardSchema).data;

			expect(dashboard.series.map((point: AnalyticsBucket) => [point.start, point.end, point.isPartial])).toEqual([
				[from, klMidnight(2020, 2, 2), true],
				[klMidnight(2020, 2, 2), to, true],
			]);
		});

		it("lists every store of the owner's organization; a store-limited cashier sees only Bukit Beruang", async () => {
			const range = `from=${String(klMidnight(2020, 2, 1))}&to=${String(klMidnight(2020, 2, 4))}`;
			const everything = parseSuccessEnvelope(await merchantGet(owner, `/dashboard?${range}`), MerchantAnalyticsDashboardSchema).data;
			const scoped = parseSuccessEnvelope(await merchantGet(cashier, `/dashboard?${range}`), MerchantAnalyticsDashboardSchema).data;

			expect(everything.byStore.map((store) => store.locationId)).toEqual(expect.arrayContaining([KATIL, BERUANG]));
			expect(everything.byStore.find((store) => store.locationId === KATIL)?.salesMinor).toBe(3_000);
			expect(scoped.byStore.map((store) => store.locationId)).toEqual([BERUANG]);
			expect(scoped.totals.salesMinor.value).toBe(4_000);
			expect(sumOf(scoped.series, (point) => point.salesMinor)).toBe(4_000);
		});

		it("refuses another store named explicitly to a store-limited cashier", async () => {
			const response = await merchantGet(cashier, `/dashboard?locationId=${KATIL}`);

			expect(response.statusCode).toBe(403);
		});

		it("defaults to the last 30 days in daily buckets and shows the seeded year of activity with every breakdown", async () => {
			const dashboard = parseSuccessEnvelope(await merchantGet(owner, "/dashboard"), MerchantAnalyticsDashboardSchema).data;

			expect(dashboard.range.interval).toBe("day");
			expect(dashboard.range.to - dashboard.range.from).toBe(30 * DAY_MS);
			expect(dashboard.series.length).toBeGreaterThanOrEqual(30);
			expect(dashboard.totals.bills.value).toBeGreaterThan(0);
			expect(dashboard.byReward.length).toBeGreaterThan(0);
			expect(dashboard.byRedemptionMethod.map((row) => row.method)).toEqual(["SCAN", "MANUAL"]);
			expect(sumOf(dashboard.byRedemptionMethod, (row) => row.redemptions)).toBe(dashboard.totals.redemptions.value);
			expect(sumOf(dashboard.series, (point) => point.claims)).toBe(dashboard.totals.claims.value);
		});

		it("derives monthly buckets for a year and rejects a range over the limit or with from ≥ to (400, naming the limit)", async () => {
			const to = klMidnight(2026, 9, 1);
			const year = parseSuccessEnvelope(
				await merchantGet(owner, `/dashboard?from=${String(to - MAX_ANALYTICS_RANGE_DAYS * DAY_MS)}&to=${String(to)}`),
				MerchantAnalyticsDashboardSchema,
			).data;
			expect(year.range.interval).toBe("month");
			expect(year.series.length).toBe(13);

			const tooLong = await merchantGet(owner, `/dashboard?from=${String(to - (MAX_ANALYTICS_RANGE_DAYS + 1) * DAY_MS)}&to=${String(to)}`);
			expect(tooLong.statusCode).toBe(400);
			expect(errorOf(tooLong).issues).toContain(String(MAX_ANALYTICS_RANGE_DAYS));

			const backwards = await merchantGet(owner, `/dashboard?from=${String(to)}&to=${String(to - DAY_MS)}`);
			expect(backwards.statusCode).toBe(400);
		});
	});

	describe("admin", () => {
		it("buckets the platform in UTC (the 00:30-KL bill falls on UTC's Mar 1) and answers every breakdown", async () => {
			const from = Date.UTC(2020, 2, 1);
			const to = Date.UTC(2020, 2, 3);
			const response = await webGet(superAdmin, `/admin/analytics/dashboard?from=${String(from)}&to=${String(to)}&interval=day`);

			expect(response.statusCode, response.body).toBe(200);
			const dashboard = parseSuccessEnvelope(response, AdminAnalyticsDashboardSchema).data;
			expect(dashboard.range.timeZone).toBe("UTC");
			expect(dashboard.series.map((point) => point.salesMinor)).toEqual([3_000, 4_000]);
			expect(dashboard.byCity).toEqual([{ city: "MELAKA", salesMinor: 7_000, bills: 3, merchants: 1 }]);
			expect(dashboard.topMerchants.map((merchant) => merchant.organizationId)).toEqual([ORGANIZATION_SEED_IDS.mlkOrganization]);
			expect(dashboard.byCategory).toEqual([{ category: "restaurant", salesMinor: 7_000, bills: 3, merchants: 1 }]);
			// Alice's first bill ever is this fixture's (2020): she is NEW on Mar 1, RETURNING on Mar 2.
			expect(dashboard.series.map((point) => [point.newCustomers, point.returningCustomers])).toEqual([
				[1, 0],
				[0, 1],
			]);
			expect(dashboard.totals.newCustomers.value + dashboard.totals.returningCustomers.value).toBe(dashboard.totals.customers.value);
		});

		it("shows top merchants, categories and cities of the seeded year", async () => {
			const dashboard = parseSuccessEnvelope(await webGet(superAdmin, "/admin/analytics/dashboard?interval=week"), AdminAnalyticsDashboardSchema).data;

			expect(dashboard.topMerchants.map((merchant) => merchant.organizationId)).toEqual(
				expect.arrayContaining([ORGANIZATION_SEED_IDS.klOrganization, ORGANIZATION_SEED_IDS.mlkOrganization]),
			);
			expect(dashboard.byCity.map((row) => row.city)).toEqual(expect.arrayContaining(["KUALA_LUMPUR", "MELAKA"]));
			expect(dashboard.byCategory.length).toBeGreaterThanOrEqual(2);
			expect(dashboard.totals.activeMerchants.value).toBeGreaterThanOrEqual(2);
		});

		it("refuses a customer (403) and an anonymous caller (401)", async () => {
			expect((await webGet(alice, "/admin/analytics/dashboard")).statusCode).toBe(403);
			expect((await webGet(null, "/admin/analytics/dashboard")).statusCode).toBe(401);
		});
	});

	describe("customer", () => {
		it("shows the customer's own spending by category and merchant, each with a value per bucket", async () => {
			const from = Date.UTC(2020, 2, 1);
			const to = Date.UTC(2020, 2, 4);
			const response = await webGet(alice, `/claims/analytics/dashboard?from=${String(from)}&to=${String(to)}&interval=day`);

			expect(response.statusCode, response.body).toBe(200);
			const dashboard = parseSuccessEnvelope(response, CustomerAnalyticsDashboardSchema).data;
			expect(dashboard.totals.spentMinor.value).toBe(7_000);
			expect(dashboard.totals.merchants.value).toBe(1);
			expect(dashboard.spendingByMerchant).toEqual([
				expect.objectContaining({ organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, totalMinor: 7_000, visits: 3, category: "restaurant" }),
			]);
			expect(dashboard.spendingByMerchant[0]?.series.map((point) => point.totalMinor)).toEqual([3_000, 4_000, 0]);
			expect(dashboard.spendingByCategory.map((category) => category.series.length)).toEqual([dashboard.series.length]);
		});

		it("counts the caller's own claims by status and referral activity of the range in SQL, against the previous range", async () => {
			const from = Date.UTC(2020, 2, 1);
			const to = Date.UTC(2020, 2, 4);
			const dashboard = parseSuccessEnvelope(
				await webGet(alice, `/claims/analytics/dashboard?from=${String(from)}&to=${String(to)}&interval=day`),
				CustomerAnalyticsDashboardSchema,
			).data;

			expect(dashboard.claimsByStatus).toEqual([
				{ status: "PENDING", claims: 2 },
				{ status: "REDEEMED", claims: 1 },
				{ status: "EXPIRED", claims: 2 },
			]);
			expect(dashboard.totals.claims.value).toBe(5);
			expect(dashboard.totals.referralsSent).toEqual({ value: 2, previous: 1, change: 1, changePercent: 100 });
			expect(dashboard.totals.referralsCredited).toEqual({ value: 1, previous: 0, change: 1, changePercent: null });
			expect(dashboard.totals.referralRewardsEarned).toEqual({ value: 1, previous: 0, change: 1, changePercent: null });
		});

		it("never counts another customer's claims or referrals", async () => {
			const bob = await login(app, "bob.smith@example.com", "Bob@123");
			const dashboard = parseSuccessEnvelope(
				await webGet(bob, `/claims/analytics/dashboard?from=${String(Date.UTC(2020, 2, 1))}&to=${String(Date.UTC(2020, 2, 4))}`),
				CustomerAnalyticsDashboardSchema,
			).data;

			expect(dashboard.claimsByStatus.map((row) => row.claims)).toEqual([0, 0, 0]);
			expect(dashboard.totals.referralsSent.value).toBe(0);
			expect(dashboard.totals.referralRewardsEarned.value).toBe(0);
		});

		it("counts the seeded claims and redemptions of the last year", async () => {
			const to = Date.now();
			const dashboard = parseSuccessEnvelope(
				await webGet(alice, `/claims/analytics/dashboard?from=${String(to - 365 * DAY_MS)}&to=${String(to)}`),
				CustomerAnalyticsDashboardSchema,
			).data;

			expect(dashboard.range.interval).toBe("month");
			expect(dashboard.totals.redemptions.value).toBeGreaterThan(0);
			expect(sumOf(dashboard.spendingByCategory, (category) => category.totalMinor)).toBe(dashboard.totals.spentMinor.value);
		});

		it("requires a session", async () => {
			expect((await webGet(null, "/claims/analytics/dashboard")).statusCode).toBe(401);
		});
	});
});
