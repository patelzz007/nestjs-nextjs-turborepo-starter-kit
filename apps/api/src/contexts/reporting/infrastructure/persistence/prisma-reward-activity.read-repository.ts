import { Prisma } from "@prisma/client";
import { RewardClaimStatusSchema, type RewardClaimStatus } from "@workspace/shared";
import { z } from "zod";

import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
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
} from "../../application/ports/reward-activity-read.port";
import type { InclusiveRange } from "../../application/ports/sales-read.port";
import type { AnalyticsLocationScope, AnalyticsScope } from "../../domain/value-objects/analytics-scope.value-object";
import { allOf, claimConditions, claimSource, redemptionConditions, weekStartMsSql, withinInclusive } from "./analytics-sql-conditions";

const MerchantTotalsRowSchema = z.object({
	claims_current: z.number().int().nonnegative(),
	claims_previous: z.number().int().nonnegative(),
	redemptions_current: z.number().int().nonnegative(),
	redemptions_previous: z.number().int().nonnegative(),
});
const ActivityWeekRowSchema = z.object({ week_start_ms: z.bigint(), claims: z.number().int().nonnegative(), redemptions: z.number().int().nonnegative() });
const RewardActivityRowSchema = z.object({ rewardId: z.string(), claims: z.number().int().nonnegative(), redemptions: z.number().int().nonnegative() });
const ClaimStatusRowSchema = z.object({ status: RewardClaimStatusSchema, current: z.number().int().nonnegative(), previous: z.number().int().nonnegative() });
const PeriodCountsSchema = z.object({ current: z.number().int().nonnegative(), previous: z.number().int().nonnegative() });
const ClaimsByStatusSchema = z.object({ PENDING: PeriodCountsSchema, REDEEMED: PeriodCountsSchema, EXPIRED: PeriodCountsSchema });
const ReferralTotalsRowSchema = z.object({
	sent_current: z.number().int().nonnegative(),
	sent_previous: z.number().int().nonnegative(),
	credited_current: z.number().int().nonnegative(),
	credited_previous: z.number().int().nonnegative(),
});

function toActivityWeek(row: z.output<typeof ActivityWeekRowSchema>): ActivityWeek {
	return { weekStartMs: Number(row.week_start_ms), claims: row.claims, redemptions: row.redemptions };
}

/** Rewards available at a store of `scope`: tenant-wide rewards plus those limited to one of its stores. */
function rewardAvailabilityWhere(scope: AnalyticsLocationScope): Prisma.RewardWhereInput {
	if (scope.kind === "ALL_LOCATIONS") {
		return {};
	}
	return { OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [...scope.locationIds] } } } }] };
}

/** The tenant's live rewards offered at a store of `scope` (the relation filter of a claim / referral). */
function tenantRewardWhere(tenantId: string, scope: AnalyticsLocationScope): Prisma.RewardWhereInput {
	return { AND: [{ tenantId, isDeleted: false }, rewardAvailabilityWhere(scope)] };
}

/**
 * Reward, claim, redemption and referral facts for the weekly analytics. Reporting owns no model: these are
 * read-only fact reads (§6.2) inside a transaction that keeps the caller's already-bound RLS session.
 */
export class PrismaRewardActivityReadRepository implements RewardActivityReadPort {
	public constructor(private readonly transactions: TenantTransactionService) {}

	private run<TResult>(reason: string, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withBoundSession(reason, work);
	}

	public async countRewards(filter: RewardCountFilter): Promise<number> {
		const rewardWhere: Prisma.RewardWhereInput = {
			AND: [{ tenantId: filter.tenantId, isDeleted: false, rewardKind: "CONSUMER" }, rewardAvailabilityWhere(filter.locationScope)],
		};
		return this.run("Count a merchant's rewards", (db) =>
			db.reward.count({
				where: {
					...rewardWhere,
					...(filter.publishedOnly ? { status: "PUBLISHED" } : {}),
					...(filter.createdIn !== undefined ? { createdAt: { gte: filter.createdIn.gte, lte: filter.createdIn.lte } } : {}),
					...(filter.reviewedIn !== undefined ? { reviewedAt: { gte: filter.reviewedIn.gte, lte: filter.reviewedIn.lte } } : {}),
				},
			}),
		);
	}

