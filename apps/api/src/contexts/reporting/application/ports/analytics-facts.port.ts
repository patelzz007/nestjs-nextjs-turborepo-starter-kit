import type { RewardClaimStatus } from "@workspace/shared";

import type { AnalyticsScope, AnalyticsTimeRange, AnalyticsWindow } from "../../domain/value-objects/analytics-scope.value-object";

/** One bucket of the activity series: paid bills, claims and redemptions. */
export interface ActivityBucket {
	readonly startMs: number;
	readonly endMs: number;
	readonly isPartial: boolean;
	readonly salesMinor: number;
	readonly bills: number;
	readonly averageBillMinor: number;
	readonly claims: number;
	readonly redemptions: number;
}

/** The activity of one range. */
export interface ActivityTotals {
	readonly salesMinor: number;
	readonly bills: number;
	readonly averageBillMinor: number;
	/** Distinct customers with a paid bill. */
	readonly customers: number;
	/** Distinct merchants with a paid bill. */
	readonly merchants: number;
	readonly claims: number;
	readonly redemptions: number;
}

/** {@link ActivityTotals} of the range and of the equally long range before it. */
export interface ComparedActivityTotals {
	readonly current: ActivityTotals;
	readonly previous: ActivityTotals;
}

/** New vs returning customers: "new" = their first bill ever (in the scope) falls in the bucket / range. */
export interface CustomerCohort {
	readonly newCustomers: number;
	readonly returningCustomers: number;
}

export interface CustomerCohortBucket extends CustomerCohort {
	readonly startMs: number;
}

/** One customer's claims of a range by their current status (statuses without claims are absent). */
export interface ClaimStatusCount {
	readonly status: RewardClaimStatus;
	readonly claims: number;
}

/** One customer's referral activity in a range. */
export interface ReferralTotals {
	/** Referrals the customer started (created in the range). */
	readonly sent: number;
	/** The customer's referrals credited in the range. */
	readonly credited: number;
	/** Referrer reward claims the customer received in the range. */
	readonly rewardsEarned: number;
}

/** Time-bucketed and whole-range activity aggregates (paid bills, claims, redemptions, customer cohorts), computed in the database. */
export interface AnalyticsFactsReadPort {
	/** Every bucket of `window` (empty ones as zero), with the scope's bills, claims and redemptions. */
	activitySeries(scope: AnalyticsScope, window: AnalyticsWindow): Promise<ActivityBucket[]>;
	/** Whole-range totals of `range` and of `previous`. */
	activityTotals(scope: AnalyticsScope, range: AnalyticsTimeRange, previous: AnalyticsTimeRange): Promise<ComparedActivityTotals>;
	/** When the first live bill in `scope` was paid (all time), or `null` before any. */
	firstBillAt(scope: AnalyticsScope): Promise<number | null>;
	/** New vs returning customers per bucket. */
	customerCohortSeries(scope: AnalyticsScope, window: AnalyticsWindow): Promise<CustomerCohortBucket[]>;
	/** New vs returning customers over the whole of `range` and of `previous`. */
	customerCohortTotals(
		scope: AnalyticsScope,
		range: AnalyticsTimeRange,
		previous: AnalyticsTimeRange,
	): Promise<{ readonly current: CustomerCohort; readonly previous: CustomerCohort }>;
	/** One customer's claims made in `range`, grouped by their current status. */
	customerClaimStatuses(userId: string, range: AnalyticsTimeRange): Promise<ClaimStatusCount[]>;
	/** One customer's referral activity in `range` and `previous`. */
	customerReferralTotals(
		userId: string,
		range: AnalyticsTimeRange,
		previous: AnalyticsTimeRange,
	): Promise<{ readonly current: ReferralTotals; readonly previous: ReferralTotals }>;
}
