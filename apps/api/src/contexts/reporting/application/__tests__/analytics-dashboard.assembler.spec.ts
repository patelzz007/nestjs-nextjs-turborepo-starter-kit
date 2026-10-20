import { DAY_MS, EpochMsSchema } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { selectedAnalyticsLocations } from "../../domain/value-objects/analytics-scope.value-object";
import { AnalyticsDashboardAssembler, AnalyticsMerchantSummaryMissingError, AnalyticsTenantMissingError } from "../assemblers/analytics-dashboard.assembler";
import type { ActivityBucket, ActivityTotals } from "../ports/analytics-facts.port";
import { FrozenClock, InMemoryAnalyticsBreakdowns, InMemoryAnalyticsFacts, InMemoryAnalyticsTenants, InMemorySales } from "./fakes/analytics-read-fakes";

const NOW = Date.UTC(2026, 9, 5, 12);
const ORG_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
const STORE_ID = "7a2b3c4d-5e6f-4a1b-8c9d-0e1f2a3b4c5d";
const OTHER_ORG_ID = "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a";
const USER_ID = "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90";
/** The default range is the 30 days ending now. */
const DEFAULT_RANGE_DAYS = 30;

const EMPTY_TOTALS: ActivityTotals = { salesMinor: 0, bills: 0, averageBillMinor: 0, customers: 0, merchants: 0, claims: 0, redemptions: 0 };

function bucket(startMs: number, values: Partial<ActivityBucket> = {}): ActivityBucket {
	return { startMs, endMs: startMs + DAY_MS, isPartial: false, salesMinor: 0, bills: 0, averageBillMinor: 0, claims: 0, redemptions: 0, ...values };
}

