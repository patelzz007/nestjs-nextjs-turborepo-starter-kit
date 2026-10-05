import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
	MerchantBusinessCategorySchema,
	PilotCitySchema,
	RewardRedemptionMethodSchema,
	type MerchantBusinessCategory,
	type PilotCity,
	type RewardRedemptionMethod,
} from "@workspace/shared";
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

/** One merchant's analytics scope (the store breakdown only exists for a merchant). */
export type OrganizationAnalyticsScope = Extract<AnalyticsScope, { readonly kind: "organization" }>;

const BigIntColumn = z.bigint();
const IntColumn = z.number().int().nonnegative();

export interface StoreBreakdownRow {
	readonly locationId: string | null;
	readonly name: string | null;
	readonly city: PilotCity | null;
	readonly salesMinor: number;
	readonly bills: number;
	readonly averageBillMinor: number;
	readonly redemptions: number;
}

const StoreBreakdownRowSchema = z.object({
	location_id: z.string().nullable(),
	name: z.string().nullable(),
	city: PilotCitySchema.nullable(),
	sales_minor: BigIntColumn,
	bills: IntColumn,
	average_bill_minor: BigIntColumn,
	redemptions: IntColumn,
});

export interface RewardBreakdownRow {
	readonly rewardId: string;
	readonly title: string;
	readonly claims: number;
	readonly redemptions: number;
}

const RewardBreakdownRowSchema = z.object({ reward_id: z.string(), title: z.string(), claims: IntColumn, redemptions: IntColumn });

export interface RedemptionMethodRow {
	readonly method: RewardRedemptionMethod;
	readonly redemptions: number;
}

const RedemptionMethodRowSchema = z.object({ method: RewardRedemptionMethodSchema, redemptions: IntColumn });

export interface MerchantSalesRow {
	readonly organizationId: string;
	readonly name: string;
	readonly category: MerchantBusinessCategory | null;
	readonly salesMinor: number;
	readonly bills: number;
	readonly averageBillMinor: number;
}

const MerchantSalesRowSchema = z.object({
	organization_id: z.string(),
	name: z.string(),
	category: MerchantBusinessCategorySchema.nullable(),
	sales_minor: BigIntColumn,
	bills: IntColumn,
	average_bill_minor: BigIntColumn,
});

export interface CategorySalesRow {
	readonly category: MerchantBusinessCategory | null;
	readonly salesMinor: number;
	readonly bills: number;
	readonly merchants: number;
}

const CategorySalesRowSchema = z.object({ category: MerchantBusinessCategorySchema.nullable(), sales_minor: BigIntColumn, bills: IntColumn, merchants: IntColumn });

export interface CitySalesRow {
	readonly city: PilotCity | null;
	readonly salesMinor: number;
	readonly bills: number;
	readonly merchants: number;
}

const CitySalesRowSchema = z.object({ city: PilotCitySchema.nullable(), sales_minor: BigIntColumn, bills: IntColumn, merchants: IntColumn });

/** One merchant's paid bills in one bucket (only buckets with bills). */
export interface MerchantBucketSalesRow {
	readonly organizationId: string;
	readonly startMs: number;
	readonly salesMinor: number;
	readonly bills: number;
}

const MerchantBucketSalesRowSchema = z.object({ organization_id: z.string(), start_ms: BigIntColumn, sales_minor: BigIntColumn, bills: IntColumn });

/**
 * Breakdowns of a range by one dimension (store, reward, redemption method,
 * merchant, merchant category, city), grouped in Postgres. Every query is
 * bounded: by the scope's stores / rewards, or by an explicit `limit`.
 */
@Injectable()
export class AnalyticsBreakdownRepository {
	public constructor(private readonly sql: AnalyticsSqlRunner) {}

