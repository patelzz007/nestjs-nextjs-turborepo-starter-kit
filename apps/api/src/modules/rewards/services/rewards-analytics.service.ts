import { Injectable } from "@nestjs/common";
import type { Prisma, RewardClaimStatus } from "@prisma/client";

import type {
	AdminSalesAnalyticsQuery,
	AdminSalesAnalyticsResponse,
	MerchantAnalyticsResponse,
	MerchantBusinessCategory,
	RewardsAnalyticsQuery,
	SalesSummary,
	UserRewardsAnalyticsResponse,
	UserSpendByCategory,
	UserSpendingSummary,
} from "@workspace/shared";
import { DEFAULT_SALE_CURRENCY, EpochMsSchema } from "@workspace/shared";

import { RewardClaimRepository } from "../repositories/reward-claim.repository";
import { RewardRedemptionRepository } from "../repositories/reward-redemption.repository";
import { RewardReferralRepository } from "../repositories/reward-referral.repository";
import { RewardRepository } from "../repositories/reward.repository";
import { RewardSaleRepository, type SalesScope } from "../repositories/reward-sale.repository";
import {
	averageBillMinor,
	buildAnalyticsMetric,
	buildWeeklySalesSeries,
	buildWeeklyTimeSeries,
	conversionRatePercent,
	percentChange,
	previousAnalyticsPeriod,
	resolveAnalyticsPeriod,
	type AnalyticsPeriod,
} from "../utils/rewards-analytics.util";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { MerchantContextService } from "./merchant-context.service";

/** Merchants listed in a user's "where you spent the most". */
const USER_TOP_SPEND_MERCHANTS = 5;

/** Merchants listed in the admin's top-sellers table. */
const ADMIN_TOP_MERCHANTS = 10;

/** Shown if a merchant row vanished between the sales query and the name lookup. */
const UNKNOWN_MERCHANT_NAME = "Merchant";

@Injectable()
export class RewardsAnalyticsService {
	public constructor(
		private readonly rewardRepository: RewardRepository,
		private readonly rewardClaimRepository: RewardClaimRepository,
		private readonly redemptionRepository: RewardRedemptionRepository,
		private readonly rewardReferralRepository: RewardReferralRepository,
		private readonly merchantContext: MerchantContextService,
		private readonly saleRepository: RewardSaleRepository,
	) {}

