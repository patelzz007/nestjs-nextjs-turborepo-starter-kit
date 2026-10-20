import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminSalesAnalyticsQuery,
	AdminSalesAnalyticsResponse,
	MerchantAnalyticsResponse,
	MerchantBusinessCategory,
	RewardClaimStatus,
	RewardsAnalyticsQuery,
	SalesSummary,
	UserRewardsAnalyticsResponse,
	UserSpendByCategory,
	UserSpendingSummary,
} from "@workspace/shared";
import { DEFAULT_SALE_CURRENCY, EpochMsSchema, IanaTimeZoneSchema, RewardClaimStatusSchema } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import {
	averageBillMinor,
	buildAnalyticsMetric,
	buildWeeklySalesSeries,
	buildWeeklyActivitySeries,
	conversionRatePercent,
	percentChange,
	previousAnalyticsPeriod,
	resolveAnalyticsPeriod,
	type AnalyticsPeriod,
} from "../../domain/policies/weekly-analytics.policy";
import type { AnalyticsLocationScope } from "../../domain/value-objects/analytics-scope.value-object";
import type { AnalyticsTenantReadPort } from "../ports/analytics-tenant-read.port";
import { ANALYTICS_TENANT_READ, REWARD_ACTIVITY_READ, SALES_READ } from "../ports/reporting.tokens";
import type { RewardActivityReadPort } from "../ports/reward-activity-read.port";
import type { SalesReadPort, SalesScope } from "../ports/sales-read.port";

/** Merchants listed in a user's "where you spent the most". */
const USER_TOP_SPEND_MERCHANTS = 5;

/** Merchants listed in the admin's top-sellers table. */
const ADMIN_TOP_MERCHANTS = 10;

/** Rewards listed in the merchant's "top rewards". */
const MERCHANT_TOP_REWARDS = 8;

/**
 * A sale or redemption points at a tenant/reward the lookup could not
 * find. Foreign keys make this impossible, so it is an integrity fault —
 * surfaced as an error, never papered over with a placeholder name.
 */
export class AnalyticsReferenceMissingError extends Error {
	public constructor(entity: "tenant" | "reward", id: string) {
		super(`Analytics row references ${entity} ${id}, which could not be loaded`);
		this.name = "AnalyticsReferenceMissingError";
	}
}

function requireReference<TValue>(map: ReadonlyMap<string, TValue>, entity: "tenant" | "reward", id: string): TValue {
	const value = map.get(id);
	if (value === undefined) {
		throw new AnalyticsReferenceMissingError(entity, id);
	}
	return value;
}

/**
 * The weekly analytics (`GET /tenants/:tenantSlug/analytics`, `GET /claims/analytics`, `GET /admin/analytics/sales`):
 * week buckets, compared with the previous period of equal length. The query handlers authorize first
 * and pass the resolved scope in.
 */
