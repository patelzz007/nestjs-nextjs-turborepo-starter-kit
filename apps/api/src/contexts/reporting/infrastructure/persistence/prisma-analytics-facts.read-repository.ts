import { Prisma } from "@prisma/client";
import { RewardClaimStatusSchema } from "@workspace/shared";
import { z } from "zod";

import type {
	ActivityBucket,
	AnalyticsFactsReadPort,
	ClaimStatusCount,
	ComparedActivityTotals,
	CustomerCohort,
	CustomerCohortBucket,
	ReferralTotals,
} from "../../application/ports/analytics-facts.port";
import type { AnalyticsScope, AnalyticsTimeRange, AnalyticsWindow } from "../../domain/value-objects/analytics-scope.value-object";
import { allOf, claimConditions, claimSource, redemptionConditions, salesConditions, withinRange } from "./analytics-sql-conditions";
import { minorUnitsToNumber } from "../../../../platform/infrastructure/persistence/minor-units";
import { type AnalyticsSqlRunner, averageSql, bucketsCte, localBucketOf } from "./analytics-sql";

/** Postgres `BIGINT` arrives as `bigint`, `INT` as `number`. */
const BigIntColumn = z.bigint();
const IntColumn = z.number().int().nonnegative();

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

const CustomerCohortBucketRowSchema = z.object({ start_ms: BigIntColumn, new_customers: IntColumn, returning_customers: IntColumn });

const CustomerCohortTotalsRowSchema = z.object({
	new_customers: IntColumn,
	returning_customers: IntColumn,
	previous_new_customers: IntColumn,
	previous_returning_customers: IntColumn,
});

const ClaimStatusCountRowSchema = z.object({ status: RewardClaimStatusSchema, claims: IntColumn });

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
 * bill in JS. Indexes: `"RewardSale" ("tenantId", "paidAt")` /
 * `(user_id, paid_at)` / `(paid_at)`, `reward_redemptions (tenant_id)` /
 * `(user_id)` / `(redeemed_at)`, `reward_claims (reward_id)` / `(user_id)`.
 */
export class PrismaAnalyticsFactsReadRepository implements AnalyticsFactsReadPort {
	public constructor(private readonly sql: AnalyticsSqlRunner) {}

