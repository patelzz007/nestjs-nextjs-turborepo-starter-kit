import { Inject, Injectable } from "@nestjs/common";
import {
	ADMIN_TOP_MERCHANTS_LIMIT,
	CUSTOMER_TOP_MERCHANTS_LIMIT,
	DEFAULT_SALE_CURRENCY,
	EpochMsSchema,
	IanaTimeZoneSchema,
	MERCHANT_CAPABILITY,
	MERCHANT_REWARD_BREAKDOWN_LIMIT,
	nowEpochMs,
	previousAnalyticsRange,
	resolveAnalyticsRange,
	RewardClaimStatusSchema,
	RewardRedemptionMethodSchema,
	UTC_TIME_ZONE,
	type AdminAnalyticsDashboard,
	type AnalyticsBucket,
	type AnalyticsInterval,
	type AnalyticsReportRange,
	type CustomerAnalyticsDashboard,
	type CustomerCategorySpend,
	type MerchantAnalyticsDashboard,
	type MerchantBusinessCategory,
} from "@workspace/shared";

import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { RewardSaleRepository } from "../repositories/reward-sale.repository";
import { MerchantContextService } from "../services/merchant-context.service";
import { AnalyticsBreakdownRepository, type MerchantBucketSalesRow } from "./analytics-breakdown.repository";
import { AnalyticsFactsRepository, type ActivityBucket } from "./analytics-facts.repository";
import { compare, conversionRate, seriesFor } from "./analytics-math";
import type { AnalyticsScope, AnalyticsTimeRange, AnalyticsWindow } from "./analytics-scope";

/** The source of "now" for default ranges — a port, so tests pin it. */
export interface AnalyticsClock {
	nowEpochMs(): number;
}

export const ANALYTICS_CLOCK = Symbol("ANALYTICS_CLOCK");

export const SYSTEM_ANALYTICS_CLOCK: AnalyticsClock = { nowEpochMs: (): number => nowEpochMs() };

/** The range fields of any dashboard / export request. */
export interface AnalyticsRangeRequest {
	readonly from?: number | undefined;
	readonly to?: number | undefined;
	readonly interval?: AnalyticsInterval | undefined;
}

/** The organization a merchant dashboard belongs to — what an export needs to name and title its file. */
export interface MerchantDashboardSubject {
	readonly slug: string;
	readonly displayName: string;
}

/** A merchant's analytics row points at an organization that is gone: an integrity fault, never papered over. */
export class AnalyticsOrganizationMissingError extends Error {
	public constructor(organizationId: string) {
		super(`Analytics organization ${organizationId} could not be loaded`);
		this.name = "AnalyticsOrganizationMissingError";
	}
}

/** A customer's spending row points at a merchant whose name could not be loaded. */
export class AnalyticsMerchantSummaryMissingError extends Error {
	public constructor(organizationId: string) {
		super(`Merchant summary for ${organizationId} could not be loaded`);
		this.name = "AnalyticsMerchantSummaryMissingError";
	}
}

/** The window (range + zone + interval) and its previous range for one request. */
interface ResolvedRequest {
	readonly window: AnalyticsWindow;
	readonly previous: AnalyticsTimeRange;
	readonly range: AnalyticsReportRange;
}

/**
 * The analytics dashboards of the customer, the merchant and the admin
 * (`analytics-dashboard.ts` in @workspace/shared). Every number comes from a
 * Postgres aggregate (AnalyticsFactsRepository / AnalyticsBreakdownRepository);
 * this service resolves WHO may see WHAT, assembles the DTO and does the
 * comparison math on the aggregated values.
 *
 * Authorization (also mapped on the controllers): customer — self only (the
 * user id comes from the access token); merchant — `merchant:view_analytics`
 * plus the caller's store scope; admin — `READ ANALYTICS` on the controller,
 * platform-wide.
 */
@Injectable()
export class AnalyticsDashboardService {
	public constructor(
		private readonly facts: AnalyticsFactsRepository,
		private readonly breakdowns: AnalyticsBreakdownRepository,
		private readonly merchantContext: MerchantContextService,
		private readonly organizations: OrganizationRepository,
		private readonly sales: RewardSaleRepository,
		@Inject(ANALYTICS_CLOCK) private readonly clock: AnalyticsClock,
	) {}