	/**
	 * Every ACTIVE store of the caller's scope (zero rows included), plus any
	 * store that had bills or redemptions in the range (a store closed since),
	 * plus a `location_id: null` row for bills without a store (all-stores
	 * callers only — the scope filter already hides them from the others).
	 * Highest sales first.
	 */
	public async byStore(scope: OrganizationAnalyticsScope, range: AnalyticsTimeRange): Promise<StoreBreakdownRow[]> {
		const storeFilter = scope.locationScope.kind === "ALL_LOCATIONS" ? Prisma.sql`TRUE` : Prisma.sql`l.id = ANY(${[...scope.locationScope.locationIds]}::text[])`;
		const rows = await this.sql.rows(
			StoreBreakdownRowSchema,
			Prisma.sql`
			WITH sales AS (
				SELECT s.location_id, SUM(s.bill_total_minor) AS sales_minor, COUNT(*) AS bills
				FROM reward_sales s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, range)])}
				GROUP BY s.location_id
			),
			redemptions AS (
				SELECT rd.location_id, COUNT(*) AS redemptions
				FROM reward_redemptions rd JOIN reward_claims c ON c.id = rd.claim_id
				WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd.redeemed_at`, range)])}
				GROUP BY rd.location_id
			),
			store_keys AS (
				SELECT l.id AS location_id FROM organization_locations l
				WHERE l.organization_id = ${scope.organizationId} AND l.is_deleted = false AND l.status = 'ACTIVE' AND ${storeFilter}
				UNION SELECT location_id FROM sales
				UNION SELECT location_id FROM redemptions
			)
			SELECT k.location_id, l.name, l.city::text AS city,
			       COALESCE(sa.sales_minor, 0)::bigint AS sales_minor,
			       COALESCE(sa.bills, 0)::int AS bills,
			       ${averageSql(Prisma.sql`COALESCE(sa.sales_minor, 0)`, Prisma.sql`COALESCE(sa.bills, 0)`)} AS average_bill_minor,
			       COALESCE(rd.redemptions, 0)::int AS redemptions
			FROM store_keys k
			LEFT JOIN organization_locations l ON l.id = k.location_id
			LEFT JOIN sales sa ON sa.location_id IS NOT DISTINCT FROM k.location_id
			LEFT JOIN redemptions rd ON rd.location_id IS NOT DISTINCT FROM k.location_id
			ORDER BY sales_minor DESC, l.name ASC NULLS LAST`,
		);
		return rows.map((row) => ({
			locationId: row.location_id,
			name: row.name,
			city: row.city,
			salesMinor: minorUnitsToNumber(row.sales_minor),
			bills: row.bills,
			averageBillMinor: minorUnitsToNumber(row.average_bill_minor),
			redemptions: row.redemptions,
		}));
	}

	/** The `limit` most active rewards of the scope (claims + redemptions in the range), most active first. */
	public async byReward(scope: OrganizationAnalyticsScope, range: AnalyticsTimeRange, limit: number): Promise<RewardBreakdownRow[]> {
		const rows = await this.sql.rows(
			RewardBreakdownRowSchema,
			Prisma.sql`
			WITH claims AS (
				SELECT c.reward_id, COUNT(*) AS claims
				FROM ${claimSource(scope)}
				WHERE ${allOf([...claimConditions(scope), withinRange(Prisma.sql`c.claimed_at`, range)])}
				GROUP BY c.reward_id
			),
			redemptions AS (
				SELECT c.reward_id, COUNT(*) AS redemptions
				FROM reward_redemptions rd JOIN reward_claims c ON c.id = rd.claim_id
				WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd.redeemed_at`, range)])}
				GROUP BY c.reward_id
			),
			reward_keys AS (SELECT reward_id FROM claims UNION SELECT reward_id FROM redemptions)
			SELECT r.id AS reward_id, r.title, COALESCE(cl.claims, 0)::int AS claims, COALESCE(rd.redemptions, 0)::int AS redemptions
			FROM reward_keys k
			JOIN rewards r ON r.id = k.reward_id
			LEFT JOIN claims cl ON cl.reward_id = k.reward_id
			LEFT JOIN redemptions rd ON rd.reward_id = k.reward_id
			ORDER BY COALESCE(cl.claims, 0) + COALESCE(rd.redemptions, 0) DESC, r.title ASC, r.id ASC
			LIMIT ${limit}`,
		);
		return rows.map((row) => ({ rewardId: row.reward_id, title: row.title, claims: row.claims, redemptions: row.redemptions }));
	}

	/** Redemptions per method; methods without redemptions are absent (the service lists every method). */
	public async byRedemptionMethod(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<RedemptionMethodRow[]> {
		const rows = await this.sql.rows(
			RedemptionMethodRowSchema,
			Prisma.sql`
			SELECT rd.redemption_method::text AS method, COUNT(*)::int AS redemptions
			FROM reward_redemptions rd JOIN reward_claims c ON c.id = rd.claim_id
			WHERE ${allOf([...redemptionConditions(scope), withinRange(Prisma.sql`rd.redeemed_at`, range)])}
			GROUP BY rd.redemption_method`,
		);
		return rows.map((row) => ({ method: row.method, redemptions: row.redemptions }));
	}

	/**
	 * Paid bills per merchant, highest sales first, at most `limit`. Name and
	 * business category come from the organization (an unknown category reads
	 * as `null`). Reads `organizations` / `organization_merchant_profiles`, so
	 * it runs only for the admin's platform view (RLS bypass on that route).
	 */
	public async byMerchant(scope: AnalyticsScope, range: AnalyticsTimeRange, limit: number): Promise<MerchantSalesRow[]> {
		const rows = await this.sql.rows(
			MerchantSalesRowSchema,
			Prisma.sql`
			SELECT s.organization_id, o.display_name AS name, ${this.knownCategory()} AS category,
			       SUM(s.bill_total_minor)::bigint AS sales_minor,
			       COUNT(*)::int AS bills,
			       ${averageSql(Prisma.sql`SUM(s.bill_total_minor)`, Prisma.sql`COUNT(*)`)} AS average_bill_minor
			FROM reward_sales s
			JOIN organizations o ON o.id = s.organization_id
			LEFT JOIN organization_merchant_profiles mp ON mp.organization_id = s.organization_id
			WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, range)])}
			GROUP BY s.organization_id, o.display_name, mp.category
			ORDER BY sales_minor DESC, o.display_name ASC, s.organization_id ASC
			LIMIT ${limit}`,
		);
		return rows.map((row) => ({
			organizationId: row.organization_id,
			name: row.name,
			category: row.category,
			salesMinor: minorUnitsToNumber(row.sales_minor),
			bills: row.bills,
			averageBillMinor: minorUnitsToNumber(row.average_bill_minor),
		}));
	}

	/** Paid bills per merchant business category (unknown / missing category → `null`), highest sales first. Admin view only (see {@link byMerchant}). */
	public async byCategory(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<CategorySalesRow[]> {
		const rows = await this.sql.rows(
			CategorySalesRowSchema,
			Prisma.sql`
			SELECT ${this.knownCategory()} AS category,
			       SUM(s.bill_total_minor)::bigint AS sales_minor,
			       COUNT(*)::int AS bills,
			       COUNT(DISTINCT s.organization_id)::int AS merchants
			FROM reward_sales s
			LEFT JOIN organization_merchant_profiles mp ON mp.organization_id = s.organization_id
			WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, range)])}
			GROUP BY 1
			ORDER BY sales_minor DESC, category ASC NULLS LAST`,
		);
		return rows.map((row) => ({ category: row.category, salesMinor: minorUnitsToNumber(row.sales_minor), bills: row.bills, merchants: row.merchants }));
	}

	/** Paid bills per city of the store they were paid at (no store → `null`), highest sales first. Admin view only. */
	public async byCity(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<CitySalesRow[]> {
		const rows = await this.sql.rows(
			CitySalesRowSchema,
			Prisma.sql`
			SELECT l.city::text AS city,
			       SUM(s.bill_total_minor)::bigint AS sales_minor,
			       COUNT(*)::int AS bills,
			       COUNT(DISTINCT s.organization_id)::int AS merchants
			FROM reward_sales s
			LEFT JOIN organization_locations l ON l.id = s.location_id
			WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, range)])}
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
		const rows = await this.sql.rows(
			MerchantBucketSalesRowSchema,
			Prisma.sql`
			WITH ${bucketsCte(window)},
			sales AS (
				SELECT s.organization_id, ${localBucketOf(Prisma.sql`s.paid_at`, window)} AS local_start, SUM(s.bill_total_minor) AS sales_minor, COUNT(*) AS bills
				FROM reward_sales s
				WHERE ${allOf([...salesConditions(scope), withinRange(Prisma.sql`s.paid_at`, window)])}
				GROUP BY 1, 2
			)
			SELECT sa.organization_id, b.start_ms, sa.sales_minor::bigint AS sales_minor, sa.bills::int AS bills
			FROM sales sa JOIN buckets b ON b.local_start = sa.local_start
			ORDER BY sa.organization_id, b.local_start`,
		);
		return rows.map((row) => ({ organizationId: row.organization_id, startMs: Number(row.start_ms), salesMinor: minorUnitsToNumber(row.sales_minor), bills: row.bills }));
	}

	/** `mp.category` when it is one of the known business categories, else NULL — so unknown values group with "uncategorised". */
	private knownCategory(): Prisma.Sql {
		return Prisma.sql`(CASE WHEN mp.category = ANY(${[...MerchantBusinessCategorySchema.options]}::text[]) THEN mp.category END)`;
	}
}