describe("AnalyticsDashboardAssembler", () => {
	let facts: InMemoryAnalyticsFacts;
	let breakdowns: InMemoryAnalyticsBreakdowns;
	let tenants: InMemoryAnalyticsTenants;
	let sales: InMemorySales;
	let assembler: AnalyticsDashboardAssembler;

	beforeEach(() => {
		facts = new InMemoryAnalyticsFacts();
		breakdowns = new InMemoryAnalyticsBreakdowns();
		tenants = new InMemoryAnalyticsTenants();
		sales = new InMemorySales();
		tenants.rows.set(ORG_ID, { slug: "brew-and-bean", displayName: "Brew & Bean", timeZone: "Asia/Kuala_Lumpur" });
		facts.series = [bucket(NOW - 2 * DAY_MS, { salesMinor: 1_000, bills: 1, claims: 2, redemptions: 1 }), bucket(NOW - DAY_MS)];
		facts.totals = {
			current: { ...EMPTY_TOTALS, salesMinor: 1_000, bills: 1, averageBillMinor: 1_000, customers: 1, merchants: 1, claims: 4, redemptions: 1 },
			previous: { ...EMPTY_TOTALS, salesMinor: 500, bills: 1, averageBillMinor: 500, customers: 1, merchants: 1, claims: 2, redemptions: 1 },
		};
		facts.cohortSeries = [{ startMs: NOW - 2 * DAY_MS, newCustomers: 1, returningCustomers: 0 }];
		facts.cohortTotals = { current: { newCustomers: 1, returningCustomers: 0 }, previous: { newCustomers: 0, returningCustomers: 1 } };
		breakdowns.rewards = [{ rewardId: "r", title: "Coffee", claims: 4, redemptions: 1 }];
		breakdowns.methods = [{ method: "MANUAL", redemptions: 1 }];
		assembler = new AnalyticsDashboardAssembler(facts, breakdowns, tenants, sales, new FrozenClock(EpochMsSchema.parse(NOW)));
	});

	describe("merchant", () => {
		it("runs every aggregate with the resolved store scope, in the merchant's zone, over the default 30 days", async () => {
			const locationScope = selectedAnalyticsLocations([STORE_ID]);
			await assembler.merchantDashboard(ORG_ID, locationScope, {});

			const scope = { kind: "tenant", tenantId: ORG_ID, locationScope };
			const window = { fromMs: NOW - DEFAULT_RANGE_DAYS * DAY_MS, toMs: NOW, timeZone: "Asia/Kuala_Lumpur", interval: "day" };
			expect(facts.seriesCalls).toEqual([{ scope, window }]);
			expect(facts.totalsCalls).toEqual([{ scope, range: window, previous: { fromMs: NOW - 2 * DEFAULT_RANGE_DAYS * DAY_MS, toMs: NOW - DEFAULT_RANGE_DAYS * DAY_MS } }]);
			expect(breakdowns.storeCalls).toEqual([{ scope, range: window }]);
			expect(facts.firstBillCalls).toEqual([scope]);
		});

		it("compares the totals with the previous range and lists every redemption method", async () => {
			const { dashboard, subject } = await assembler.merchantDashboard(ORG_ID, selectedAnalyticsLocations([STORE_ID]), {});

			expect(subject).toEqual({ slug: "brew-and-bean", displayName: "Brew & Bean" });
			expect(dashboard.totals.salesMinor).toEqual({ value: 1_000, previous: 500, change: 500, changePercent: 100 });
			expect(dashboard.totals.conversionRate).toEqual({ value: 25, previous: 50, change: -25, changePercent: -50 });
			expect(dashboard.byRedemptionMethod).toEqual([
				{ method: "SCAN", redemptions: 0 },
				{ method: "MANUAL", redemptions: 1 },
			]);
			expect(dashboard.byReward).toEqual([{ rewardId: "r", title: "Coffee", claims: 4, redemptions: 1, conversionRate: 25 }]);
			expect(dashboard.series.map((point) => point.start)).toEqual([NOW - 2 * DAY_MS, NOW - DAY_MS]);
		});

		it("fails loudly, reading no aggregate, when the tenant is gone", async () => {
			await expect(assembler.merchantDashboard(OTHER_ORG_ID, selectedAnalyticsLocations([]), {})).rejects.toBeInstanceOf(AnalyticsTenantMissingError);
			expect(facts.seriesCalls).toHaveLength(0);
			expect(breakdowns.calls).toBe(0);
		});
	});

	describe("admin", () => {
		it("reads the whole platform in UTC and places each cohort on its bucket (zero where none)", async () => {
			const dashboard = await assembler.adminDashboard({ from: NOW - 2 * DAY_MS, to: NOW });

			expect(facts.seriesCalls).toEqual([{ scope: { kind: "platform" }, window: { fromMs: NOW - 2 * DAY_MS, toMs: NOW, timeZone: "UTC", interval: "day" } }]);
			expect(dashboard.series.map((point) => [point.newCustomers, point.returningCustomers])).toEqual([
				[1, 0],
				[0, 0],
			]);
			expect(dashboard.totals.returningCustomers).toEqual({ value: 0, previous: 1, change: -1, changePercent: -100 });
		});
	});

	describe("customer", () => {
		it("reads only the caller's own rows and folds merchants into categories, each with a value per bucket", async () => {
			breakdowns.merchantBuckets = [
				{ tenantId: ORG_ID, startMs: NOW - 2 * DAY_MS, salesMinor: 1_000, bills: 1 },
				{ tenantId: OTHER_ORG_ID, startMs: NOW - DAY_MS, salesMinor: 3_000, bills: 2 },
			];
			sales.summaries = new Map([
				[ORG_ID, { name: "Brew & Bean", category: "cafe" }],
				[OTHER_ORG_ID, { name: "Jonker", category: "cafe" }],
			]);

			const dashboard = await assembler.customerDashboard(USER_ID, {});

			expect(facts.seriesCalls.map((call) => [call.scope, call.window.timeZone])).toEqual([[{ kind: "customer", userId: USER_ID }, "UTC"]]);
			expect(sales.summaryCalls).toEqual([{ tenantIds: [ORG_ID, OTHER_ORG_ID], actorUserId: USER_ID }]);
			expect(dashboard.spendingByMerchant.map((merchant) => merchant.tenantId)).toEqual([OTHER_ORG_ID, ORG_ID]);
			expect(dashboard.spendingByCategory).toEqual([
				{
					category: "cafe",
					totalMinor: 4_000,
					visits: 3,
					series: [
						{ start: NOW - 2 * DAY_MS, totalMinor: 1_000 },
						{ start: NOW - DAY_MS, totalMinor: 3_000 },
					],
				},
			]);
		});

		it("lists every claim status and compares the caller's own referral activity with the previous range", async () => {
			facts.claimStatuses = [
				{ status: "EXPIRED", claims: 1 },
				{ status: "PENDING", claims: 3 },
			];
			facts.referralTotals = { current: { sent: 4, credited: 2, rewardsEarned: 2 }, previous: { sent: 2, credited: 0, rewardsEarned: 0 } };

			const dashboard = await assembler.customerDashboard(USER_ID, {});

			const window = { fromMs: NOW - DEFAULT_RANGE_DAYS * DAY_MS, toMs: NOW, timeZone: "UTC", interval: "day" };
			expect(facts.claimStatusCalls).toEqual([{ userId: USER_ID, range: window }]);
			expect(facts.referralCalls).toEqual([
				{ userId: USER_ID, range: window, previous: { fromMs: NOW - 2 * DEFAULT_RANGE_DAYS * DAY_MS, toMs: NOW - DEFAULT_RANGE_DAYS * DAY_MS } },
			]);
			expect(dashboard.claimsByStatus).toEqual([
				{ status: "PENDING", claims: 3 },
				{ status: "REDEEMED", claims: 0 },
				{ status: "EXPIRED", claims: 1 },
			]);
			expect(dashboard.totals.referralsSent).toEqual({ value: 4, previous: 2, change: 2, changePercent: 100 });
			expect(dashboard.totals.referralsCredited).toEqual({ value: 2, previous: 0, change: 2, changePercent: null });
			expect(dashboard.totals.referralRewardsEarned.value).toBe(2);
		});

		it("fails loudly when a merchant the customer paid cannot be named", async () => {
			breakdowns.merchantBuckets = [{ tenantId: ORG_ID, startMs: NOW - DAY_MS, salesMinor: 1_000, bills: 1 }];

			await expect(assembler.customerDashboard(USER_ID, {})).rejects.toBeInstanceOf(AnalyticsMerchantSummaryMissingError);
		});
	});
});