	public async getMerchantDashboard(actor: MerchantActor, query: AnalyticsRangeRequest & { readonly locationId?: string | undefined }): Promise<MerchantAnalyticsDashboard> {
		return (await this.buildMerchantDashboard(actor, query)).dashboard;
	}

	/** The merchant dashboard plus the organization it belongs to (for the export's title and file name). */
	public async buildMerchantDashboard(
		actor: MerchantActor,
		query: AnalyticsRangeRequest & { readonly locationId?: string | undefined },
	): Promise<{ readonly dashboard: MerchantAnalyticsDashboard; readonly subject: MerchantDashboardSubject }> {
		await this.merchantContext.requireActorCapability(actor, MERCHANT_CAPABILITY.viewAnalytics);
		// Never "no filter": a store-limited member (or store-scoped key) sees only its stores.
		const locationScope = await this.merchantContext.resolveLocationScope(actor, query.locationId);
		const organization = await this.organizations.findById(actor.organizationId);
		if (organization === null) {
			throw new AnalyticsOrganizationMissingError(actor.organizationId);
		}
		// Merchant buckets are cut in the merchant's own zone (Organization.timeZone).
		const request = this.resolve(query, IanaTimeZoneSchema.parse(organization.timeZone));
		const scope: AnalyticsScope = { kind: "organization", organizationId: actor.organizationId, locationScope };

		const [series, totals, firstBillAt, byStore, byReward, byMethod] = await Promise.all([
			this.facts.activitySeries(scope, request.window),
			this.facts.activityTotals(scope, request.window, request.previous),
			this.facts.firstBillAt(scope),
			this.breakdowns.byStore(scope, request.window),
			this.breakdowns.byReward(scope, request.window, MERCHANT_REWARD_BREAKDOWN_LIMIT),
			this.breakdowns.byRedemptionMethod(scope, request.window),
		]);
		const redemptionsByMethod = new Map(byMethod.map((row) => [row.method, row.redemptions]));

		const dashboard: MerchantAnalyticsDashboard = {
			range: request.range,
			currency: DEFAULT_SALE_CURRENCY,
			firstBillAt: firstBillAt === null ? null : EpochMsSchema.parse(firstBillAt),
			totals: {
				salesMinor: compare(totals.current.salesMinor, totals.previous.salesMinor),
				bills: compare(totals.current.bills, totals.previous.bills),
				averageBillMinor: compare(totals.current.averageBillMinor, totals.previous.averageBillMinor),
				claims: compare(totals.current.claims, totals.previous.claims),
				redemptions: compare(totals.current.redemptions, totals.previous.redemptions),
				conversionRate: compare(conversionRate(totals.current.claims, totals.current.redemptions), conversionRate(totals.previous.claims, totals.previous.redemptions)),
				customers: compare(totals.current.customers, totals.previous.customers),
			},
			series: series.map((bucket) => ({
				...this.bucketOf(bucket),
				salesMinor: bucket.salesMinor,
				bills: bucket.bills,
				averageBillMinor: bucket.averageBillMinor,
				claims: bucket.claims,
				redemptions: bucket.redemptions,
			})),
			byStore,
			byReward: byReward.map((row) => ({ ...row, conversionRate: conversionRate(row.claims, row.redemptions) })),
			byRedemptionMethod: RewardRedemptionMethodSchema.options.map((method) => ({ method, redemptions: redemptionsByMethod.get(method) ?? 0 })),
		};
		return { dashboard, subject: { slug: organization.slug, displayName: organization.displayName } };
	}

