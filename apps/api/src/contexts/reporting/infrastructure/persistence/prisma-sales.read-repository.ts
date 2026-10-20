import { Prisma } from "@prisma/client";
import { DEFAULT_SALE_CURRENCY, MerchantBusinessCategorySchema } from "@workspace/shared";
import { z } from "zod";

import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { InclusiveRange, SalesAggregate, SalesGroup, SalesMerchantSummary, SalesReadPort, SalesScope, SalesWeek } from "../../application/ports/sales-read.port";
import { minorUnitsToNumber } from "../../../../platform/infrastructure/persistence/minor-units";
import { weekStartMsSql } from "./analytics-sql-conditions";
import { PLATFORM_ANALYTICS_READ_OPERATION } from "../../application/ports/reporting.tokens";

/** System operation reading merchant names/categories for sales breakdowns (customers can't read `Tenant` under RLS). */
export const SALES_MERCHANT_SUMMARY_OPERATION = "rewards.sales.merchant_summary";

function isCallerScoped(scope: SalesScope): boolean {
	return scope.tenantId !== undefined || scope.userId !== undefined || scope.locationIds !== undefined;
}

/** One row of the weekly-totals query (Postgres `BIGINT` arrives as `bigint`, `INT` as `number`). */
const SalesWeekRowSchema = z.object({
	week_start_ms: z.bigint(),
	total_minor: z.bigint(),
	bills: z.number().int().nonnegative(),
});

function salesWhere(scope: SalesScope, range: InclusiveRange | null): Prisma.RewardSaleWhereInput {
	return {
		isDeleted: false,
		// Totals are only meaningful within one currency; every sale is MYR today (see SaleCurrencySchema).
		currency: DEFAULT_SALE_CURRENCY,
		...(range !== null ? { paidAt: { gte: range.gte, lte: range.lte } } : {}),
		...(scope.tenantId !== undefined ? { tenantId: scope.tenantId } : {}),
		...(scope.locationIds !== undefined ? { locationId: { in: [...scope.locationIds] } } : {}),
		...(scope.userId !== undefined ? { userId: scope.userId } : {}),
	};
}

/**
 * Paid-bill facts (`RewardSale`, owned by pos). A scope that names a tenant, store, or customer
 * runs under that caller's RLS session. A scope that names none of those is the platform view and
 * runs as `reporting.platform_analytics.read`. Merchant names are a separate allowlisted read.
 */
export class PrismaSalesReadRepository implements SalesReadPort {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	/** Caller-scoped reads reuse the bound session inside a transaction. Platform-wide reads open the analytics operation. */
	private query<TResult>(scope: SalesScope, reason: string, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		if (isCallerScoped(scope)) {
			return this.tenantTx.withBoundSession(reason, work);
		}
		return this.tenantTx.withSystemOperation({ operation: PLATFORM_ANALYTICS_READ_OPERATION, reason, actorUserId: null }, work);
	}

	public async firstPaidAt(scope: SalesScope): Promise<number | null> {
		const result = await this.query(scope, "Earliest paid sale in the requested scope", (db) =>
			db.rewardSale.aggregate({ where: salesWhere(scope, null), _min: { paidAt: true } }),
		);
		return result._min.paidAt === null ? null : Number(result._min.paidAt);
	}

	public async aggregate(scope: SalesScope, range: InclusiveRange): Promise<SalesAggregate> {
		const result = await this.query(scope, "Paid-sale totals in the requested scope", (db) =>
			db.rewardSale.aggregate({
				where: salesWhere(scope, range),
				_sum: { billTotalMinor: true },
				_count: { _all: true },
			}),
		);
		return { totalMinor: minorUnitsToNumber(result._sum.billTotalMinor ?? 0n), bills: result._count._all };
	}