	public async getMerchantAnalytics(actor: MerchantActor, query: RewardsAnalyticsQuery): Promise<MerchantAnalyticsResponse> {
		await this.merchantContext.requireActorCapability(actor, "merchant:view_analytics");
		const orgId = actor.organizationId;
		const locationId = await this.merchantContext.resolveLocationFilter(actor, query.locationId);
		const period = resolveAnalyticsPeriod(query.from, query.to);
		const previous = previousAnalyticsPeriod(period);

		const rewardWhere: Prisma.RewardWhereInput = { organizationId: orgId, isDeleted: false, rewardKind: "CONSUMER" };

		const [
			totalRewards,
			activeRewards,
			rewardsCreatedCurrent,
			rewardsCreatedPrevious,
			publishedCurrent,
			publishedPrevious,
			claimRows,
			redemptionRows,
			referralCurrent,
			referralPrevious,
			rewardTitles,
			sales,
		] = await Promise.all([
			this.rewardRepository.count(rewardWhere),
			this.rewardRepository.count({ ...rewardWhere, status: "PUBLISHED" }),
			this.rewardRepository.count({ ...rewardWhere, createdAt: { gte: period.fromMs, lte: period.toMs } }),
			this.rewardRepository.count({ ...rewardWhere, createdAt: { gte: previous.fromMs, lte: previous.toMs } }),
			this.rewardRepository.count({ ...rewardWhere, status: "PUBLISHED", reviewedAt: { gte: period.fromMs, lte: period.toMs } }),
			this.rewardRepository.count({ ...rewardWhere, status: "PUBLISHED", reviewedAt: { gte: previous.fromMs, lte: previous.toMs } }),
			this.rewardClaimRepository.listForMerchantAnalytics(orgId, { gte: previous.fromMs, lte: period.toMs }),
			this.redemptionRepository.listForMerchantAnalytics(orgId, { gte: previous.fromMs, lte: period.toMs }, locationId),
			this.rewardReferralRepository.countByMerchantOrg(orgId, { gte: period.fromMs, lte: period.toMs }),
			this.rewardReferralRepository.countByMerchantOrg(orgId, { gte: previous.fromMs, lte: previous.toMs }),
			this.rewardRepository.listIdAndTitle(rewardWhere),
			this.buildSalesSummary({ organizationId: orgId, locationId }, period),
		]);

		const currentClaims = claimRows.filter((row) => {
			const claimedAt = Number(row.claimedAt);
			return claimedAt >= period.fromMs && claimedAt <= period.toMs;
		});
		const previousClaims = claimRows.filter((row) => {
			const claimedAt = Number(row.claimedAt);
			return claimedAt >= previous.fromMs && claimedAt <= previous.toMs;
		});

		const currentRedemptions = redemptionRows.filter((row) => {
			const redeemedAt = Number(row.redeemedAt);
			return redeemedAt >= period.fromMs && redeemedAt <= period.toMs;
		});
		const previousRedemptions = redemptionRows.filter((row) => {
			const redeemedAt = Number(row.redeemedAt);
			return redeemedAt >= previous.fromMs && redeemedAt <= previous.toMs;
		});

		const titleByRewardId = new Map(rewardTitles.map((row) => [row.id, row.title]));
		const topRewardMap = new Map<string, { claims: number; redemptions: number }>();

		for (const claim of currentClaims) {
			const entry = topRewardMap.get(claim.rewardId) ?? { claims: 0, redemptions: 0 };
			entry.claims += 1;
			topRewardMap.set(claim.rewardId, entry);
		}

		for (const redemption of currentRedemptions) {
			const rewardId = redemption.claim.rewardId;
			const entry = topRewardMap.get(rewardId) ?? { claims: 0, redemptions: 0 };
			entry.redemptions += 1;
			topRewardMap.set(rewardId, entry);
		}

		const currentConversion = conversionRatePercent(currentClaims.length, currentRedemptions.length);
		const previousConversion = conversionRatePercent(previousClaims.length, previousRedemptions.length);

		return {
			period: { from: EpochMsSchema.parse(period.fromMs), to: EpochMsSchema.parse(period.toMs) },
			totalRewards: { value: totalRewards, changePercent: percentChange(rewardsCreatedCurrent, rewardsCreatedPrevious) },
			activeRewards: { value: activeRewards, changePercent: percentChange(publishedCurrent, publishedPrevious) },
			totalClaims: buildAnalyticsMetric(currentClaims.length, previousClaims.length),
			totalRedemptions: buildAnalyticsMetric(currentRedemptions.length, previousRedemptions.length),
			conversionRate: buildAnalyticsMetric(currentConversion, previousConversion),
			referralCount: buildAnalyticsMetric(referralCurrent, referralPrevious),
			claimsOverTime: [
				...buildWeeklyTimeSeries(
					period,
					currentClaims.map((row) => Number(row.claimedAt)),
					currentRedemptions.map((row) => Number(row.redeemedAt)),
				),
			].map((point) => ({ ...point, date: EpochMsSchema.parse(point.date) })),
			topRewards: [...topRewardMap.entries()]
				.map(([rewardId, counts]) => ({
					rewardId,
					title: titleByRewardId.get(rewardId) ?? "Reward",
					claims: counts.claims,
					redemptions: counts.redemptions,
				}))
				.sort((left, right) => right.claims + right.redemptions - (left.claims + left.redemptions))
				.slice(0, 8),
			sales,
		};
	}