	/** The platform dashboard (the controller enforces `READ ANALYTICS`; the route bypasses RLS). Buckets in UTC. */
	public async getAdminDashboard(query: AnalyticsRangeRequest): Promise<AdminAnalyticsDashboard> {
		const request = this.resolve(query, UTC_TIME_ZONE);
		const scope: AnalyticsScope = { kind: "platform" };

		const [series, totals, cohortSeries, cohortTotals, topMerchants, byCategory, byCity] = await Promise.all([
			this.facts.activitySeries(scope, request.window),
			this.facts.activityTotals(scope, request.window, request.previous),
			this.facts.customerCohortSeries(scope, request.window),
			this.facts.customerCohortTotals(scope, request.window, request.previous),
			this.breakdowns.byMerchant(scope, request.window, ADMIN_TOP_MERCHANTS_LIMIT),
			this.breakdowns.byCategory(scope, request.window),
			this.breakdowns.byCity(scope, request.window),
		]);
		const cohortByStart = new Map(cohortSeries.map((bucket) => [bucket.startMs, bucket]));

		return {
			range: request.range,
			currency: DEFAULT_SALE_CURRENCY,
			totals: {
				salesMinor: compare(totals.current.salesMinor, totals.previous.salesMinor),
				bills: compare(totals.current.bills, totals.previous.bills),
				averageBillMinor: compare(totals.current.averageBillMinor, totals.previous.averageBillMinor),
				claims: compare(totals.current.claims, totals.previous.claims),
				redemptions: compare(totals.current.redemptions, totals.previous.redemptions),
				conversionRate: compare(conversionRate(totals.current.claims, totals.current.redemptions), conversionRate(totals.previous.claims, totals.previous.redemptions)),
				activeMerchants: compare(totals.current.merchants, totals.previous.merchants),
				customers: compare(totals.current.customers, totals.previous.customers),
				newCustomers: compare(cohortTotals.current.newCustomers, cohortTotals.previous.newCustomers),
				returningCustomers: compare(cohortTotals.current.returningCustomers, cohortTotals.previous.returningCustomers),
			},
			series: series.map((bucket) => ({
				...this.bucketOf(bucket),
				salesMinor: bucket.salesMinor,
				bills: bucket.bills,
				averageBillMinor: bucket.averageBillMinor,
				claims: bucket.claims,
				redemptions: bucket.redemptions,
				newCustomers: cohortByStart.get(bucket.startMs)?.newCustomers ?? 0,
				returningCustomers: cohortByStart.get(bucket.startMs)?.returningCustomers ?? 0,
			})),
			topMerchants,
			byCategory,
			byCity,
		};
	}

	/** The signed-in customer's own dashboard (`userId` comes from the access token — self only). Buckets in UTC: a customer spends across merchants and zones. */
	public async getCustomerDashboard(userId: string, query: AnalyticsRangeRequest): Promise<CustomerAnalyticsDashboard> {
		const request = this.resolve(query, UTC_TIME_ZONE);
		const scope: AnalyticsScope = { kind: "customer", userId };

		const [series, totals, merchantBuckets, claimStatuses, referrals] = await Promise.all([
			this.facts.activitySeries(scope, request.window),
			this.facts.activityTotals(scope, request.window, request.previous),
			this.breakdowns.merchantBucketSales(scope, request.window),
			this.facts.customerClaimStatuses(userId, request.window),
			this.facts.customerReferralTotals(userId, request.window, request.previous),
		]);
		const claimsByStatus = new Map(claimStatuses.map((row) => [row.status, row.claims]));
		const bucketStarts = series.map((bucket) => bucket.startMs);
		const merchantSpend = this.groupByMerchant(merchantBuckets);
		// Names + categories of merchants taken from the customer's OWN bills only (a system read: customers can't read `organizations`).
		const summaries = await this.sales.listMerchantSummaries([...merchantSpend.keys()], userId);

		const merchants = [...merchantSpend.entries()].map(([organizationId, spend]) => {
			const summary = summaries.get(organizationId);
			if (summary === undefined) {
				throw new AnalyticsMerchantSummaryMissingError(organizationId);
			}
			return { organizationId, merchantName: summary.name, category: summary.category, ...spend };
		});
		const byCategory = new Map<MerchantBusinessCategory | null, { totalMinor: number; visits: number; perBucket: Map<number, number> }>();
		for (const merchant of merchants) {
			const entry = byCategory.get(merchant.category) ?? { totalMinor: 0, visits: 0, perBucket: new Map<number, number>() };
			entry.totalMinor += merchant.totalMinor;
			entry.visits += merchant.visits;
			for (const [start, totalMinor] of merchant.perBucket) {
				entry.perBucket.set(start, (entry.perBucket.get(start) ?? 0) + totalMinor);
			}
			byCategory.set(merchant.category, entry);
		}
		const spendingByCategory: CustomerCategorySpend[] = [...byCategory.entries()]
			.map(([category, entry]) => ({ category, totalMinor: entry.totalMinor, visits: entry.visits, series: this.valueSeries(bucketStarts, entry.perBucket) }))
			.sort((left, right) => right.totalMinor - left.totalMinor);

		return {
			range: request.range,
			currency: DEFAULT_SALE_CURRENCY,
			totals: {
				spentMinor: compare(totals.current.salesMinor, totals.previous.salesMinor),
				visits: compare(totals.current.bills, totals.previous.bills),
				averageBillMinor: compare(totals.current.averageBillMinor, totals.previous.averageBillMinor),
				claims: compare(totals.current.claims, totals.previous.claims),
				redemptions: compare(totals.current.redemptions, totals.previous.redemptions),
				conversionRate: compare(conversionRate(totals.current.claims, totals.current.redemptions), conversionRate(totals.previous.claims, totals.previous.redemptions)),
				merchants: compare(totals.current.merchants, totals.previous.merchants),
				referralsSent: compare(referrals.current.sent, referrals.previous.sent),
				referralsCredited: compare(referrals.current.credited, referrals.previous.credited),
				referralRewardsEarned: compare(referrals.current.rewardsEarned, referrals.previous.rewardsEarned),
			},
			series: series.map((bucket) => ({
				...this.bucketOf(bucket),
				spentMinor: bucket.salesMinor,
				visits: bucket.bills,
				claims: bucket.claims,
				redemptions: bucket.redemptions,
			})),
			spendingByCategory,
			spendingByMerchant: merchants
				.sort((left, right) => right.totalMinor - left.totalMinor || left.merchantName.localeCompare(right.merchantName))
				.slice(0, CUSTOMER_TOP_MERCHANTS_LIMIT)
				.map((merchant) => ({
					organizationId: merchant.organizationId,
					merchantName: merchant.merchantName,
					category: merchant.category,
					totalMinor: merchant.totalMinor,
					visits: merchant.visits,
					series: this.valueSeries(bucketStarts, merchant.perBucket),
				})),
			claimsByStatus: RewardClaimStatusSchema.options.map((status) => ({ status, claims: claimsByStatus.get(status) ?? 0 })),
		};
	}

