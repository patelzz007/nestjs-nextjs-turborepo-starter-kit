import { Injectable } from "@nestjs/common";
import { Prisma, type RewardRedemptionMethod } from "@prisma/client";
import { z } from "zod";

import { DEFAULT_SALE_CURRENCY, MerchantBusinessCategorySchema, type MerchantBusinessCategory } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { minorUnitsToNumber } from "../utils/minor-units.util";
import { isUniqueViolationOf } from "../utils/prisma-unique-violation.util";
import { appendRewardAuditLog } from "./reward-audit-log.repository";

/** System operation reading merchant names/categories for sales breakdowns (customers can't read `organizations` under RLS). */
export const SALES_MERCHANT_SUMMARY_OPERATION = "rewards.sales.merchant_summary";

/** The display fields a sales breakdown shows per merchant. */
export interface SalesMerchantSummary {
	readonly name: string;
	readonly category: MerchantBusinessCategory | null;
}

const SALE_WITH_REDEMPTIONS_INCLUDE = {
	redemptions: {
		where: { isDeleted: false },
		orderBy: { id: "asc" },
		include: { claim: { select: { rewardId: true, reward: { select: { title: true } } } } },
	},
} satisfies Prisma.RewardSaleInclude;

export type RewardSaleWithRedemptions = Prisma.RewardSaleGetPayload<{ include: typeof SALE_WITH_REDEMPTIONS_INCLUDE }>;

/** The `(organization_id, idempotency_key)` unique index of `reward_sales` — a concurrent request with the same key inserted first. */
const SALE_IDEMPOTENCY_KEY_INDEX = "reward_sales_organization_id_idempotency_key_key";

/** One claim redeemed on a checkout bill. */
export interface CheckoutLine {
	readonly claimId: string;
	readonly rewardId: string;
	readonly redemptionMethod: RewardRedemptionMethod;
}

export interface CheckoutTransactionInput {
	readonly organizationId: string;
	readonly locationId: string | null;
	readonly userId: string;
	readonly terminalId: string;
	readonly apiKeyId: string;
	readonly billTotalMinor: number;
	readonly currency: string;
	readonly idempotencyKey: string;
	readonly requestHash: string;
	readonly paidAt: number;
	readonly lines: readonly CheckoutLine[];
}

/** A claim in the checkout stopped being redeemable between validation and commit (a concurrent redemption or expiry won). */
export class CheckoutClaimConflictError extends Error {
	public constructor(public readonly claimId: string) {
		super(`Claim ${claimId} is no longer redeemable`);
		this.name = "CheckoutClaimConflictError";
	}
}

/** Paid-bill totals over a time range. */
export interface SalesAggregate {
	readonly totalMinor: number;
	readonly bills: number;
}

/** Paid-bill totals of one UTC week (Monday 00:00 UTC start). */
export interface SalesWeek {
	readonly weekStartMs: number;
	readonly totalMinor: number;
	readonly bills: number;
}

/** One row of the weekly-totals query (Postgres `BIGINT` arrives as `bigint`, `INT` as `number`). */
const SalesWeekRowSchema = z.object({
	week_start_ms: z.bigint(),
	total_minor: z.bigint(),
	bills: z.number().int().nonnegative(),
});

/** Sales grouped by one dimension (organization), highest total first. */
export interface SalesGroup {
	readonly organizationId: string;
	readonly totalMinor: number;
	readonly bills: number;
}

export interface SalesRange {
	readonly gte: number;
	readonly lte: number;
}

/** Narrows sales to one organization (and optionally some of its stores) and/or one customer; empty = platform-wide. */
export interface SalesScope {
	readonly organizationId?: string | undefined;
	/** The stores to include (`undefined` = every store; an empty list matches nothing). */
	readonly locationIds?: readonly string[] | undefined;
	readonly userId?: string | undefined;
}

