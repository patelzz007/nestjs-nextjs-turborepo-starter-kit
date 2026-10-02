import { Injectable } from "@nestjs/common";
import { Prisma, type RewardRedemptionMethod } from "@prisma/client";
import { DEFAULT_SALE_CURRENCY, MerchantBusinessCategorySchema, type MerchantBusinessCategory } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";

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

/** Prisma: unique constraint violated — another request inserted the same (organization, idempotency key) first. */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/** Prefix of the per-redemption idempotency key derived for checkout redemptions (one claim → one redemption, ever). */
const CHECKOUT_REDEMPTION_KEY_PREFIX = "checkout:";

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

export interface SalesPoint {
	readonly paidAt: number;
	readonly billTotalMinor: number;
}

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

/** Narrows sales to one organization (and optionally a store) and/or one customer; empty = platform-wide. */
export interface SalesScope {
	readonly organizationId?: string | undefined;
	readonly locationId?: string | undefined;
	readonly userId?: string | undefined;
}

function salesWhere(scope: SalesScope, range: SalesRange): Prisma.RewardSaleWhereInput {
	return {
		isDeleted: false,
		// Totals are only meaningful within one currency; every sale is MYR today (see SaleCurrencySchema).
		currency: DEFAULT_SALE_CURRENCY,
		paidAt: { gte: range.gte, lte: range.lte },
		...(scope.organizationId !== undefined ? { organizationId: scope.organizationId } : {}),
		...(scope.locationId !== undefined ? { locationId: scope.locationId } : {}),
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
	 */
	public async checkoutInTransaction(
		input: CheckoutTransactionInput,
		withinTransaction: (tx: Prisma.TransactionClient, sale: RewardSaleWithRedemptions) => Promise<void>,
	): Promise<RewardSaleWithRedemptions> {
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
						idempotencyKey: `${CHECKOUT_REDEMPTION_KEY_PREFIX}${line.claimId}`,
						saleId: created.id,
						redeemedAt: input.paidAt,
					},
				});
			}

			await tx.rewardAuditLog.create({
				data: {
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
				},
			});

			const sale = await tx.rewardSale.findUniqueOrThrow({ where: { id: created.id }, include: SALE_WITH_REDEMPTIONS_INCLUDE });
			await withinTransaction(tx, sale);
			return sale;
		});
	}

	public async aggregate(scope: SalesScope, range: SalesRange): Promise<SalesAggregate> {
		const result = await this.prisma.rewardSale.aggregate({
			where: salesWhere(scope, range),
			_sum: { billTotalMinor: true },
			_count: { _all: true },
		});
		return { totalMinor: result._sum.billTotalMinor ?? 0, bills: result._count._all };
	}

	/** Every bill in the range (two columns) — for weekly buckets. */
	public async listPoints(scope: SalesScope, range: SalesRange): Promise<SalesPoint[]> {
		const rows = await this.prisma.rewardSale.findMany({
			where: salesWhere(scope, range),
			select: { paidAt: true, billTotalMinor: true },
		});
		return rows.map((row) => ({ paidAt: Number(row.paidAt), billTotalMinor: row.billTotalMinor }));
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
		return rows.map((row) => ({ organizationId: row.organizationId, totalMinor: row._sum.billTotalMinor ?? 0, bills: row._count._all }));
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
			{ operation: SALES_MERCHANT_SUMMARY_OPERATION, reason: "Merchant names for a sales breakdown", correlationId: `sales-merchants:${actorUserId}`, actorUserId },
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

/** Whether `error` is the sale's `(organizationId, idempotencyKey)` unique violation (a concurrent duplicate request). */
export function isDuplicateSaleKeyError(error: Error): boolean {
	return error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION;
}