	public async merchantActivity(tenantId: string, periods: ComparedPeriods, locationScope: AnalyticsLocationScope, topRewards: number): Promise<MerchantActivity> {
		const scope: AnalyticsScope = { kind: "tenant", tenantId, locationScope };
		const both: InclusiveRange = { gte: periods.previous.gte, lte: periods.current.lte };
		// One row per claim or redemption of both periods, with its reward; every count below groups it.
		const activity = Prisma.sql`
			SELECT c."rewardId" AS "rewardId", c."claimedAt" AS at, 1 AS claims, 0 AS redemptions
			  FROM ${claimSource(scope)}
			 WHERE ${allOf([...claimConditions(scope), withinInclusive(Prisma.sql`c."claimedAt"`, both)])}
			UNION ALL
			SELECT c."rewardId", rd."redeemedAt", 0, 1
			  FROM "RewardRedemption" rd JOIN "RewardClaim" c ON c.id = rd."claimId"
			 WHERE ${allOf([...redemptionConditions(scope), withinInclusive(Prisma.sql`rd."redeemedAt"`, both)])}`;
		const current = withinInclusive(Prisma.sql`at`, periods.current);
		const [totals, weeks, rewards] = await this.run("Merchant weekly reward activity", (db) =>
			Promise.all([
				db.$queryRaw`
				SELECT COALESCE(SUM(claims) FILTER (WHERE ${current}), 0)::int AS claims_current,
				       COALESCE(SUM(claims) FILTER (WHERE ${withinInclusive(Prisma.sql`at`, periods.previous)}), 0)::int AS claims_previous,
				       COALESCE(SUM(redemptions) FILTER (WHERE ${current}), 0)::int AS redemptions_current,
				       COALESCE(SUM(redemptions) FILTER (WHERE ${withinInclusive(Prisma.sql`at`, periods.previous)}), 0)::int AS redemptions_previous
				  FROM (${activity}) activity`,
				db.$queryRaw`
				SELECT ${weekStartMsSql(Prisma.sql`at`, periods.timeZone)} AS week_start_ms, SUM(claims)::int AS claims, SUM(redemptions)::int AS redemptions
				  FROM (${activity}) activity
				 WHERE ${current}
				 GROUP BY 1
				 ORDER BY 1`,
				db.$queryRaw`
				SELECT "rewardId", SUM(claims)::int AS claims, SUM(redemptions)::int AS redemptions
				  FROM (${activity}) activity
				 WHERE ${current}
				 GROUP BY "rewardId"
				 ORDER BY SUM(claims) + SUM(redemptions) DESC, "rewardId"
				 LIMIT ${topRewards}`,
			]),
		);
		const [counts] = z.tuple([MerchantTotalsRowSchema]).parse(totals);
		return {
			claims: { current: counts.claims_current, previous: counts.claims_previous },
			redemptions: { current: counts.redemptions_current, previous: counts.redemptions_previous },
			weeks: ActivityWeekRowSchema.array().parse(weeks).map(toActivityWeek),
			topRewards: RewardActivityRowSchema.array()
				.parse(rewards)
				.map((row): RewardActivityCounts => ({ rewardId: row.rewardId, claims: row.claims, redemptions: row.redemptions })),
		};
	}

	public async countMerchantReferrals(tenantId: string, range: InclusiveRange, locationScope: AnalyticsLocationScope): Promise<number> {
		return this.run("Count a merchant's referrals", (db) =>
			db.rewardReferral.count({
				where: { isDeleted: false, createdAt: { gte: range.gte, lte: range.lte }, reward: tenantRewardWhere(tenantId, locationScope) },
			}),
		);
	}