	/** Every bucket of `window` (empty ones as zero), with the scope's bills, claims and redemptions. */
	public async activitySeries(scope: AnalyticsScope, window: AnalyticsWindow): Promise<ActivityBucket[]> {
		const rows = await this.sql.rowsFor(
			scope,
			ActivityBucketRowSchema,
			Prisma.sql`
			WITH ${bucketsCte(window)},
			sales AS (
				SELECT ${localBucketOf(Prisma.sql`s."paidAt"`, window)} AS local_start, SUM(s."billTotalMinor") AS sales_minor, COUNT(*) AS bills
				FROM "RewardSale" s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, window)])}
				GROUP BY 1
			),
			claims AS (
				SELECT ${localBucketOf(Prisma.sql`c."claimedAt"`, window)} AS local_start, COUNT(*) AS claims
				FROM ${claimSource(scope)}
				WHERE ${allOf([...claimConditions(scope), withinRange(Prisma.sql`c."claimedAt"`, window)])}
				GROUP BY 1
			),
			redemptions AS (
				SELECT ${localBucketOf(Prisma.sql`rd."redeemedAt"`, window)} AS local_start, COUNT(*) AS redemptions
				FROM "RewardRedemption" rd JOIN "RewardClaim" c ON c.id = rd."claimId"
				WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd."redeemedAt"`, window)])}
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
		const row = await this.sql.rowFor(
			scope,
			ActivityTotalsRowSchema,
			Prisma.sql`
			WITH sales AS (
				SELECT COALESCE(SUM(s."billTotalMinor") FILTER (WHERE ${isCurrent(Prisma.sql`s."paidAt"`)}), 0) AS sales_minor,
				       COUNT(*) FILTER (WHERE ${isCurrent(Prisma.sql`s."paidAt"`)}) AS bills,
				       COUNT(DISTINCT s."userId") FILTER (WHERE ${isCurrent(Prisma.sql`s."paidAt"`)}) AS customers,
				       COUNT(DISTINCT s."tenantId") FILTER (WHERE ${isCurrent(Prisma.sql`s."paidAt"`)}) AS merchants,
				       COALESCE(SUM(s."billTotalMinor") FILTER (WHERE ${isPrevious(Prisma.sql`s."paidAt"`)}), 0) AS previous_sales_minor,
				       COUNT(*) FILTER (WHERE ${isPrevious(Prisma.sql`s."paidAt"`)}) AS previous_bills,
				       COUNT(DISTINCT s."userId") FILTER (WHERE ${isPrevious(Prisma.sql`s."paidAt"`)}) AS previous_customers,
				       COUNT(DISTINCT s."tenantId") FILTER (WHERE ${isPrevious(Prisma.sql`s."paidAt"`)}) AS previous_merchants
				FROM "RewardSale" s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, span)])}
			),
			claims AS (
				SELECT COUNT(*) FILTER (WHERE ${isCurrent(Prisma.sql`c."claimedAt"`)}) AS claims,
				       COUNT(*) FILTER (WHERE ${isPrevious(Prisma.sql`c."claimedAt"`)}) AS previous_claims
				FROM ${claimSource(scope)}
				WHERE ${allOf([...claimConditions(scope), withinRange(Prisma.sql`c."claimedAt"`, span)])}
			),
			redemptions AS (
				SELECT COUNT(*) FILTER (WHERE ${isCurrent(Prisma.sql`rd."redeemedAt"`)}) AS redemptions,
				       COUNT(*) FILTER (WHERE ${isPrevious(Prisma.sql`rd."redeemedAt"`)}) AS previous_redemptions
				FROM "RewardRedemption" rd JOIN "RewardClaim" c ON c.id = rd."claimId"
				WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd."redeemedAt"`, span)])}
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
		const row = await this.sql.rowFor(
			scope,
			z.object({ first_paid_at: BigIntColumn.nullable() }),
			Prisma.sql`SELECT MIN(s."paidAt") AS first_paid_at FROM "RewardSale" s WHERE ${allOf(salesConditions(scope))}`,
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
		const rows = await this.sql.rowsFor(
			scope,
			CustomerCohortBucketRowSchema,
			Prisma.sql`
			WITH ${bucketsCte(window)},
			buyers AS (
				SELECT DISTINCT ${localBucketOf(Prisma.sql`s."paidAt"`, window)} AS local_start, s."userId"
				FROM "RewardSale" s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, window)])}
			),
			first_bills AS (
				SELECT u."userId", (SELECT MIN(s."paidAt") FROM "RewardSale" s WHERE ${allOf([...salesConditions(scope), Prisma.sql`s."userId" = u."userId"`])}) AS first_paid_at
				FROM (SELECT DISTINCT "userId" FROM buyers) u
			),
			cohorts AS (
				SELECT bu.local_start,
				       COUNT(*) FILTER (WHERE fb.first_paid_at >= b.start_ms) AS new_customers,
				       COUNT(*) FILTER (WHERE fb.first_paid_at < b.start_ms) AS returning_customers
				FROM buyers bu
				JOIN buckets b ON b.local_start = bu.local_start
				JOIN first_bills fb ON fb."userId" = bu."userId"
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
		const row = await this.sql.rowFor(
			scope,
			CustomerCohortTotalsRowSchema,
			Prisma.sql`
			WITH buyers AS (
				SELECT s."userId",
				       bool_or(${withinRange(Prisma.sql`s."paidAt"`, range)}) AS in_current,
				       bool_or(${withinRange(Prisma.sql`s."paidAt"`, previous)}) AS in_previous
				FROM "RewardSale" s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, span)])}
				GROUP BY s."userId"
			),
			first_bills AS (
				SELECT bu.in_current, bu.in_previous,
				       (SELECT MIN(s."paidAt") FROM "RewardSale" s WHERE ${allOf([...salesConditions(scope), Prisma.sql`s."userId" = bu."userId"`])}) AS first_paid_at
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
	 * The customer's claims made in `range` (`claimedAt`, half-open) grouped by
	 * their current status. Self only: `userId` is the caller (and RLS
	 * `app_owns(user_id)` applies). Served by `reward_claims (user_id, claimed_at)`.
	 */
	public async customerClaimStatuses(userId: string, range: AnalyticsTimeRange): Promise<ClaimStatusCount[]> {
		const rows = await this.sql.rows(
			ClaimStatusCountRowSchema,
			Prisma.sql`
			SELECT c.status::text AS status, COUNT(*)::int AS claims
			FROM "RewardClaim" c
			WHERE ${allOf([Prisma.sql`c."isDeleted" = false`, Prisma.sql`c."userId" = ${userId}`, withinRange(Prisma.sql`c."claimedAt"`, range)])}
			GROUP BY c.status
			ORDER BY c.status`,
		);
		return rows.map((row) => ({ status: row.status, claims: row.claims }));
	}

	/**
	 * The customer's referral activity in `range` and `previous` (one
	 * statement): referrals they started (`createdAt`), referrals credited
	 * (`creditedAt`, status CREDITED) and the referrer reward claims they
	 * received (`isReferrerCredit`, `claimedAt`). Self only — `userId` is the
	 * caller. Served by `reward_referrals (referrer_user_id)` and
	 * `reward_claims (user_id, claimed_at)`.
	 */
	public async customerReferralTotals(
		userId: string,
		range: AnalyticsTimeRange,
		previous: AnalyticsTimeRange,
	): Promise<{ readonly current: ReferralTotals; readonly previous: ReferralTotals }> {
		const span: AnalyticsTimeRange = { fromMs: previous.fromMs, toMs: range.toMs };
		const credited = (window: AnalyticsTimeRange): Prisma.Sql => Prisma.sql`rf.status = 'CREDITED' AND ${withinRange(Prisma.sql`rf."creditedAt"`, window)}`;
		const row = await this.sql.row(
			ReferralTotalsRowSchema,
			Prisma.sql`
			WITH referrals AS (
				SELECT COUNT(*) FILTER (WHERE ${withinRange(Prisma.sql`rf."createdAt"`, range)}) AS sent,
				       COUNT(*) FILTER (WHERE ${credited(range)}) AS credited,
				       COUNT(*) FILTER (WHERE ${withinRange(Prisma.sql`rf."createdAt"`, previous)}) AS previous_sent,
				       COUNT(*) FILTER (WHERE ${credited(previous)}) AS previous_credited
				FROM "RewardReferral" rf
				WHERE rf."isDeleted" = false AND rf."referrerUserId" = ${userId}
				  AND (${withinRange(Prisma.sql`rf."createdAt"`, span)} OR ${withinRange(Prisma.sql`rf."creditedAt"`, span)})
			),
			earned AS (
				SELECT COUNT(*) FILTER (WHERE ${withinRange(Prisma.sql`c."claimedAt"`, range)}) AS rewards_earned,
				       COUNT(*) FILTER (WHERE ${withinRange(Prisma.sql`c."claimedAt"`, previous)}) AS previous_rewards_earned
				FROM "RewardClaim" c
				WHERE c."isDeleted" = false AND c."isReferrerCredit" = true AND c."userId" = ${userId} AND ${withinRange(Prisma.sql`c."claimedAt"`, span)}
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
