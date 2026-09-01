import { Injectable } from "@nestjs/common";

import type { MerchantAnalyticsResponse, RewardsAnalyticsQuery, UserRewardsAnalyticsResponse } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import {
	buildAnalyticsMetric,
	buildWeeklyTimeSeries,
	conversionRatePercent,
	percentChange,
	previousAnalyticsPeriod,
	resolveAnalyticsPeriod,
} from "../utils/rewards-analytics.util";
import { MerchantContextService } from "./merchant-context.service";

@Injectable()
export class RewardsAnalyticsService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly merchantContext: MerchantContextService,
	) {}

	public async getMerchantAnalytics(userId: string, merchantOrgId: string | undefined, query: RewardsAnalyticsQuery): Promise<MerchantAnalyticsResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		const period = resolveAnalyticsPeriod(query.from, query.to);
		const previous = previousAnalyticsPeriod(period);

		const rewardWhere = { merchantOrgId: orgId, isDeleted: false, rewardKind: "CONSUMER" as const };

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
		] = await Promise.all([
			this.prisma.reward.count({ where: rewardWhere }),
			this.prisma.reward.count({ where: { ...rewardWhere, status: "PUBLISHED" } }),
			this.prisma.reward.count({ where: { ...rewardWhere, createdAt: { gte: period.fromMs, lte: period.toMs } } }),
			this.prisma.reward.count({ where: { ...rewardWhere, createdAt: { gte: previous.fromMs, lte: previous.toMs } } }),
			this.prisma.reward.count({
				where: { ...rewardWhere, status: "PUBLISHED", reviewedAt: { gte: period.fromMs, lte: period.toMs } },
			}),
			this.prisma.reward.count({
				where: { ...rewardWhere, status: "PUBLISHED", reviewedAt: { gte: previous.fromMs, lte: previous.toMs } },
			}),
			this.prisma.rewardClaim.findMany({
				where: {
					isDeleted: false,
					claimedAt: { gte: previous.fromMs, lte: period.toMs },
					reward: { merchantOrgId: orgId, isDeleted: false },
				},
				select: { claimedAt: true, status: true, rewardId: true },
			}),
			this.prisma.rewardRedemption.findMany({
				where: {
					isDeleted: false,
					merchantOrgId: orgId,
					redeemedAt: { gte: previous.fromMs, lte: period.toMs },
				},
				select: { redeemedAt: true, claim: { select: { rewardId: true } } },
			}),
			this.prisma.rewardReferral.count({
				where: {
					isDeleted: false,
					createdAt: { gte: period.fromMs, lte: period.toMs },
					reward: { merchantOrgId: orgId, isDeleted: false },
				},
			}),
			this.prisma.rewardReferral.count({
				where: {
					isDeleted: false,
					createdAt: { gte: previous.fromMs, lte: previous.toMs },
					reward: { merchantOrgId: orgId, isDeleted: false },
				},
			}),
			this.prisma.reward.findMany({
				where: rewardWhere,
				select: { id: true, title: true },
			}),
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
		};
	}

	public async getUserAnalytics(userId: string, query: RewardsAnalyticsQuery): Promise<UserRewardsAnalyticsResponse> {
		const period = resolveAnalyticsPeriod(query.from, query.to);
		const previous = previousAnalyticsPeriod(period);

		const [claimRows, referralRows] = await Promise.all([
			this.prisma.rewardClaim.findMany({
				where: {
					userId,
					isDeleted: false,
					claimedAt: { gte: previous.fromMs, lte: period.toMs },
				},
				select: { claimedAt: true, status: true },
			}),
			this.prisma.rewardReferral.findMany({
				where: {
					referrerUserId: userId,
					isDeleted: false,
					createdAt: { gte: previous.fromMs, lte: period.toMs },
				},
				select: { createdAt: true, status: true },
			}),
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

		const redemptionTimestamps = currentClaims.filter((row) => row.status === "REDEEMED").map((row) => Number(row.claimedAt));
		const currentConversion = conversionRatePercent(currentClaims.length, currentRedeemed);
		const previousConversion = conversionRatePercent(previousClaims.length, previousRedeemed);

		const statusCounts = new Map<"PENDING" | "REDEEMED" | "EXPIRED", number>();
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
			byStatus: (["PENDING", "REDEEMED", "EXPIRED"] as const).map((status) => ({
				status,
				count: statusCounts.get(status) ?? 0,
			})),
		};
	}
}