	public async getUserAnalytics(userId: string, query: RewardsAnalyticsQuery): Promise<UserRewardsAnalyticsResponse> {
		const period = resolveAnalyticsPeriod(query.from, query.to);
		const previous = previousAnalyticsPeriod(period);

		const [claimRows, referralRows, spending] = await Promise.all([
			this.rewardClaimRepository.listForUserAnalytics(userId, { gte: previous.fromMs, lte: period.toMs }),
			this.rewardReferralRepository.listForReferrerAnalytics(userId, { gte: previous.fromMs, lte: period.toMs }),
			this.buildSpendingSummary(userId, period),
		]);

		const currentClaims = claimRows.filter((row) => {
			const claimedAt = Number(row.claimedAt);
			return claimedAt >= period.fromMs && claimedAt <= period.toMs;
		});
		const previousClaims = claimRows.filter((row) => {
			const claimedAt = Number(row.claimedAt);
			return claimedAt >= previous.fromMs && claimedAt <= previous.toMs;
		});

		const currentReferrals = referralRows.filter((row) => {
			const createdAt = Number(row.createdAt);
			return createdAt >= period.fromMs && createdAt <= period.toMs;
		});
		const previousReferrals = referralRows.filter((row) => {
			const createdAt = Number(row.createdAt);
			return createdAt >= previous.fromMs && createdAt <= previous.toMs;
		});

		const countByStatus = (rows: readonly { status: "PENDING" | "REDEEMED" | "EXPIRED" }[], status: "PENDING" | "REDEEMED" | "EXPIRED"): number =>
			rows.filter((row) => row.status === status).length;

		const currentPending = countByStatus(currentClaims, "PENDING");
		const currentRedeemed = countByStatus(currentClaims, "REDEEMED");
		const currentExpired = countByStatus(currentClaims, "EXPIRED");
		const previousPending = countByStatus(previousClaims, "PENDING");
		const previousRedeemed = countByStatus(previousClaims, "REDEEMED");
		const previousExpired = countByStatus(previousClaims, "EXPIRED");

		const currentReferralsCredited = currentReferrals.filter((row) => row.status === "CREDITED").length;
		const previousReferralsCredited = previousReferrals.filter((row) => row.status === "CREDITED").length;

		const redemptionTimestamps = currentClaims.flatMap((row) => (row.status === "REDEEMED" && row.redeemedAt !== null ? [Number(row.redeemedAt)] : []));
		const currentConversion = conversionRatePercent(currentClaims.length, currentRedeemed);
		const previousConversion = conversionRatePercent(previousClaims.length, previousRedeemed);

		const claimStatuses: readonly RewardClaimStatus[] = ["PENDING", "REDEEMED", "EXPIRED"];
		const statusCounts = new Map<RewardClaimStatus, number>();
		for (const claim of currentClaims) {
			statusCounts.set(claim.status, (statusCounts.get(claim.status) ?? 0) + 1);
		}

		return {
			period: { from: EpochMsSchema.parse(period.fromMs), to: EpochMsSchema.parse(period.toMs) },
			totalClaims: buildAnalyticsMetric(currentClaims.length, previousClaims.length),
			pendingClaims: buildAnalyticsMetric(currentPending, previousPending),
			redeemedClaims: buildAnalyticsMetric(currentRedeemed, previousRedeemed),
			expiredClaims: buildAnalyticsMetric(currentExpired, previousExpired),
			referralsSent: buildAnalyticsMetric(currentReferrals.length, previousReferrals.length),
			referralsCredited: buildAnalyticsMetric(currentReferralsCredited, previousReferralsCredited),
			conversionRate: buildAnalyticsMetric(currentConversion, previousConversion),
			claimsOverTime: [
				...buildWeeklyTimeSeries(
					period,
					currentClaims.map((row) => Number(row.claimedAt)),
					redemptionTimestamps,
				),
			].map((point) => ({ ...point, date: EpochMsSchema.parse(point.date) })),
			byStatus: claimStatuses.map((status) => ({
				status,
				count: statusCounts.get(status) ?? 0,
			})),
			spending,
		};
	}

