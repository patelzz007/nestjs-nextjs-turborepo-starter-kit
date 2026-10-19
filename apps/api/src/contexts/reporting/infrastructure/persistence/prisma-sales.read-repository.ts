import { Prisma } from "@prisma/client";
import { DEFAULT_SALE_CURRENCY, MerchantBusinessCategorySchema } from "@workspace/shared";
import { z } from "zod";

import type { PrismaService } from "../../../../prisma/prisma.service";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { InclusiveRange, SalesAggregate, SalesGroup, SalesMerchantSummary, SalesReadPort, SalesScope, SalesWeek } from "../../application/ports/sales-read.port";
import { minorUnitsToNumber } from "../../../../platform/infrastructure/persistence/minor-units";
import { weekStartMsSql } from "./analytics-sql-conditions";

/** System operation reading merchant names/categories for sales breakdowns (customers can't read `Organization` under RLS). */
export const SALES_MERCHANT_SUMMARY_OPERATION = "rewards.sales.merchant_summary";

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
		...(scope.organizationId !== undefined ? { organizationId: scope.organizationId } : {}),
		...(scope.locationIds !== undefined ? { locationId: { in: [...scope.locationIds] } } : {}),
		...(scope.userId !== undefined ? { userId: scope.userId } : {}),
	};
}

/**
 * Paid-bill facts (`RewardSale`, owned by pos) for the weekly sales analytics. Reads run under the
 * caller's RLS session (the pool stamps it on checkout), except the merchant name lookup, which is an
 * allowlisted system read over ids the caller already saw.
 */
export class PrismaSalesReadRepository implements SalesReadPort {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async firstPaidAt(scope: SalesScope): Promise<number | null> {
		const result = await this.prisma.rewardSale.aggregate({ where: salesWhere(scope, null), _min: { paidAt: true } });
		return result._min.paidAt === null ? null : Number(result._min.paidAt);
	}

	public async aggregate(scope: SalesScope, range: InclusiveRange): Promise<SalesAggregate> {
		const result = await this.prisma.rewardSale.aggregate({
			where: salesWhere(scope, range),
			_sum: { billTotalMinor: true },
			_count: { _all: true },
		});
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
			...(scope.organizationId !== undefined ? [Prisma.sql`"organizationId" = ${scope.organizationId}`] : []),
			...(scope.locationIds !== undefined ? [Prisma.sql`"locationId" = ANY(${[...scope.locationIds]}::text[])`] : []),
			...(scope.userId !== undefined ? [Prisma.sql`"userId" = ${scope.userId}`] : []),
		];
		const rows = await this.prisma.$queryRaw`
			SELECT ${weekStartMsSql(Prisma.sql`"paidAt"`, timeZone)} AS week_start_ms,
			       SUM("billTotalMinor")::bigint AS total_minor,
			       COUNT(*)::int AS bills
			FROM "RewardSale"
			WHERE ${Prisma.join(conditions, " AND ")}
			GROUP BY 1
			ORDER BY 1`;
		return SalesWeekRowSchema.array()
			.parse(rows)
			.map((row) => ({ weekStartMs: Number(row.week_start_ms), totalMinor: minorUnitsToNumber(row.total_minor), bills: row.bills }));
	}

	public async groupByOrganization(scope: SalesScope, range: InclusiveRange, take?: number): Promise<SalesGroup[]> {
		const rows = await this.prisma.rewardSale.groupBy({
			by: ["organizationId"],
			where: salesWhere(scope, range),
			_sum: { billTotalMinor: true },
			_count: { _all: true },
			orderBy: { _sum: { billTotalMinor: "desc" } },
			...(take !== undefined ? { take } : {}),
		});
		return rows.map((row) => ({ organizationId: row.organizationId, totalMinor: minorUnitsToNumber(row._sum.billTotalMinor ?? 0n), bills: row._count._all }));
	}

	public async countOrganizations(range: InclusiveRange): Promise<number> {
		const rows = await this.prisma.rewardSale.groupBy({ by: ["organizationId"], where: salesWhere({}, range) });
		return rows.length;
	}

	/**
	 * Name + business category of the given merchants. Callers pass only ids
	 * taken from sales the caller is already allowed to see (their own bills,
	 * or the admin's platform view), so this reveals nothing new.
	 */
	public async listMerchantSummaries(organizationIds: readonly string[], actorUserId: string | null): Promise<Map<string, SalesMerchantSummary>> {
		if (organizationIds.length === 0) {
			return new Map();
		}
		const rows = await this.tenantTx.withSystemOperation(
			{ operation: SALES_MERCHANT_SUMMARY_OPERATION, reason: "Merchant names for a sales breakdown", actorUserId },
			async (tx) =>
				tx.organization.findMany({
					where: { id: { in: [...organizationIds] } },
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