	/**
	 * Paid-bill totals per week, grouped in Postgres — one row per week that has
	 * bills, never one row per bill. Weeks start on Monday 00:00 in `timeZone`
	 * (an IANA name, validated by `IanaTimeZoneSchema` upstream and passed as a
	 * bind parameter): the merchant's own zone, or UTC for platform views.
	 */
	public async listWeeklyTotals(scope: SalesScope, range: InclusiveRange, timeZone: string): Promise<SalesWeek[]> {
		const conditions: Prisma.Sql[] = [
			Prisma.sql`"isDeleted" = false`,
			Prisma.sql`currency = ${DEFAULT_SALE_CURRENCY}`,
			Prisma.sql`"paidAt" >= ${range.gte}`,
			Prisma.sql`"paidAt" <= ${range.lte}`,
			...(scope.tenantId !== undefined ? [Prisma.sql`"tenantId" = ${scope.tenantId}`] : []),
			...(scope.locationIds !== undefined ? [Prisma.sql`"locationId" = ANY(${[...scope.locationIds]}::text[])`] : []),
			...(scope.userId !== undefined ? [Prisma.sql`"userId" = ${scope.userId}`] : []),
		];
		const rows = await this.query(
			scope,
			"Paid sales grouped by week",
			(db) => db.$queryRaw`
			SELECT ${weekStartMsSql(Prisma.sql`"paidAt"`, timeZone)} AS week_start_ms,
			       SUM("billTotalMinor")::bigint AS total_minor,
			       COUNT(*)::int AS bills
			FROM "RewardSale"
			WHERE ${Prisma.join(conditions, " AND ")}
			GROUP BY 1
			ORDER BY 1`,
		);
		return SalesWeekRowSchema.array()
			.parse(rows)
			.map((row) => ({ weekStartMs: Number(row.week_start_ms), totalMinor: minorUnitsToNumber(row.total_minor), bills: row.bills }));
	}

	public async groupByTenant(scope: SalesScope, range: InclusiveRange, take?: number): Promise<SalesGroup[]> {
		const rows = await this.query(scope, "Paid sales grouped by merchant", (db) =>
			db.rewardSale.groupBy({
				by: ["tenantId"],
				where: salesWhere(scope, range),
				_sum: { billTotalMinor: true },
				_count: { _all: true },
				orderBy: { _sum: { billTotalMinor: "desc" } },
				...(take !== undefined ? { take } : {}),
			}),
		);
		return rows.map((row) => ({ tenantId: row.tenantId, totalMinor: minorUnitsToNumber(row._sum.billTotalMinor ?? 0n), bills: row._count._all }));
	}

	public async countTenants(range: InclusiveRange): Promise<number> {
		const rows = await this.tenantTx.withSystemOperation(
			{ operation: PLATFORM_ANALYTICS_READ_OPERATION, reason: "Count merchants with a paid sale in the range", actorUserId: null },
			(tx) => tx.rewardSale.groupBy({ by: ["tenantId"], where: salesWhere({}, range) }),
		);
		return rows.length;
	}

	/**
	 * Name + business category of the given merchants. Callers pass only ids
	 * taken from sales the caller is already allowed to see (their own bills,
	 * or the admin's platform view), so this reveals nothing new.
	 */
	public async listMerchantSummaries(tenantIds: readonly string[], actorUserId: string | null): Promise<Map<string, SalesMerchantSummary>> {
		if (tenantIds.length === 0) {
			return new Map();
		}
		const rows = await this.tenantTx.withSystemOperation(
			{ operation: SALES_MERCHANT_SUMMARY_OPERATION, reason: "Merchant names for a sales breakdown", actorUserId },
			async (tx) =>
				tx.tenant.findMany({
					where: { id: { in: [...tenantIds] } },
					select: { id: true, displayName: true, merchantProfile: { select: { category: true } } },
				}),
		);
		return new Map(
			rows.map((row): [string, SalesMerchantSummary] => {
				const category = MerchantBusinessCategorySchema.safeParse(row.merchantProfile?.category);
				return [row.id, { name: row.displayName, category: category.success ? category.data : null }];
			}),
		);
	}
}