	/** Platform-wide paid bills for `GET /admin/analytics/sales` (the controller enforces `ANALYTICS:READ`). */
	public async getAdminSalesAnalytics(actorUserId: string, query: AdminSalesAnalyticsQuery): Promise<AdminSalesAnalyticsResponse> {
		const period = resolveAnalyticsPeriod(query.from, query.to);
		const previous = previousAnalyticsPeriod(period);
		const range = { gte: period.fromMs, lte: period.toMs };

		const [sales, topMerchants, activeNow, activeBefore] = await Promise.all([
			this.buildSalesSummary({}, period),
			this.saleRepository.groupByOrganization({}, range, ADMIN_TOP_MERCHANTS),
			this.saleRepository.countOrganizations(range),
			this.saleRepository.countOrganizations({ gte: previous.fromMs, lte: previous.toMs }),
		]);
		const merchants = await this.saleRepository.listMerchantSummaries(
			topMerchants.map((group) => group.organizationId),
			actorUserId,
		);

		return {
			period: { from: EpochMsSchema.parse(period.fromMs), to: EpochMsSchema.parse(period.toMs) },
			sales,
			activeMerchants: buildAnalyticsMetric(activeNow, activeBefore),
			topMerchants: topMerchants.map((group) => ({
				organizationId: group.organizationId,
				name: merchants.get(group.organizationId)?.name ?? UNKNOWN_MERCHANT_NAME,
				category: merchants.get(group.organizationId)?.category ?? null,
				salesMinor: group.totalMinor,
				bills: group.bills,
			})),
		};
	}

	/** Paid-bill totals for `scope` in `period`, compared with the previous period of equal length. */
	private async buildSalesSummary(scope: SalesScope, period: AnalyticsPeriod): Promise<SalesSummary> {
		const previous = previousAnalyticsPeriod(period);
		const range = { gte: period.fromMs, lte: period.toMs };
		const [current, prior, points] = await Promise.all([
			this.saleRepository.aggregate(scope, range),
			this.saleRepository.aggregate(scope, { gte: previous.fromMs, lte: previous.toMs }),
			this.saleRepository.listPoints(scope, range),
		]);

		return {
			currency: DEFAULT_SALE_CURRENCY,
			totalSalesMinor: buildAnalyticsMetric(current.totalMinor, prior.totalMinor),
			bills: buildAnalyticsMetric(current.bills, prior.bills),
			averageBillMinor: buildAnalyticsMetric(averageBillMinor(current.totalMinor, current.bills), averageBillMinor(prior.totalMinor, prior.bills)),
			overTime: buildWeeklySalesSeries(period, points).map((point) => ({ ...point, date: EpochMsSchema.parse(point.date) })),
		};
	}

	/** Where (merchant) and on what (merchant category) the user spent, from the bills of their redeemed rewards. */
	private async buildSpendingSummary(userId: string, period: AnalyticsPeriod): Promise<UserSpendingSummary> {
		const previous = previousAnalyticsPeriod(period);
		const range = { gte: period.fromMs, lte: period.toMs };
		const [current, prior, byOrganization] = await Promise.all([
			this.saleRepository.aggregate({ userId }, range),
			this.saleRepository.aggregate({ userId }, { gte: previous.fromMs, lte: previous.toMs }),
			this.saleRepository.groupByOrganization({ userId }, range),
		]);
		const merchants = await this.saleRepository.listMerchantSummaries(
			byOrganization.map((group) => group.organizationId),
			userId,
		);

		const byMerchant = byOrganization.map((group) => ({
			organizationId: group.organizationId,
			merchantName: merchants.get(group.organizationId)?.name ?? UNKNOWN_MERCHANT_NAME,
			category: merchants.get(group.organizationId)?.category ?? null,
			totalMinor: group.totalMinor,
			visits: group.bills,
		}));

		const categoryTotals = new Map<MerchantBusinessCategory | null, { totalMinor: number; visits: number }>();
		for (const merchant of byMerchant) {
			const entry = categoryTotals.get(merchant.category) ?? { totalMinor: 0, visits: 0 };
			entry.totalMinor += merchant.totalMinor;
			entry.visits += merchant.visits;
			categoryTotals.set(merchant.category, entry);
		}
		const byCategory: UserSpendByCategory[] = [...categoryTotals.entries()]
			.map(([category, totals]) => ({ category, totalMinor: totals.totalMinor, visits: totals.visits }))
			.sort((left, right) => right.totalMinor - left.totalMinor);

		return {
			currency: DEFAULT_SALE_CURRENCY,
			totalSpentMinor: buildAnalyticsMetric(current.totalMinor, prior.totalMinor),
			visits: buildAnalyticsMetric(current.bills, prior.bills),
			byMerchant: byMerchant.slice(0, USER_TOP_SPEND_MERCHANTS),
			byCategory,
		};
	}
}