	/** Every default applied: range, interval, zone, and the previous range of equal length. */
	private resolve(query: AnalyticsRangeRequest, timeZone: string): ResolvedRequest {
		const resolved = resolveAnalyticsRange(query, this.clock.nowEpochMs());
		const previous = previousAnalyticsRange(resolved);
		return {
			window: { fromMs: resolved.fromMs, toMs: resolved.toMs, timeZone, interval: resolved.interval },
			previous,
			range: {
				from: EpochMsSchema.parse(resolved.fromMs),
				to: EpochMsSchema.parse(resolved.toMs),
				timeZone,
				interval: resolved.interval,
				previousFrom: EpochMsSchema.parse(previous.fromMs),
				previousTo: EpochMsSchema.parse(previous.toMs),
			},
		};
	}

	private bucketOf(bucket: ActivityBucket): AnalyticsBucket {
		return { start: EpochMsSchema.parse(bucket.startMs), end: EpochMsSchema.parse(bucket.endMs), isPartial: bucket.isPartial };
	}

	private valueSeries(bucketStarts: readonly number[], perBucket: ReadonlyMap<number, number>): CustomerCategorySpend["series"] {
		return seriesFor(bucketStarts, perBucket).map((point) => ({ start: EpochMsSchema.parse(point.start), totalMinor: point.totalMinor }));
	}

	/** Folds the (merchant, bucket) aggregates into one entry per merchant: total, visits and the per-bucket totals. */
	private groupByMerchant(rows: readonly MerchantBucketSalesRow[]): Map<string, { totalMinor: number; visits: number; perBucket: Map<number, number> }> {
		const merchants = new Map<string, { totalMinor: number; visits: number; perBucket: Map<number, number> }>();
		for (const row of rows) {
			const entry = merchants.get(row.organizationId) ?? { totalMinor: 0, visits: 0, perBucket: new Map<number, number>() };
			entry.totalMinor += row.salesMinor;
			entry.visits += row.bills;
			entry.perBucket.set(row.startMs, row.salesMinor);
			merchants.set(row.organizationId, entry);
		}
		return merchants;
	}
}
