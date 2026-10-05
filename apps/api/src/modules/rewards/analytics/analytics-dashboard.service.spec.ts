import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DAY_MS, MERCHANT_CAPABILITY } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { RewardSaleRepository } from "../repositories/reward-sale.repository";
import { MerchantContextService } from "../services/merchant-context.service";
import { selectedLocationsScope } from "../types/merchant-location-scope";
import { AnalyticsBreakdownRepository } from "./analytics-breakdown.repository";
import { ANALYTICS_CLOCK, AnalyticsDashboardService, AnalyticsMerchantSummaryMissingError, type AnalyticsClock } from "./analytics-dashboard.service";
import { AnalyticsFactsRepository, type ActivityBucket, type ActivityTotals } from "./analytics-facts.repository";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = Date.UTC(2026, 9, 5, 12);
const ORG_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
const STORE_ID = "7a2b3c4d-5e6f-4a1b-8c9d-0e1f2a3b4c5d";
const OTHER_ORG_ID = "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a";
const USER_ID = "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90";

const ACTOR: MerchantActor = { kind: "user", userId: USER_ID, organizationId: ORG_ID, orgSlug: "brew" };

const EMPTY_TOTALS: ActivityTotals = { salesMinor: 0, bills: 0, averageBillMinor: 0, customers: 0, merchants: 0, claims: 0, redemptions: 0 };

function bucket(startMs: number, values: Partial<ActivityBucket> = {}): ActivityBucket {
	return { startMs, endMs: startMs + DAY_MS, isPartial: false, salesMinor: 0, bills: 0, averageBillMinor: 0, claims: 0, redemptions: 0, ...values };
}

