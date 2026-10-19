import { startOfWeekInTimeZone, type EpochMs, type RewardClaimStatus, type RewardReferralStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../../../../../platform/application/ports/authorization.port";
import type {
	AnalyticsLocationScope,
	AnalyticsScope,
	AnalyticsTimeRange,
	AnalyticsWindow,
	OrganizationAnalyticsScope,
} from "../../../domain/value-objects/analytics-scope.value-object";
import type {
	AnalyticsBreakdownReadPort,
	CategorySalesRow,
	CitySalesRow,
	MerchantBucketSalesRow,
	MerchantSalesRow,
	RedemptionMethodRow,
	RewardBreakdownRow,
	StoreBreakdownRow,
} from "../../ports/analytics-breakdown.port";
import type {
	ActivityBucket,
	AnalyticsFactsReadPort,
	ClaimStatusCount,
	ComparedActivityTotals,
	CustomerCohort,
	CustomerCohortBucket,
	ReferralTotals,
} from "../../ports/analytics-facts.port";
import type { AnalyticsOrganization, AnalyticsOrganizationReadPort } from "../../ports/analytics-organization-read.port";
import type {
	ActivityWeek,
	ComparedPeriods,
	CustomerActivity,
	MerchantActivity,
	PeriodCounts,
	RewardActivityCounts,
	RewardActivityReadPort,
	RewardCountFilter,
	RewardTitle,
} from "../../ports/reward-activity-read.port";
import type { InclusiveRange, SalesAggregate, SalesGroup, SalesMerchantSummary, SalesReadPort, SalesScope, SalesWeek } from "../../ports/sales-read.port";

/** A clock frozen at one epoch millisecond. */
export class FrozenClock implements Clock {
	public constructor(private readonly instant: EpochMs) {}

	public now(): EpochMs {
		return this.instant;
	}
}

const ZERO_TOTALS = { salesMinor: 0, bills: 0, averageBillMinor: 0, customers: 0, merchants: 0, claims: 0, redemptions: 0 };
const ZERO_REFERRALS: ReferralTotals = { sent: 0, credited: 0, rewardsEarned: 0 };
const ZERO_COHORT: CustomerCohort = { newCustomers: 0, returningCustomers: 0 };

/** In-memory facts: returns the configured aggregates and records every call's arguments. */
export class InMemoryAnalyticsFacts implements AnalyticsFactsReadPort {
	public series: ActivityBucket[] = [];
	public totals: ComparedActivityTotals = { current: ZERO_TOTALS, previous: ZERO_TOTALS };
	public firstBill: number | null = null;
	public cohortSeries: CustomerCohortBucket[] = [];
	public cohortTotals: { readonly current: CustomerCohort; readonly previous: CustomerCohort } = { current: ZERO_COHORT, previous: ZERO_COHORT };
	public claimStatuses: ClaimStatusCount[] = [];
	public referralTotals: { readonly current: ReferralTotals; readonly previous: ReferralTotals } = { current: ZERO_REFERRALS, previous: ZERO_REFERRALS };
	public readonly seriesCalls: { readonly scope: AnalyticsScope; readonly window: AnalyticsWindow }[] = [];
	public readonly totalsCalls: { readonly scope: AnalyticsScope; readonly range: AnalyticsTimeRange; readonly previous: AnalyticsTimeRange }[] = [];
	public readonly firstBillCalls: AnalyticsScope[] = [];
	public readonly claimStatusCalls: { readonly userId: string; readonly range: AnalyticsTimeRange }[] = [];
	public readonly referralCalls: { readonly userId: string; readonly range: AnalyticsTimeRange; readonly previous: AnalyticsTimeRange }[] = [];

	public activitySeries(scope: AnalyticsScope, window: AnalyticsWindow): Promise<ActivityBucket[]> {
		this.seriesCalls.push({ scope, window });
		return Promise.resolve(this.series);
	}

	public activityTotals(scope: AnalyticsScope, range: AnalyticsTimeRange, previous: AnalyticsTimeRange): Promise<ComparedActivityTotals> {
		this.totalsCalls.push({ scope, range, previous });
		return Promise.resolve(this.totals);
	}

	public firstBillAt(scope: AnalyticsScope): Promise<number | null> {
		this.firstBillCalls.push(scope);
		return Promise.resolve(this.firstBill);
	}

	public customerCohortSeries(): Promise<CustomerCohortBucket[]> {
		return Promise.resolve(this.cohortSeries);
	}

	public customerCohortTotals(): Promise<{ readonly current: CustomerCohort; readonly previous: CustomerCohort }> {
		return Promise.resolve(this.cohortTotals);
	}

	public customerClaimStatuses(userId: string, range: AnalyticsTimeRange): Promise<ClaimStatusCount[]> {
		this.claimStatusCalls.push({ userId, range });
		return Promise.resolve(this.claimStatuses);
	}

	public customerReferralTotals(
		userId: string,
		range: AnalyticsTimeRange,
		previous: AnalyticsTimeRange,
	): Promise<{ readonly current: ReferralTotals; readonly previous: ReferralTotals }> {
		this.referralCalls.push({ userId, range, previous });
		return Promise.resolve(this.referralTotals);
	}
}

/** In-memory breakdowns: returns the configured rows and records the store-breakdown scope. */
export class InMemoryAnalyticsBreakdowns implements AnalyticsBreakdownReadPort {
	public stores: StoreBreakdownRow[] = [];
	public rewards: RewardBreakdownRow[] = [];
	public methods: RedemptionMethodRow[] = [];
	public merchants: MerchantSalesRow[] = [];
	public categories: CategorySalesRow[] = [];
	public cities: CitySalesRow[] = [];
	public merchantBuckets: MerchantBucketSalesRow[] = [];
	public readonly storeCalls: { readonly scope: OrganizationAnalyticsScope; readonly range: AnalyticsTimeRange }[] = [];
	public calls = 0;

	public byStore(scope: OrganizationAnalyticsScope, range: AnalyticsTimeRange): Promise<StoreBreakdownRow[]> {
		this.calls += 1;
		this.storeCalls.push({ scope, range });
		return Promise.resolve(this.stores);
	}

	public byReward(): Promise<RewardBreakdownRow[]> {
		this.calls += 1;
		return Promise.resolve(this.rewards);
	}

	public byRedemptionMethod(): Promise<RedemptionMethodRow[]> {
		this.calls += 1;
		return Promise.resolve(this.methods);
	}

	public byMerchant(): Promise<MerchantSalesRow[]> {
		this.calls += 1;
		return Promise.resolve(this.merchants);
	}

	public byCategory(): Promise<CategorySalesRow[]> {
		this.calls += 1;
		return Promise.resolve(this.categories);
	}

	public byCity(): Promise<CitySalesRow[]> {
		this.calls += 1;
		return Promise.resolve(this.cities);
	}

	public merchantBucketSales(): Promise<MerchantBucketSalesRow[]> {
		this.calls += 1;
		return Promise.resolve(this.merchantBuckets);
	}
}

/** Organizations by id. */
export class InMemoryAnalyticsOrganizations implements AnalyticsOrganizationReadPort {
	public readonly rows = new Map<string, AnalyticsOrganization>();

	public findById(organizationId: string): Promise<AnalyticsOrganization | null> {
		return Promise.resolve(this.rows.get(organizationId) ?? null);
	}
}

/** Sales facts: configured aggregates, weeks, groups and merchant names; records the scopes asked for. */
export class InMemorySales implements SalesReadPort {
	public aggregates: SalesAggregate = { totalMinor: 0, bills: 0 };
	public weeks: SalesWeek[] = [];
	public groups: SalesGroup[] = [];
	public organizations = 0;
	public summaries = new Map<string, SalesMerchantSummary>();
	public readonly aggregateScopes: SalesScope[] = [];
	public readonly summaryCalls: { readonly organizationIds: readonly string[]; readonly actorUserId: string | null }[] = [];

	public firstPaidAt(): Promise<number | null> {
		return Promise.resolve(null);
	}

	public aggregate(scope: SalesScope): Promise<SalesAggregate> {
		this.aggregateScopes.push(scope);
		return Promise.resolve(this.aggregates);
	}

	public listWeeklyTotals(): Promise<SalesWeek[]> {
		return Promise.resolve(this.weeks);
	}

	public groupByOrganization(): Promise<SalesGroup[]> {
		return Promise.resolve(this.groups);
	}

	public countOrganizations(): Promise<number> {
		return Promise.resolve(this.organizations);
	}

	public listMerchantSummaries(organizationIds: readonly string[], actorUserId: string | null): Promise<Map<string, SalesMerchantSummary>> {
		this.summaryCalls.push({ organizationIds, actorUserId });
		return Promise.resolve(new Map([...this.summaries].filter(([organizationId]) => organizationIds.includes(organizationId))));
	}
}

/** One claim of a merchant's reward (test input). */
export interface MerchantClaimFact {
	readonly claimedAt: number;
	readonly rewardId: string;
}

/** One redemption at a merchant's store (test input). */
export interface MerchantRedemptionFact {
	readonly redeemedAt: number;
	readonly rewardId: string;
}

/** One of a customer's claims (test input). */
export interface CustomerClaimFact {
	readonly claimedAt: number;
	readonly redeemedAt: number | null;
	readonly status: RewardClaimStatus;
}

/** One referral a customer sent (test input). */
export interface ReferrerReferralFact {
	readonly createdAt: number;
	readonly status: RewardReferralStatus;
}

function within(at: number, range: InclusiveRange): boolean {
	return at >= range.gte && at <= range.lte;
}

/** Counts per week start (Monday 00:00 in `timeZone`), as the database groups them. */
function weeksOf(claims: readonly number[], redemptions: readonly number[], timeZone: string): ActivityWeek[] {
	const weeks = new Map<number, { claims: number; redemptions: number }>();
	for (const [at, isClaim] of [...claims.map((at): [number, boolean] => [at, true]), ...redemptions.map((at): [number, boolean] => [at, false])]) {
		const start = startOfWeekInTimeZone(at, timeZone);
		const week = weeks.get(start) ?? { claims: 0, redemptions: 0 };
		weeks.set(start, isClaim ? { ...week, claims: week.claims + 1 } : { ...week, redemptions: week.redemptions + 1 });
	}
	return [...weeks.entries()].sort(([left], [right]) => left - right).map(([weekStartMs, counts]) => ({ weekStartMs, ...counts }));
}

/** Reward activity facts counted in memory exactly as the grouped SQL counts them (inclusive ranges). */
export class InMemoryRewardActivity implements RewardActivityReadPort {
	public rewardCount = 0;
	public merchantClaims: MerchantClaimFact[] = [];
	public merchantRedemptions: MerchantRedemptionFact[] = [];
	public referralCount = 0;
	public titles: RewardTitle[] = [];
	public customerClaims: CustomerClaimFact[] = [];
	public referrals: ReferrerReferralFact[] = [];
	public readonly countFilters: RewardCountFilter[] = [];

	public countRewards(filter: RewardCountFilter): Promise<number> {
		this.countFilters.push(filter);
		return Promise.resolve(this.rewardCount);
	}

	public merchantActivity(_organizationId: string, periods: ComparedPeriods, _locationScope: AnalyticsLocationScope, topRewards: number): Promise<MerchantActivity> {
		const claims = this.merchantClaims.filter((row) => within(row.claimedAt, periods.current));
		const redemptions = this.merchantRedemptions.filter((row) => within(row.redeemedAt, periods.current));
		const byReward = new Map<string, RewardActivityCounts>();
		for (const row of claims) {
			const counts = byReward.get(row.rewardId) ?? { rewardId: row.rewardId, claims: 0, redemptions: 0 };
			byReward.set(row.rewardId, { ...counts, claims: counts.claims + 1 });
		}
		for (const row of redemptions) {
			const counts = byReward.get(row.rewardId) ?? { rewardId: row.rewardId, claims: 0, redemptions: 0 };
			byReward.set(row.rewardId, { ...counts, redemptions: counts.redemptions + 1 });
		}
		return Promise.resolve({
			claims: { current: claims.length, previous: this.merchantClaims.filter((row) => within(row.claimedAt, periods.previous)).length },
			redemptions: { current: redemptions.length, previous: this.merchantRedemptions.filter((row) => within(row.redeemedAt, periods.previous)).length },
			weeks: weeksOf(
				claims.map((row) => row.claimedAt),
				redemptions.map((row) => row.redeemedAt),
				periods.timeZone,
			),
			topRewards: [...byReward.values()]
				.sort((left, right) => right.claims + right.redemptions - (left.claims + left.redemptions) || left.rewardId.localeCompare(right.rewardId))
				.slice(0, topRewards),
		});
	}

	public countMerchantReferrals(): Promise<number> {
		return Promise.resolve(this.referralCount);
	}

	public listRewardTitles(_organizationId: string, rewardIds: readonly string[]): Promise<RewardTitle[]> {
		return Promise.resolve(this.titles.filter((row) => rewardIds.includes(row.id)));
	}

	public customerActivity(_userId: string, periods: ComparedPeriods): Promise<CustomerActivity> {
		const current = this.customerClaims.filter((row) => within(row.claimedAt, periods.current));
		const previous = this.customerClaims.filter((row) => within(row.claimedAt, periods.previous));
		const counts = (status: RewardClaimStatus): PeriodCounts => ({
			current: current.filter((row) => row.status === status).length,
			previous: previous.filter((row) => row.status === status).length,
		});
		const sentNow = this.referrals.filter((row) => within(row.createdAt, periods.current));
		const sentBefore = this.referrals.filter((row) => within(row.createdAt, periods.previous));
		const redeemedAt = current.flatMap((row) => (row.status === "REDEEMED" && row.redeemedAt !== null && within(row.redeemedAt, periods.current) ? [row.redeemedAt] : []));
		return Promise.resolve({
			claimsByStatus: { PENDING: counts("PENDING"), REDEEMED: counts("REDEEMED"), EXPIRED: counts("EXPIRED") },
			weeks: weeksOf(
				current.map((row) => row.claimedAt),
				redeemedAt,
				periods.timeZone,
			),
			referralsSent: { current: sentNow.length, previous: sentBefore.length },
			referralsCredited: {
				current: sentNow.filter((row) => row.status === "CREDITED").length,
				previous: sentBefore.filter((row) => row.status === "CREDITED").length,
			},
		});
	}
}

/** Thrown by {@link FakeMerchantAccess} when it is set to deny. */
export class MerchantAccessDeniedForTest extends Error {
	public constructor() {
		super("merchant access denied");
		this.name = "MerchantAccessDeniedForTest";
	}
}

/** Merchant access that grants a configured store scope (or denies), recording every request. */
export class FakeMerchantAccess implements MerchantAccessPort {
	public allow = true;
	public grantScope: Pick<MerchantAccessGrant, "locationScope" | "locationIds"> = { locationScope: "ALL_LOCATIONS", locationIds: [] };
	public readonly requests: { readonly actor: ActorContext; readonly request: MerchantAccessRequest }[] = [];

	public assertCapability(actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		this.requests.push({ actor, request });
		if (!this.allow) {
			return Promise.reject(new MerchantAccessDeniedForTest());
		}
		return Promise.resolve({ organizationId: request.organizationId, ...this.grantScope });
	}
}