function salesWhere(scope: SalesScope, range: SalesRange | null): Prisma.RewardSaleWhereInput {
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

@Injectable()
export class RewardSaleRepository {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async findByIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<RewardSaleWithRedemptions | null> {
		return this.prisma.rewardSale.findUnique({
			where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
			include: SALE_WITH_REDEMPTIONS_INCLUDE,
		});
	}

	/**
	 * Records the bill and redeems every claim on it in ONE transaction —
	 * all-or-nothing. Each claim moves PENDING → REDEEMED through a conditional
	 * update, so a concurrent redemption of the same claim makes this throw
	 * {@link CheckoutClaimConflictError} and roll everything back. A concurrent
	 * request with the same idempotency key fails on the sale's unique index.
	 * `withinTransaction` (the caller's outbox event and referral credits) runs
	 * in the same transaction, after the bill is written; its result is returned
	 * alongside the sale.
	 */
	public async checkoutInTransaction<TResult>(
		input: CheckoutTransactionInput,
		withinTransaction: (tx: Prisma.TransactionClient, sale: RewardSaleWithRedemptions) => Promise<TResult>,
	): Promise<{ readonly sale: RewardSaleWithRedemptions; readonly result: TResult }> {
		return this.prisma.$transaction(async (tx) => {
			const created = await tx.rewardSale.create({
				data: {
					organizationId: input.organizationId,
					locationId: input.locationId,
					userId: input.userId,
					terminalId: input.terminalId,
					apiKeyId: input.apiKeyId,
					billTotalMinor: input.billTotalMinor,
					currency: input.currency,
					idempotencyKey: input.idempotencyKey,
					requestHash: input.requestHash,
					paidAt: input.paidAt,
				},
			});

			// Stable lock order (claim id) so two overlapping checkouts can't deadlock.
			const lines = [...input.lines].sort((left, right) => left.claimId.localeCompare(right.claimId));
			for (const line of lines) {
				const updated = await tx.rewardClaim.updateMany({
					where: { id: line.claimId, status: "PENDING", isDeleted: false, claimExpiresAt: { gte: input.paidAt } },
					data: { status: "REDEEMED", redeemedAt: input.paidAt },
				});
				if (updated.count === 0) {
					throw new CheckoutClaimConflictError(line.claimId);
				}

				await tx.reward.update({
					where: { id: line.rewardId },
					data: { quantityReserved: { decrement: 1 }, redemptionCount: { increment: 1 } },
				});

				await tx.rewardRedemption.create({
					data: {
						claimId: line.claimId,
						organizationId: input.organizationId,
						locationId: input.locationId,
						userId: input.userId,
						terminalId: input.terminalId,
						redemptionMethod: line.redemptionMethod,
						saleId: created.id,
						redeemedAt: input.paidAt,
					},
				});
			}

			await appendRewardAuditLog(tx, {
				organizationId: input.organizationId,
				action: "merchant.checkout",
				metadata: {
					saleId: created.id,
					claimIds: lines.map((line) => line.claimId),
					terminalId: input.terminalId,
					apiKeyId: input.apiKeyId,
					locationId: input.locationId,
					billTotalMinor: input.billTotalMinor,
					currency: input.currency,
				},
			});

			const sale = await tx.rewardSale.findUniqueOrThrow({ where: { id: created.id }, include: SALE_WITH_REDEMPTIONS_INCLUDE });
			const result = await withinTransaction(tx, sale);
			return { sale, result };
		});
	}

	/** When the first live bill in `scope` was paid (all time), or `null` before any. */
	public async firstPaidAt(scope: SalesScope): Promise<number | null> {
		const result = await this.prisma.rewardSale.aggregate({ where: salesWhere(scope, null), _min: { paidAt: true } });
		return result._min.paidAt === null ? null : Number(result._min.paidAt);
	}

	public async aggregate(scope: SalesScope, range: SalesRange): Promise<SalesAggregate> {
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
	 * bind parameter): the merchant's own zone, or UTC for platform views. Same
	 * filters as {@link aggregate}.
	 */
	public async listWeeklyTotals(scope: SalesScope, range: SalesRange, timeZone: string): Promise<SalesWeek[]> {
		const conditions: Prisma.Sql[] = [
			Prisma.sql`is_deleted = false`,
			Prisma.sql`currency = ${DEFAULT_SALE_CURRENCY}`,
			Prisma.sql`paid_at >= ${range.gte}`,
			Prisma.sql`paid_at <= ${range.lte}`,
			...(scope.organizationId !== undefined ? [Prisma.sql`organization_id = ${scope.organizationId}`] : []),
			...(scope.locationIds !== undefined ? [Prisma.sql`location_id = ANY(${[...scope.locationIds]}::text[])`] : []),
			...(scope.userId !== undefined ? [Prisma.sql`user_id = ${scope.userId}`] : []),
		];
		const rows = await this.prisma.$queryRaw`
			SELECT (EXTRACT(EPOCH FROM (date_trunc('week', to_timestamp(paid_at / 1000.0) AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone})) * 1000)::bigint AS week_start_ms,
			       SUM(bill_total_minor)::bigint AS total_minor,
			       COUNT(*)::int AS bills
			FROM reward_sales
			WHERE ${Prisma.join(conditions, " AND ")}
			GROUP BY 1
			ORDER BY 1`;
		return SalesWeekRowSchema.array()
			.parse(rows)
			.map((row) => ({ weekStartMs: Number(row.week_start_ms), totalMinor: minorUnitsToNumber(row.total_minor), bills: row.bills }));
	}

	/** Sales per organization, highest total first; `take` bounds the result (omit for every organization). */
	public async groupByOrganization(scope: SalesScope, range: SalesRange, take?: number): Promise<SalesGroup[]> {
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

	/**
	 * Name + business category of the given merchants. Callers pass only ids
	 * taken from sales the caller is already allowed to see (their own bills,
	 * or the admin's platform view), so this reveals nothing new.
	 */
	public async listMerchantSummaries(organizationIds: readonly string[], actorUserId: string): Promise<Map<string, SalesMerchantSummary>> {
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

	/** Distinct organizations with at least one bill in the range. */
	public async countOrganizations(range: SalesRange): Promise<number> {
		const rows = await this.prisma.rewardSale.groupBy({ by: ["organizationId"], where: salesWhere({}, range) });
		return rows.length;
	}
}

/** Whether `error` is the sale's `(organizationId, idempotencyKey)` unique violation (a concurrent duplicate request) — and not any other unique index. */
export function isDuplicateSaleKeyError(error: Error): boolean {
	return isUniqueViolationOf(error, SALE_IDEMPOTENCY_KEY_INDEX);
}
