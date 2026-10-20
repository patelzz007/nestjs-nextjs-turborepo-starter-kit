import { Prisma } from "@prisma/client";
import { MerchantBusinessCategorySchema, PilotCitySchema, RewardRedemptionMethodSchema } from "@workspace/shared";
import { z } from "zod";

import type {
	AnalyticsBreakdownReadPort,
	CategorySalesRow,
	CitySalesRow,
	MerchantBucketSalesRow,
	MerchantSalesRow,
	RedemptionMethodRow,
	RewardBreakdownRow,
	StoreBreakdownRow,
} from "../../application/ports/analytics-breakdown.port";
import type { AnalyticsScope, AnalyticsTimeRange, AnalyticsWindow, TenantAnalyticsScope } from "../../domain/value-objects/analytics-scope.value-object";
import { allOf, claimConditions, claimSource, redemptionConditions, salesConditions, withinRange } from "./analytics-sql-conditions";
import { minorUnitsToNumber } from "../../../../platform/infrastructure/persistence/minor-units";
import { type AnalyticsSqlRunner, averageSql, bucketsCte, localBucketOf } from "./analytics-sql";

const BigIntColumn = z.bigint();
const IntColumn = z.number().int().nonnegative();

const StoreBreakdownRowSchema = z.object({
	locationId: z.string().nullable(),
	name: z.string().nullable(),
	city: PilotCitySchema.nullable(),
	sales_minor: BigIntColumn,
	bills: IntColumn,
	average_bill_minor: BigIntColumn,
	redemptions: IntColumn,
});

const RewardBreakdownRowSchema = z.object({ rewardId: z.string(), title: z.string(), claims: IntColumn, redemptions: IntColumn });

const RedemptionMethodRowSchema = z.object({ method: RewardRedemptionMethodSchema, redemptions: IntColumn });

const MerchantSalesRowSchema = z.object({
	tenantId: z.string(),
	name: z.string(),
	category: MerchantBusinessCategorySchema.nullable(),
	sales_minor: BigIntColumn,
	bills: IntColumn,
	average_bill_minor: BigIntColumn,
});

const CategorySalesRowSchema = z.object({ category: MerchantBusinessCategorySchema.nullable(), sales_minor: BigIntColumn, bills: IntColumn, merchants: IntColumn });

const CitySalesRowSchema = z.object({ city: PilotCitySchema.nullable(), sales_minor: BigIntColumn, bills: IntColumn, merchants: IntColumn });

const MerchantBucketSalesRowSchema = z.object({ tenantId: z.string(), start_ms: BigIntColumn, sales_minor: BigIntColumn, bills: IntColumn });

/**
 * Breakdowns of a range by one dimension (store, reward, redemption method,
 * merchant, merchant category, city), grouped in Postgres. Every query is
 * bounded: by the scope's stores / rewards, or by an explicit `limit`.
 */
export class PrismaAnalyticsBreakdownReadRepository implements AnalyticsBreakdownReadPort {
	public constructor(private readonly sql: AnalyticsSqlRunner) {}

