import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RewardClaimStatusSchema, type RewardClaimStatus } from "@workspace/shared";
import { z } from "zod";

import { minorUnitsToNumber } from "../utils/minor-units.util";
import {
	allOf,
	claimConditions,
	claimSource,
	redemptionConditions,
	salesConditions,
	withinRange,
	type AnalyticsScope,
	type AnalyticsTimeRange,
	type AnalyticsWindow,
} from "./analytics-scope";
import { AnalyticsSqlRunner, averageSql, bucketsCte, localBucketOf } from "./analytics-sql";

/** Postgres `BIGINT` arrives as `bigint`, `INT` as `number`. */
const BigIntColumn = z.bigint();
const IntColumn = z.number().int().nonnegative();

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

const ActivityBucketRowSchema = z.object({
	start_ms: BigIntColumn,
	end_ms: BigIntColumn,
	is_partial: z.boolean(),
	sales_minor: BigIntColumn,
	bills: IntColumn,
	average_bill_minor: BigIntColumn,
	claims: IntColumn,
	redemptions: IntColumn,
});

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

const ActivityTotalsRowSchema = z.object({
	sales_minor: BigIntColumn,
	bills: IntColumn,
	average_bill_minor: BigIntColumn,
	customers: IntColumn,
	merchants: IntColumn,
	claims: IntColumn,
	redemptions: IntColumn,
	previous_sales_minor: BigIntColumn,
	previous_bills: IntColumn,
	previous_average_bill_minor: BigIntColumn,
	previous_customers: IntColumn,
	previous_merchants: IntColumn,
	previous_claims: IntColumn,
	previous_redemptions: IntColumn,
});

/** New vs returning customers: "new" = their first bill ever (in the scope) falls in the bucket / range. */
export interface CustomerCohort {
	readonly newCustomers: number;
	readonly returningCustomers: number;
}

export interface CustomerCohortBucket extends CustomerCohort {
	readonly startMs: number;
}

const CustomerCohortBucketRowSchema = z.object({ start_ms: BigIntColumn, new_customers: IntColumn, returning_customers: IntColumn });

const CustomerCohortTotalsRowSchema = z.object({
	new_customers: IntColumn,
	returning_customers: IntColumn,
	previous_new_customers: IntColumn,
	previous_returning_customers: IntColumn,
});

/** One customer's claims of a range by their current status (statuses without claims are absent). */
export interface ClaimStatusCount {
	readonly status: RewardClaimStatus;
	readonly claims: number;
}

const ClaimStatusCountRowSchema = z.object({ status: RewardClaimStatusSchema, claims: IntColumn });

/** One customer's referral activity in a range. */
export interface ReferralTotals {
	/** Referrals the customer started (created in the range). */
	readonly sent: number;
	/** The customer's referrals credited in the range. */
	readonly credited: number;
	/** Referrer reward claims the customer received in the range. */
	readonly rewardsEarned: number;
}

const ReferralTotalsRowSchema = z.object({
	sent: IntColumn,
	credited: IntColumn,
	rewards_earned: IntColumn,
	previous_sent: IntColumn,
	previous_credited: IntColumn,
	previous_rewards_earned: IntColumn,
});

/**
 * Time-bucketed and whole-range activity aggregates (paid bills, claims,
 * redemptions, customer cohorts), computed in Postgres — never one row per
 * bill in JS. Indexes: `reward_sales (organization_id, paid_at)` /
 * `(user_id, paid_at)` / `(paid_at)`, `reward_redemptions (organization_id)` /
 * `(user_id)` / `(redeemed_at)`, `reward_claims (reward_id)` / `(user_id)`.
 */
@Injectable()
export class AnalyticsFactsRepository {
	public constructor(private readonly sql: AnalyticsSqlRunner) {}