describe("AnalyticsDashboardService", () => {
	let service: AnalyticsDashboardService;
	const facts = {
		activitySeries: vi.fn<AnalyticsFactsRepository["activitySeries"]>(),
		activityTotals: vi.fn<AnalyticsFactsRepository["activityTotals"]>(),
		firstBillAt: vi.fn<AnalyticsFactsRepository["firstBillAt"]>(),
		customerCohortSeries: vi.fn<AnalyticsFactsRepository["customerCohortSeries"]>(),
		customerCohortTotals: vi.fn<AnalyticsFactsRepository["customerCohortTotals"]>(),
		customerClaimStatuses: vi.fn<AnalyticsFactsRepository["customerClaimStatuses"]>(),
		customerReferralTotals: vi.fn<AnalyticsFactsRepository["customerReferralTotals"]>(),
	};
	const breakdowns = {
		byStore: vi.fn<AnalyticsBreakdownRepository["byStore"]>(),
		byReward: vi.fn<AnalyticsBreakdownRepository["byReward"]>(),
		byRedemptionMethod: vi.fn<AnalyticsBreakdownRepository["byRedemptionMethod"]>(),
		byMerchant: vi.fn<AnalyticsBreakdownRepository["byMerchant"]>(),
		byCategory: vi.fn<AnalyticsBreakdownRepository["byCategory"]>(),
		byCity: vi.fn<AnalyticsBreakdownRepository["byCity"]>(),
		merchantBucketSales: vi.fn<AnalyticsBreakdownRepository["merchantBucketSales"]>(),
	};
	const merchantContext = {
		requireActorCapability: vi.fn<MerchantContextService["requireActorCapability"]>(),
		resolveLocationScope: vi.fn<MerchantContextService["resolveLocationScope"]>(),
	};
	const organizations = { findById: vi.fn<OrganizationRepository["findById"]>() };
	const sales = { listMerchantSummaries: vi.fn<RewardSaleRepository["listMerchantSummaries"]>() };
	const clock: AnalyticsClock = { nowEpochMs: (): number => NOW };

	beforeEach(async () => {
		vi.clearAllMocks();
		merchantContext.requireActorCapability.mockResolvedValue(undefined);
		merchantContext.resolveLocationScope.mockResolvedValue(selectedLocationsScope([STORE_ID]));
		organizations.findById.mockResolvedValue({
			id: ORG_ID,
			slug: "brew-and-bean",
			displayName: "Brew & Bean",
			lifecycleState: "ACTIVE",
			timeZone: "Asia/Kuala_Lumpur",
			deletionGraceEndsAt: null,
			isDeleted: false,
			deletedAt: null,
			createdAt: 0n,
			updatedAt: 0n,
			merchantProfile: null,
		});
		facts.activitySeries.mockResolvedValue([bucket(NOW - 2 * DAY_MS, { salesMinor: 1_000, bills: 1, claims: 2, redemptions: 1 }), bucket(NOW - DAY_MS)]);
		facts.activityTotals.mockResolvedValue({
			current: { ...EMPTY_TOTALS, salesMinor: 1_000, bills: 1, averageBillMinor: 1_000, customers: 1, merchants: 1, claims: 4, redemptions: 1 },
			previous: { ...EMPTY_TOTALS, salesMinor: 500, bills: 1, averageBillMinor: 500, customers: 1, merchants: 1, claims: 2, redemptions: 1 },
		});
		facts.firstBillAt.mockResolvedValue(null);
		facts.customerCohortSeries.mockResolvedValue([{ startMs: NOW - 2 * DAY_MS, newCustomers: 1, returningCustomers: 0 }]);
		facts.customerCohortTotals.mockResolvedValue({ current: { newCustomers: 1, returningCustomers: 0 }, previous: { newCustomers: 0, returningCustomers: 1 } });
		facts.customerClaimStatuses.mockResolvedValue([]);
		facts.customerReferralTotals.mockResolvedValue({ current: { sent: 0, credited: 0, rewardsEarned: 0 }, previous: { sent: 0, credited: 0, rewardsEarned: 0 } });
		breakdowns.byStore.mockResolvedValue([]);
		breakdowns.byReward.mockResolvedValue([{ rewardId: "r", title: "Coffee", claims: 4, redemptions: 1 }]);
		breakdowns.byRedemptionMethod.mockResolvedValue([{ method: "MANUAL", redemptions: 1 }]);
		breakdowns.byMerchant.mockResolvedValue([]);
		breakdowns.byCategory.mockResolvedValue([]);
		breakdowns.byCity.mockResolvedValue([]);
		breakdowns.merchantBucketSales.mockResolvedValue([]);
		sales.listMerchantSummaries.mockResolvedValue(new Map());

		const moduleRef = await Test.createTestingModule({
			providers: [
				AnalyticsDashboardService,
				{ provide: AnalyticsFactsRepository, useValue: facts },
				{ provide: AnalyticsBreakdownRepository, useValue: breakdowns },
				{ provide: MerchantContextService, useValue: merchantContext },
				{ provide: OrganizationRepository, useValue: organizations },
				{ provide: RewardSaleRepository, useValue: sales },
				{ provide: ANALYTICS_CLOCK, useValue: clock },
			],
		}).compile();
		service = moduleRef.get(AnalyticsDashboardService);
	});

	describe("merchant", () => {
		it("checks the analytics capability before reading anything, and reads nothing when it is denied", async () => {
			merchantContext.requireActorCapability.mockRejectedValueOnce(new ForbiddenException());

			await expect(service.getMerchantDashboard(ACTOR, {})).rejects.toBeInstanceOf(ForbiddenException);
			expect(merchantContext.requireActorCapability).toHaveBeenCalledWith(ACTOR, MERCHANT_CAPABILITY.viewAnalytics);
			expect(facts.activitySeries).not.toHaveBeenCalled();
			expect(breakdowns.byStore).not.toHaveBeenCalled();
		});

		it("runs every aggregate with the caller's resolved store scope, in the merchant's zone, over the default 30 days", async () => {
			await service.getMerchantDashboard(ACTOR, { locationId: STORE_ID });

			expect(merchantContext.resolveLocationScope).toHaveBeenCalledWith(ACTOR, STORE_ID);
			const scope = { kind: "organization", organizationId: ORG_ID, locationScope: selectedLocationsScope([STORE_ID]) };
			const window = { fromMs: NOW - 30 * DAY_MS, toMs: NOW, timeZone: "Asia/Kuala_Lumpur", interval: "day" };
			expect(facts.activitySeries).toHaveBeenCalledWith(scope, window);
			expect(facts.activityTotals).toHaveBeenCalledWith(scope, window, { fromMs: NOW - 60 * DAY_MS, toMs: NOW - 30 * DAY_MS });
			expect(breakdowns.byStore).toHaveBeenCalledWith(scope, window);
			expect(facts.firstBillAt).toHaveBeenCalledWith(scope);
		});

		it("compares the totals with the previous range and lists every redemption method", async () => {
			const { dashboard, subject } = await service.buildMerchantDashboard(ACTOR, {});

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
	});

	describe("admin", () => {
		it("reads the whole platform in UTC and places each cohort on its bucket (zero where none)", async () => {
			const dashboard = await service.getAdminDashboard({ from: NOW - 2 * DAY_MS, to: NOW });

			expect(facts.activitySeries).toHaveBeenCalledWith({ kind: "platform" }, { fromMs: NOW - 2 * DAY_MS, toMs: NOW, timeZone: "UTC", interval: "day" });
			expect(dashboard.series.map((point) => [point.newCustomers, point.returningCustomers])).toEqual([
				[1, 0],
				[0, 0],
			]);
			expect(dashboard.totals.returningCustomers).toEqual({ value: 0, previous: 1, change: -1, changePercent: -100 });
		});
	});

	describe("customer", () => {
		it("reads only the caller's own rows and folds merchants into categories, each with a value per bucket", async () => {
			breakdowns.merchantBucketSales.mockResolvedValue([
				{ organizationId: ORG_ID, startMs: NOW - 2 * DAY_MS, salesMinor: 1_000, bills: 1 },
				{ organizationId: OTHER_ORG_ID, startMs: NOW - DAY_MS, salesMinor: 3_000, bills: 2 },
			]);
			sales.listMerchantSummaries.mockResolvedValue(
				new Map([
					[ORG_ID, { name: "Brew & Bean", category: "cafe" }],
					[OTHER_ORG_ID, { name: "Jonker", category: "cafe" }],
				]),
			);

			const dashboard = await service.getCustomerDashboard(USER_ID, {});

			expect(facts.activitySeries).toHaveBeenCalledWith({ kind: "customer", userId: USER_ID }, expect.objectContaining({ timeZone: "UTC" }));
			expect(sales.listMerchantSummaries).toHaveBeenCalledWith([ORG_ID, OTHER_ORG_ID], USER_ID);
			expect(dashboard.spendingByMerchant.map((merchant) => merchant.organizationId)).toEqual([OTHER_ORG_ID, ORG_ID]);
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
			breakdowns.merchantBucketSales.mockResolvedValue([]);
			sales.listMerchantSummaries.mockResolvedValue(new Map());
			facts.customerClaimStatuses.mockResolvedValue([
				{ status: "EXPIRED", claims: 1 },
				{ status: "PENDING", claims: 3 },
			]);
			facts.customerReferralTotals.mockResolvedValue({ current: { sent: 4, credited: 2, rewardsEarned: 2 }, previous: { sent: 2, credited: 0, rewardsEarned: 0 } });

			const dashboard = await service.getCustomerDashboard(USER_ID, {});

			const window = { fromMs: NOW - 30 * DAY_MS, toMs: NOW, timeZone: "UTC", interval: "day" };
			expect(facts.customerClaimStatuses).toHaveBeenCalledWith(USER_ID, window);
			expect(facts.customerReferralTotals).toHaveBeenCalledWith(USER_ID, window, { fromMs: NOW - 60 * DAY_MS, toMs: NOW - 30 * DAY_MS });
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
			breakdowns.merchantBucketSales.mockResolvedValue([{ organizationId: ORG_ID, startMs: NOW - DAY_MS, salesMinor: 1_000, bills: 1 }]);

			await expect(service.getCustomerDashboard(USER_ID, {})).rejects.toBeInstanceOf(AnalyticsMerchantSummaryMissingError);
		});
	});
});