	public async listRewardTitles(tenantId: string, rewardIds: readonly string[]): Promise<RewardTitle[]> {
		return this.run("Reward titles for a merchant's weekly activity", (db) =>
			db.reward.findMany({ where: { tenantId, id: { in: [...rewardIds] } }, select: { id: true, title: true } }),
		);
	}

	public async customerActivity(userId: string, periods: ComparedPeriods): Promise<CustomerActivity> {
		const scope: AnalyticsScope = { kind: "customer", userId };
		const both: InclusiveRange = { gte: periods.previous.gte, lte: periods.current.lte };
		const ownClaims = allOf([...claimConditions(scope), withinInclusive(Prisma.sql`c."claimedAt"`, both)]);
		const claimedNow = withinInclusive(Prisma.sql`c."claimedAt"`, periods.current);
		const claimedBefore = withinInclusive(Prisma.sql`c."claimedAt"`, periods.previous);
		const sentNow = withinInclusive(Prisma.sql`rr."createdAt"`, periods.current);
		const sentBefore = withinInclusive(Prisma.sql`rr."createdAt"`, periods.previous);
		const [statuses, weeks, referrals] = await this.run("Customer weekly reward activity", (db) =>
			Promise.all([
				db.$queryRaw`
				SELECT c.status::text AS status, (COUNT(*) FILTER (WHERE ${claimedNow}))::int AS current, (COUNT(*) FILTER (WHERE ${claimedBefore}))::int AS previous
				  FROM ${claimSource(scope)}
				 WHERE ${ownClaims}
				 GROUP BY c.status`,
				db.$queryRaw`
				SELECT ${weekStartMsSql(Prisma.sql`at`, periods.timeZone)} AS week_start_ms, SUM(claims)::int AS claims, SUM(redemptions)::int AS redemptions
				  FROM (
					SELECT c."claimedAt" AS at, 1 AS claims, 0 AS redemptions FROM ${claimSource(scope)} WHERE ${ownClaims} AND ${claimedNow}
					UNION ALL
					SELECT c."redeemedAt", 0, 1 FROM ${claimSource(scope)}
					 WHERE ${ownClaims} AND ${claimedNow} AND c.status = 'REDEEMED' AND c."redeemedAt" IS NOT NULL
					   AND ${withinInclusive(Prisma.sql`c."redeemedAt"`, periods.current)}
				  ) activity
				 GROUP BY 1
				 ORDER BY 1`,
				db.$queryRaw`
				SELECT (COUNT(*) FILTER (WHERE ${sentNow}))::int AS sent_current,
				       (COUNT(*) FILTER (WHERE ${sentBefore}))::int AS sent_previous,
				       (COUNT(*) FILTER (WHERE ${sentNow} AND rr.status = 'CREDITED'))::int AS credited_current,
				       (COUNT(*) FILTER (WHERE ${sentBefore} AND rr.status = 'CREDITED'))::int AS credited_previous
				  FROM "RewardReferral" rr
				 WHERE rr."referrerUserId" = ${userId} AND rr."isDeleted" = false AND ${withinInclusive(Prisma.sql`rr."createdAt"`, both)}`,
			]),
		);
		const byStatus = new Map(
			ClaimStatusRowSchema.array()
				.parse(statuses)
				.map((row) => [row.status, row]),
		);
		const claimsByStatus = Object.fromEntries(
			RewardClaimStatusSchema.options.map((status): [RewardClaimStatus, PeriodCounts] => [
				status,
				{ current: byStatus.get(status)?.current ?? 0, previous: byStatus.get(status)?.previous ?? 0 },
			]),
		);
		const [sent] = z.tuple([ReferralTotalsRowSchema]).parse(referrals);
		return {
			claimsByStatus: ClaimsByStatusSchema.parse(claimsByStatus),
			weeks: ActivityWeekRowSchema.array().parse(weeks).map(toActivityWeek),
			referralsSent: { current: sent.sent_current, previous: sent.sent_previous },
			referralsCredited: { current: sent.credited_current, previous: sent.credited_previous },
		};
	}
}