	/** Every bucket of `window` (empty ones as zero), with the scope's bills, claims and redemptions. */
	public async activitySeries(scope: AnalyticsScope, window: AnalyticsWindow): Promise<ActivityBucket[]> {
		const rows = await this.sql.rows(
			ActivityBucketRowSchema,
			Prisma.sql`
			WITH ${bucketsCte(window)},
			sales AS (
				SELECT ${localBucketOf(Prisma.sql`s.paid_at`, window)} AS local_start, SUM(s.bill_total_minor) AS sales_minor, COUNT(*) AS bills
				FROM reward_sales s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, window)])}
				GROUP BY 1
			),
			claims AS (
				SELECT ${localBucketOf(Prisma.sql`c.claimed_at`, window)} AS local_start, COUNT(*) AS claims
				FROM ${claimSource(scope)}
				WHERE ${allOf([...claimConditions(scope), withinRange(Prisma.sql`c.claimed_at`, window)])}
				GROUP BY 1
			),
			redemptions AS (
				SELECT ${localBucketOf(Prisma.sql`rd.redeemed_at`, window)} AS local_start, COUNT(*) AS redemptions
				FROM reward_redemptions rd JOIN reward_claims c ON c.id = rd.claim_id
				WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd.redeemed_at`, window)])}
				GROUP BY 1
			)
			SELECT b.start_ms, b.end_ms, b.is_partial,
			       COALESCE(sa.sales_minor, 0)::bigint AS sales_minor,
			       COALESCE(sa.bills, 0)::int AS bills,
			       ${averageSql(Prisma.sql`COALESCE(sa.sales_minor, 0)`, Prisma.sql`COALESCE(sa.bills, 0)`)} AS average_bill_minor,
			       COALESCE(cl.claims, 0)::int AS claims,
			       COALESCE(rd.redemptions, 0)::int AS redemptions
			FROM buckets b
			LEFT JOIN sales sa ON sa.local_start = b.local_start
			LEFT JOIN claims cl ON cl.local_start = b.local_start
			LEFT JOIN redemptions rd ON rd.local_start = b.local_start
			ORDER BY b.local_start`,
		);
		return rows.map((row) => ({
			startMs: Number(row.start_ms),
			endMs: Number(row.end_ms),
			isPartial: row.is_partial,
			salesMinor: minorUnitsToNumber(row.sales_minor),
			bills: row.bills,
			averageBillMinor: minorUnitsToNumber(row.average_bill_minor),
			claims: row.claims,
			redemptions: row.redemptions,
		}));
	}

	/** Whole-range totals of `range` and of `previous` (one statement, one scan per fact table). */
	public async activityTotals(scope: AnalyticsScope, range: AnalyticsTimeRange, previous: AnalyticsTimeRange): Promise<ComparedActivityTotals> {
		const span: AnalyticsTimeRange = { fromMs: previous.fromMs, toMs: range.toMs };
		const isCurrent = (column: Prisma.Sql): Prisma.Sql => withinRange(column, range);
		const isPrevious = (column: Prisma.Sql): Prisma.Sql => withinRange(column, previous);
		const row = await this.sql.row(
			ActivityTotalsRowSchema,
			Prisma.sql`
			WITH sales AS (
				SELECT COALESCE(SUM(s.bill_total_minor) FILTER (WHERE ${isCurrent(Prisma.sql`s.paid_at`)}), 0) AS sales_minor,
				       COUNT(*) FILTER (WHERE ${isCurrent(Prisma.sql`s.paid_at`)}) AS bills,
				       COUNT(DISTINCT s.user_id) FILTER (WHERE ${isCurrent(Prisma.sql`s.paid_at`)}) AS customers,
				       COUNT(DISTINCT s.organization_id) FILTER (WHERE ${isCurrent(Prisma.sql`s.paid_at`)}) AS merchants,
				       COALESCE(SUM(s.bill_total_minor) FILTER (WHERE ${isPrevious(Prisma.sql`s.paid_at`)}), 0) AS previous_sales_minor,
				       COUNT(*) FILTER (WHERE ${isPrevious(Prisma.sql`s.paid_at`)}) AS previous_bills,
				       COUNT(DISTINCT s.user_id) FILTER (WHERE ${isPrevious(Prisma.sql`s.paid_at`)}) AS previous_customers,
				       COUNT(DISTINCT s.organization_id) FILTER (WHERE ${isPrevious(Prisma.sql`s.paid_at`)}) AS previous_merchants
				FROM reward_sales s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, span)])}
			),
			claims AS (
				SELECT COUNT(*) FILTER (WHERE ${isCurrent(Prisma.sql`c.claimed_at`)}) AS claims,
				       COUNT(*) FILTER (WHERE ${isPrevious(Prisma.sql`c.claimed_at`)}) AS previous_claims
				FROM ${claimSource(scope)}
				WHERE ${allOf([...claimConditions(scope), withinRange(Prisma.sql`c.claimed_at`, span)])}
			),
			redemptions AS (
				SELECT COUNT(*) FILTER (WHERE ${isCurrent(Prisma.sql`rd.redeemed_at`)}) AS redemptions,
				       COUNT(*) FILTER (WHERE ${isPrevious(Prisma.sql`rd.redeemed_at`)}) AS previous_redemptions
				FROM reward_redemptions rd JOIN reward_claims c ON c.id = rd.claim_id
				WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd.redeemed_at`, span)])}
			)
			SELECT sales.sales_minor::bigint AS sales_minor,
			       sales.bills::int AS bills,
			       ${averageSql(Prisma.sql`sales.sales_minor`, Prisma.sql`sales.bills`)} AS average_bill_minor,
			       sales.customers::int AS customers,
			       sales.merchants::int AS merchants,
			       claims.claims::int AS claims,
			       redemptions.redemptions::int AS redemptions,
			       sales.previous_sales_minor::bigint AS previous_sales_minor,
			       sales.previous_bills::int AS previous_bills,
			       ${averageSql(Prisma.sql`sales.previous_sales_minor`, Prisma.sql`sales.previous_bills`)} AS previous_average_bill_minor,
			       sales.previous_customers::int AS previous_customers,
			       sales.previous_merchants::int AS previous_merchants,
			       claims.previous_claims::int AS previous_claims,
			       redemptions.previous_redemptions::int AS previous_redemptions
			FROM sales CROSS JOIN claims CROSS JOIN redemptions`,
		);
		return {
			current: {
				salesMinor: minorUnitsToNumber(row.sales_minor),
				bills: row.bills,
				averageBillMinor: minorUnitsToNumber(row.average_bill_minor),
				customers: row.customers,
				merchants: row.merchants,
				claims: row.claims,
				redemptions: row.redemptions,
			},
			previous: {
				salesMinor: minorUnitsToNumber(row.previous_sales_minor),
				bills: row.previous_bills,
				averageBillMinor: minorUnitsToNumber(row.previous_average_bill_minor),
				customers: row.previous_customers,
				merchants: row.previous_merchants,
				claims: row.previous_claims,
				redemptions: row.previous_redemptions,
			},
		};
	}

	/** When the first live bill in `scope` was paid (all time), or `null` before any. Served by the `(scope, paid_at)` indexes. */
	public async firstBillAt(scope: AnalyticsScope): Promise<number | null> {
		const row = await this.sql.row(
			z.object({ first_paid_at: BigIntColumn.nullable() }),
			Prisma.sql`SELECT MIN(s.paid_at) AS first_paid_at FROM reward_sales s WHERE ${allOf(salesConditions(scope))}`,
		);
		return row.first_paid_at === null ? null : Number(row.first_paid_at);
	}

	/**
	 * New vs returning customers per bucket: a buyer of the bucket is NEW when
	 * their first bill ever in `scope` was paid inside the bucket (clipped to
	 * the window), RETURNING when it was paid before. The first bill is looked
	 * up per buyer through the `(user_id, paid_at)` index — never a scan of all
	 * history.
	 */
	public async customerCohortSeries(scope: AnalyticsScope, window: AnalyticsWindow): Promise<CustomerCohortBucket[]> {
		const rows = await this.sql.rows(
			CustomerCohortBucketRowSchema,
			Prisma.sql`
			WITH ${bucketsCte(window)},
			buyers AS (
				SELECT DISTINCT ${localBucketOf(Prisma.sql`s.paid_at`, window)} AS local_start, s.user_id
				FROM reward_sales s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, window)])}
			),
			first_bills AS (
				SELECT u.user_id, (SELECT MIN(s.paid_at) FROM reward_sales s WHERE ${allOf([...salesConditions(scope), Prisma.sql`s.user_id = u.user_id`])}) AS first_paid_at
				FROM (SELECT DISTINCT user_id FROM buyers) u
			),
			cohorts AS (
				SELECT bu.local_start,
				       COUNT(*) FILTER (WHERE fb.first_paid_at >= b.start_ms) AS new_customers,
				       COUNT(*) FILTER (WHERE fb.first_paid_at < b.start_ms) AS returning_customers
				FROM buyers bu
				JOIN buckets b ON b.local_start = bu.local_start
				JOIN first_bills fb ON fb.user_id = bu.user_id
				GROUP BY bu.local_start
			)
			SELECT b.start_ms, COALESCE(co.new_customers, 0)::int AS new_customers, COALESCE(co.returning_customers, 0)::int AS returning_customers
			FROM buckets b LEFT JOIN cohorts co ON co.local_start = b.local_start
			ORDER BY b.local_start`,
		);
		return rows.map((row) => ({ startMs: Number(row.start_ms), newCustomers: row.new_customers, returningCustomers: row.returning_customers }));
	}

	/** {@link customerCohortSeries} over the whole of `range` and of `previous`. */
	public async customerCohortTotals(
		scope: AnalyticsScope,
		range: AnalyticsTimeRange,
		previous: AnalyticsTimeRange,
	): Promise<{ readonly current: CustomerCohort; readonly previous: CustomerCohort }> {
		const span: AnalyticsTimeRange = { fromMs: previous.fromMs, toMs: range.toMs };
		const row = await this.sql.row(
			CustomerCohortTotalsRowSchema,
			Prisma.sql`
			WITH buyers AS (
				SELECT s.user_id,
				       bool_or(${withinRange(Prisma.sql`s.paid_at`, range)}) AS in_current,
				       bool_or(${withinRange(Prisma.sql`s.paid_at`, previous)}) AS in_previous
				FROM reward_sales s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, span)])}
				GROUP BY s.user_id
			),
			first_bills AS (
				SELECT bu.in_current, bu.in_previous,
				       (SELECT MIN(s.paid_at) FROM reward_sales s WHERE ${allOf([...salesConditions(scope), Prisma.sql`s.user_id = bu.user_id`])}) AS first_paid_at
				FROM buyers bu
			)
			SELECT COUNT(*) FILTER (WHERE in_current AND first_paid_at >= ${range.fromMs}::bigint)::int AS new_customers,
			       COUNT(*) FILTER (WHERE in_current AND first_paid_at < ${range.fromMs}::bigint)::int AS returning_customers,
			       COUNT(*) FILTER (WHERE in_previous AND first_paid_at >= ${previous.fromMs}::bigint)::int AS previous_new_customers,
			       COUNT(*) FILTER (WHERE in_previous AND first_paid_at < ${previous.fromMs}::bigint)::int AS previous_returning_customers
			FROM first_bills`,
		);
		return {
			current: { newCustomers: row.new_customers, returningCustomers: row.returning_customers },
			previous: { newCustomers: row.previous_new_customers, returningCustomers: row.previous_returning_customers },
		};
	}

	/**
	 * The customer's claims made in `range` (`claimed_at`, half-open) grouped by
	 * their current status. Self only: `userId` is the caller (and RLS
	 * `app_owns(user_id)` applies). Served by `reward_claims (user_id, claimed_at)`.
	 */
	public async customerClaimStatuses(userId: string, range: AnalyticsTimeRange): Promise<ClaimStatusCount[]> {
		const rows = await this.sql.rows(
			ClaimStatusCountRowSchema,
			Prisma.sql`
			SELECT c.status::text AS status, COUNT(*)::int AS claims
			FROM reward_claims c
			WHERE ${allOf([Prisma.sql`c.is_deleted = false`, Prisma.sql`c.user_id = ${userId}`, withinRange(Prisma.sql`c.claimed_at`, range)])}
			GROUP BY c.status
			ORDER BY c.status`,
		);
		return rows.map((row) => ({ status: row.status, claims: row.claims }));
	}

	/**
	 * The customer's referral activity in `range` and `previous` (one
	 * statement): referrals they started (`created_at`), referrals credited
	 * (`credited_at`, status CREDITED) and the referrer reward claims they
	 * received (`is_referrer_credit`, `claimed_at`). Self only — `userId` is the
	 * caller. Served by `reward_referrals (referrer_user_id)` and
	 * `reward_claims (user_id, claimed_at)`.
	 */
	public async customerReferralTotals(
		userId: string,
		range: AnalyticsTimeRange,
		previous: AnalyticsTimeRange,
	): Promise<{ readonly current: ReferralTotals; readonly previous: ReferralTotals }> {
		const span: AnalyticsTimeRange = { fromMs: previous.fromMs, toMs: range.toMs };
		const credited = (window: AnalyticsTimeRange): Prisma.Sql => Prisma.sql`rf.status = 'CREDITED' AND ${withinRange(Prisma.sql`rf.credited_at`, window)}`;
		const row = await this.sql.row(
			ReferralTotalsRowSchema,
			Prisma.sql`
			WITH referrals AS (
				SELECT COUNT(*) FILTER (WHERE ${withinRange(Prisma.sql`rf.created_at`, range)}) AS sent,
				       COUNT(*) FILTER (WHERE ${credited(range)}) AS credited,
				       COUNT(*) FILTER (WHERE ${withinRange(Prisma.sql`rf.created_at`, previous)}) AS previous_sent,
				       COUNT(*) FILTER (WHERE ${credited(previous)}) AS previous_credited
				FROM reward_referrals rf
				WHERE rf.is_deleted = false AND rf.referrer_user_id = ${userId}
				  AND (${withinRange(Prisma.sql`rf.created_at`, span)} OR ${withinRange(Prisma.sql`rf.credited_at`, span)})
			),
			earned AS (
				SELECT COUNT(*) FILTER (WHERE ${withinRange(Prisma.sql`c.claimed_at`, range)}) AS rewards_earned,
				       COUNT(*) FILTER (WHERE ${withinRange(Prisma.sql`c.claimed_at`, previous)}) AS previous_rewards_earned
				FROM reward_claims c
				WHERE c.is_deleted = false AND c.is_referrer_credit = true AND c.user_id = ${userId} AND ${withinRange(Prisma.sql`c.claimed_at`, span)}
			)
			SELECT referrals.sent::int AS sent, referrals.credited::int AS credited, earned.rewards_earned::int AS rewards_earned,
			       referrals.previous_sent::int AS previous_sent, referrals.previous_credited::int AS previous_credited,
			       earned.previous_rewards_earned::int AS previous_rewards_earned
			FROM referrals CROSS JOIN earned`,
		);
		return {
			current: { sent: row.sent, credited: row.credited, rewardsEarned: row.rewards_earned },
			previous: { sent: row.previous_sent, credited: row.previous_credited, rewardsEarned: row.previous_rewards_earned },
		};
	}
}