	/**
	 * Every ACTIVE store of the caller's scope (zero rows included), plus any
	 * store that had bills or redemptions in the range (a store closed since),
	 * plus a `location_id: null` row for bills without a store (all-stores
	 * callers only — the scope filter already hides them from the others).
	 * Highest sales first.
	 */
	public async byStore(scope: TenantAnalyticsScope, range: AnalyticsTimeRange): Promise<StoreBreakdownRow[]> {
		const storeFilter = scope.locationScope.kind === "ALL_LOCATIONS" ? Prisma.sql`TRUE` : Prisma.sql`l.id = ANY(${[...scope.locationScope.locationIds]}::text[])`;
		const rows = await this.sql.rowsFor(
			scope,
			StoreBreakdownRowSchema,
			Prisma.sql`
			WITH sales AS (
				SELECT s."locationId", SUM(s."billTotalMinor") AS sales_minor, COUNT(*) AS bills
				FROM "RewardSale" s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, range)])}
				GROUP BY s."locationId"
			),
			redemptions AS (
				SELECT rd."locationId", COUNT(*) AS redemptions
				FROM "RewardRedemption" rd JOIN "RewardClaim" c ON c.id = rd."claimId"
				WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd."redeemedAt"`, range)])}
				GROUP BY rd."locationId"
			),
			store_keys AS (
				SELECT l.id AS "locationId" FROM "Location" l
				WHERE l."tenantId" = ${scope.tenantId} AND l."isDeleted" = false AND l.status = 'ACTIVE' AND ${storeFilter}
				UNION SELECT "locationId" FROM sales
				UNION SELECT "locationId" FROM redemptions
			)
			SELECT k."locationId", l.name, l.city::text AS city,
			       COALESCE(sa.sales_minor, 0)::bigint AS sales_minor,
			       COALESCE(sa.bills, 0)::int AS bills,
			       ${averageSql(Prisma.sql`COALESCE(sa.sales_minor, 0)`, Prisma.sql`COALESCE(sa.bills, 0)`)} AS average_bill_minor,
			       COALESCE(rd.redemptions, 0)::int AS redemptions
			FROM store_keys k
			LEFT JOIN "Location" l ON l.id = k."locationId"
			LEFT JOIN sales sa ON sa."locationId" IS NOT DISTINCT FROM k."locationId"
			LEFT JOIN redemptions rd ON rd."locationId" IS NOT DISTINCT FROM k."locationId"
			ORDER BY sales_minor DESC, l.name ASC NULLS LAST`,
		);
		return rows.map((row) => ({
			locationId: row.locationId,
			name: row.name,
			city: row.city,
			salesMinor: minorUnitsToNumber(row.sales_minor),
			bills: row.bills,
			averageBillMinor: minorUnitsToNumber(row.average_bill_minor),
			redemptions: row.redemptions,
		}));
	}

	/** The `limit` most active rewards of the scope (claims + redemptions in the range), most active first. */
	public async byReward(scope: TenantAnalyticsScope, range: AnalyticsTimeRange, limit: number): Promise<RewardBreakdownRow[]> {
		const rows = await this.sql.rowsFor(
			scope,
			RewardBreakdownRowSchema,
			Prisma.sql`
			WITH claims AS (
				SELECT c."rewardId", COUNT(*) AS claims
				FROM ${claimSource(scope)}
				WHERE ${allOf([...claimConditions(scope), withinRange(Prisma.sql`c."claimedAt"`, range)])}
				GROUP BY c."rewardId"
			),
			redemptions AS (
				SELECT c."rewardId", COUNT(*) AS redemptions
				FROM "RewardRedemption" rd JOIN "RewardClaim" c ON c.id = rd."claimId"
				WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd."redeemedAt"`, range)])}
				GROUP BY c."rewardId"
			),
			reward_keys AS (SELECT "rewardId" FROM claims UNION SELECT "rewardId" FROM redemptions)
			SELECT r.id AS "rewardId", r.title, COALESCE(cl.claims, 0)::int AS claims, COALESCE(rd.redemptions, 0)::int AS redemptions
			FROM reward_keys k
			JOIN "Reward" r ON r.id = k."rewardId"
			LEFT JOIN claims cl ON cl."rewardId" = k."rewardId"
			LEFT JOIN redemptions rd ON rd."rewardId" = k."rewardId"
			ORDER BY COALESCE(cl.claims, 0) + COALESCE(rd.redemptions, 0) DESC, r.title ASC, r.id ASC
			LIMIT ${limit}`,
		);
		return rows.map((row) => ({ rewardId: row.rewardId, title: row.title, claims: row.claims, redemptions: row.redemptions }));
	}

	/** Redemptions per method; methods without redemptions are absent (the service lists every method). */
	public async byRedemptionMethod(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<RedemptionMethodRow[]> {
		const rows = await this.sql.rowsFor(
			scope,
			RedemptionMethodRowSchema,
			Prisma.sql`
			SELECT rd."redemptionMethod"::text AS method, COUNT(*)::int AS redemptions
			FROM "RewardRedemption" rd JOIN "RewardClaim" c ON c.id = rd."claimId"
			WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd."redeemedAt"`, range)])}
			GROUP BY rd."redemptionMethod"`,
		);
		return rows.map((row) => ({ method: row.method, redemptions: row.redemptions }));
	}

	/**
	 * Paid bills per merchant, highest sales first, at most `limit`. Name and
	 * business category come from the tenant (an unknown category reads
	 * as `null`). Reads `Tenant` / `TenantMerchantProfile`, so
	 * it runs only for the admin's platform view (RLS bypass on that route).
	 */
	public async byMerchant(scope: AnalyticsScope, range: AnalyticsTimeRange, limit: number): Promise<MerchantSalesRow[]> {
		const rows = await this.sql.rowsFor(
			scope,
			MerchantSalesRowSchema,
			Prisma.sql`
			SELECT s."tenantId", o."displayName" AS name, ${this.knownCategory()} AS category,
			       SUM(s."billTotalMinor")::bigint AS sales_minor,
			       COUNT(*)::int AS bills,
			       ${averageSql(Prisma.sql`SUM(s."billTotalMinor")`, Prisma.sql`COUNT(*)`)} AS average_bill_minor
			FROM "RewardSale" s
			JOIN "Tenant" o ON o.id = s."tenantId"
			LEFT JOIN "TenantMerchantProfile" mp ON mp."tenantId" = s."tenantId"
			WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, range)])}
			GROUP BY s."tenantId", o."displayName", mp.category
			ORDER BY sales_minor DESC, o."displayName" ASC, s."tenantId" ASC
			LIMIT ${limit}`,
		);
		return rows.map((row) => ({
			tenantId: row.tenantId,
			name: row.name,
			category: row.category,
			salesMinor: minorUnitsToNumber(row.sales_minor),
			bills: row.bills,
			averageBillMinor: minorUnitsToNumber(row.average_bill_minor),
		}));
	}

	/** Paid bills per merchant business category (unknown / missing category → `null`), highest sales first. Admin view only (see {@link byMerchant}). */
	public async byCategory(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<CategorySalesRow[]> {
		const rows = await this.sql.rowsFor(
			scope,
			CategorySalesRowSchema,
			Prisma.sql`
			SELECT ${this.knownCategory()} AS category,
			       SUM(s."billTotalMinor")::bigint AS sales_minor,
			       COUNT(*)::int AS bills,
			       COUNT(DISTINCT s."tenantId")::int AS merchants
			FROM "RewardSale" s
			LEFT JOIN "TenantMerchantProfile" mp ON mp."tenantId" = s."tenantId"
			WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, range)])}
			GROUP BY 1
			ORDER BY sales_minor DESC, category ASC NULLS LAST`,
		);
		return rows.map((row) => ({ category: row.category, salesMinor: minorUnitsToNumber(row.sales_minor), bills: row.bills, merchants: row.merchants }));
	}

	/** Paid bills per city of the store they were paid at (no store → `null`), highest sales first. Admin view only. */
	public async byCity(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<CitySalesRow[]> {
		const rows = await this.sql.rowsFor(
			scope,
			CitySalesRowSchema,
			Prisma.sql`
			SELECT l.city::text AS city,
			       SUM(s."billTotalMinor")::bigint AS sales_minor,
			       COUNT(*)::int AS bills,
			       COUNT(DISTINCT s."tenantId")::int AS merchants
			FROM "RewardSale" s
			LEFT JOIN "Location" l ON l.id = s."locationId"
			WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, range)])}
			GROUP BY l.city
			ORDER BY sales_minor DESC, city ASC NULLS LAST`,
		);
		return rows.map((row) => ({ city: row.city, salesMinor: minorUnitsToNumber(row.sales_minor), bills: row.bills, merchants: row.merchants }));
	}

	/**
	 * Paid bills per (merchant, bucket) of `window` — only the pairs with bills;
	 * `start_ms` is the bucket's (clipped) start, the same value the activity
	 * series reports. Bounded by merchants visited × buckets.
	 */
	public async merchantBucketSales(scope: AnalyticsScope, window: AnalyticsWindow): Promise<MerchantBucketSalesRow[]> {
		const rows = await this.sql.rowsFor(
			scope,
			MerchantBucketSalesRowSchema,
			Prisma.sql`
			WITH ${bucketsCte(window)},
			sales AS (
				SELECT s."tenantId", ${localBucketOf(Prisma.sql`s."paidAt"`, window)} AS local_start, SUM(s."billTotalMinor") AS sales_minor, COUNT(*) AS bills
				FROM "RewardSale" s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s."paidAt"`, window)])}
				GROUP BY 1, 2
			)
			SELECT sa."tenantId", b.start_ms, sa.sales_minor::bigint AS sales_minor, sa.bills::int AS bills
			FROM sales sa JOIN buckets b ON b.local_start = sa.local_start
			ORDER BY sa."tenantId", b.local_start`,
		);
		return rows.map((row) => ({ tenantId: row.tenantId, startMs: Number(row.start_ms), salesMinor: minorUnitsToNumber(row.sales_minor), bills: row.bills }));
	}

	/** `mp.category` when it is one of the known business categories, else NULL — so unknown values group with "uncategorised". */
	private knownCategory(): Prisma.Sql {
		return Prisma.sql`(CASE WHEN mp.category = ANY(${[...MerchantBusinessCategorySchema.options]}::text[]) THEN mp.category END)`;
	}
}