@Injectable()
export class WeeklyAnalyticsAssembler {
	public constructor(
		@Inject(REWARD_ACTIVITY_READ) private readonly activity: RewardActivityReadPort,
		@Inject(SALES_READ) private readonly sales: SalesReadPort,
		@Inject(ANALYTICS_TENANT_READ) private readonly tenants: AnalyticsTenantReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	/** One merchant's weekly analytics, limited to `scope` (already authorized: a store-limited caller sees only its stores). */
	public async merchantAnalytics(orgId: string, scope: AnalyticsLocationScope, query: RewardsAnalyticsQuery): Promise<MerchantAnalyticsResponse> {
		// Merchant weeks start Monday 00:00 in the merchant's own zone (Tenant.timeZone).
		const timeZone = IanaTimeZoneSchema.parse((await this.requireTenant(orgId)).timeZone);
		const period = resolveAnalyticsPeriod(query.from, query.to, this.clock.now(), timeZone);
		const previous = previousAnalyticsPeriod(period);
		const rewards = { tenantId: orgId, locationScope: scope };

		const [
			totalRewards,
			activeRewards,
			rewardsCreatedCurrent,
			rewardsCreatedPrevious,
			publishedCurrent,
			publishedPrevious,
			activity,
			referralCurrent,
			referralPrevious,
			sales,
		] = await Promise.all([
			this.activity.countRewards({ ...rewards, publishedOnly: false }),
			this.activity.countRewards({ ...rewards, publishedOnly: true }),
			this.activity.countRewards({ ...rewards, publishedOnly: false, createdIn: { gte: period.fromMs, lte: period.toMs } }),
			this.activity.countRewards({ ...rewards, publishedOnly: false, createdIn: { gte: previous.fromMs, lte: previous.toMs } }),
			this.activity.countRewards({ ...rewards, publishedOnly: true, reviewedIn: { gte: period.fromMs, lte: period.toMs } }),
			this.activity.countRewards({ ...rewards, publishedOnly: true, reviewedIn: { gte: previous.fromMs, lte: previous.toMs } }),
			this.activity.merchantActivity(
				orgId,
				{ current: { gte: period.fromMs, lte: period.toMs }, previous: { gte: previous.fromMs, lte: previous.toMs }, timeZone: period.timeZone },
				scope,
				MERCHANT_TOP_REWARDS,
			),
			this.activity.countMerchantReferrals(orgId, { gte: period.fromMs, lte: period.toMs }, scope),
			this.activity.countMerchantReferrals(orgId, { gte: previous.fromMs, lte: previous.toMs }, scope),
			this.buildSalesSummary({ tenantId: orgId, locationIds: scope.kind === "ALL_LOCATIONS" ? undefined : scope.locationIds }, period),
		]);

		const currentConversion = conversionRatePercent(activity.claims.current, activity.redemptions.current);
		const previousConversion = conversionRatePercent(activity.claims.previous, activity.redemptions.previous);
		const topRewards = activity.topRewards;
		// Titles of the listed rewards only — including soft-deleted ones that still have claims/redemptions in the period.
		const rewardTitles = await this.activity.listRewardTitles(
			orgId,
			topRewards.map((reward) => reward.rewardId),
		);
		const titleByRewardId = new Map(rewardTitles.map((row) => [row.id, row.title]));

		return {
			period: { from: EpochMsSchema.parse(period.fromMs), to: EpochMsSchema.parse(period.toMs), timeZone: period.timeZone },
			totalRewards: { value: totalRewards, changePercent: percentChange(rewardsCreatedCurrent, rewardsCreatedPrevious) },
			activeRewards: { value: activeRewards, changePercent: percentChange(publishedCurrent, publishedPrevious) },
			totalClaims: buildAnalyticsMetric(activity.claims.current, activity.claims.previous),
			totalRedemptions: buildAnalyticsMetric(activity.redemptions.current, activity.redemptions.previous),
			conversionRate: buildAnalyticsMetric(currentConversion, previousConversion),
			referralCount: buildAnalyticsMetric(referralCurrent, referralPrevious),
			claimsOverTime: buildWeeklyActivitySeries(period, activity.weeks).map((point) => ({ ...point, date: EpochMsSchema.parse(point.date) })),
			topRewards: topRewards.map((reward) => ({
				rewardId: reward.rewardId,
				title: requireReference(titleByRewardId, "reward", reward.rewardId),
				claims: reward.claims,
				redemptions: reward.redemptions,
			})),
			sales,
		};
	}

	/** The customer's own weekly analytics (self only: `userId` is the caller). */
	public async customerAnalytics(userId: string, query: RewardsAnalyticsQuery): Promise<UserRewardsAnalyticsResponse> {
		// A customer spends across merchants (and zones): their weeks are bucketed in UTC.
		const period = resolveAnalyticsPeriod(query.from, query.to, this.clock.now());
		const previous = previousAnalyticsPeriod(period);

		const [activity, spending] = await Promise.all([
			this.activity.customerActivity(userId, {
				current: { gte: period.fromMs, lte: period.toMs },
				previous: { gte: previous.fromMs, lte: previous.toMs },
				timeZone: period.timeZone,
			}),
			this.buildSpendingSummary(userId, period),
		]);
		const { PENDING: pending, REDEEMED: redeemed, EXPIRED: expired } = activity.claimsByStatus;
		const claimStatuses: readonly RewardClaimStatus[] = RewardClaimStatusSchema.options;
		const totalCurrent = claimStatuses.reduce((sum, status) => sum + activity.claimsByStatus[status].current, 0);
		const totalPrevious = claimStatuses.reduce((sum, status) => sum + activity.claimsByStatus[status].previous, 0);
		const currentConversion = conversionRatePercent(totalCurrent, redeemed.current);
		const previousConversion = conversionRatePercent(totalPrevious, redeemed.previous);

		return {
			period: { from: EpochMsSchema.parse(period.fromMs), to: EpochMsSchema.parse(period.toMs), timeZone: period.timeZone },
			totalClaims: buildAnalyticsMetric(totalCurrent, totalPrevious),
			pendingClaims: buildAnalyticsMetric(pending.current, pending.previous),
			redeemedClaims: buildAnalyticsMetric(redeemed.current, redeemed.previous),
			expiredClaims: buildAnalyticsMetric(expired.current, expired.previous),
			referralsSent: buildAnalyticsMetric(activity.referralsSent.current, activity.referralsSent.previous),
			referralsCredited: buildAnalyticsMetric(activity.referralsCredited.current, activity.referralsCredited.previous),
			conversionRate: buildAnalyticsMetric(currentConversion, previousConversion),
			claimsOverTime: buildWeeklyActivitySeries(period, activity.weeks).map((point) => ({ ...point, date: EpochMsSchema.parse(point.date) })),
			byStatus: claimStatuses.map((status) => ({ status, count: activity.claimsByStatus[status].current })),
			spending,
		};
	}

	/** Platform-wide paid bills for `GET /admin/analytics/sales` (the route enforces `ANALYTICS:READ`). */
	public async adminSalesAnalytics(actorUserId: string | null, query: AdminSalesAnalyticsQuery): Promise<AdminSalesAnalyticsResponse> {
		// The platform view spans every merchant: its weeks are bucketed in UTC.
		const period = resolveAnalyticsPeriod(query.from, query.to, this.clock.now());
		const previous = previousAnalyticsPeriod(period);
		const range = { gte: period.fromMs, lte: period.toMs };

		const [sales, topMerchants, activeNow, activeBefore] = await Promise.all([
			this.buildSalesSummary({}, period),
			this.sales.groupByTenant({}, range, ADMIN_TOP_MERCHANTS),
			this.sales.countTenants(range),
			this.sales.countTenants({ gte: previous.fromMs, lte: previous.toMs }),
		]);
		const merchants = await this.sales.listMerchantSummaries(
			topMerchants.map((group) => group.tenantId),
			actorUserId,
		);

		return {
			period: { from: EpochMsSchema.parse(period.fromMs), to: EpochMsSchema.parse(period.toMs), timeZone: period.timeZone },
			sales,
			activeMerchants: buildAnalyticsMetric(activeNow, activeBefore),
			topMerchants: topMerchants.map((group) => {
				const merchant = requireReference(merchants, "tenant", group.tenantId);
				return { tenantId: group.tenantId, name: merchant.name, category: merchant.category, salesMinor: group.totalMinor, bills: group.bills };
			}),
		};
	}

	private async requireTenant(tenantId: string): Promise<{ readonly timeZone: string }> {
		const tenant = await this.tenants.findById(tenantId);
		if (tenant === null) {
			throw new AnalyticsReferenceMissingError("tenant", tenantId);
		}
		return tenant;
	}

	/** Paid-bill totals for `scope` in `period`, compared with the previous period of equal length. */
	private async buildSalesSummary(scope: SalesScope, period: AnalyticsPeriod): Promise<SalesSummary> {
		const previous = previousAnalyticsPeriod(period);
		const range = { gte: period.fromMs, lte: period.toMs };
		const [current, prior, weeks, firstBillAt] = await Promise.all([
			this.sales.aggregate(scope, range),
			this.sales.aggregate(scope, { gte: previous.fromMs, lte: previous.toMs }),
			this.sales.listWeeklyTotals(scope, range, period.timeZone),
			this.sales.firstPaidAt(scope),
		]);

		return {
			currency: DEFAULT_SALE_CURRENCY,
			totalSalesMinor: buildAnalyticsMetric(current.totalMinor, prior.totalMinor),
			bills: buildAnalyticsMetric(current.bills, prior.bills),
			averageBillMinor: buildAnalyticsMetric(averageBillMinor(current.totalMinor, current.bills), averageBillMinor(prior.totalMinor, prior.bills)),
			overTime: buildWeeklySalesSeries(period, weeks).map((point) => ({ ...point, date: EpochMsSchema.parse(point.date) })),
			firstBillAt: firstBillAt === null ? null : EpochMsSchema.parse(firstBillAt),
		};
	}

	/** Where (merchant) and on what (merchant category) the user spent, from the bills of their redeemed rewards. */
	private async buildSpendingSummary(userId: string, period: AnalyticsPeriod): Promise<UserSpendingSummary> {
		const previous = previousAnalyticsPeriod(period);
		const range = { gte: period.fromMs, lte: period.toMs };
		const [current, prior, byTenant] = await Promise.all([
			this.sales.aggregate({ userId }, range),
			this.sales.aggregate({ userId }, { gte: previous.fromMs, lte: previous.toMs }),
			this.sales.groupByTenant({ userId }, range),
		]);
		const merchants = await this.sales.listMerchantSummaries(
			byTenant.map((group) => group.tenantId),
			userId,
		);

		const byMerchant = byTenant.map((group) => {
			const merchant = requireReference(merchants, "tenant", group.tenantId);
			return { tenantId: group.tenantId, merchantName: merchant.name, category: merchant.category, totalMinor: group.totalMinor, visits: group.bills };
		});

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
