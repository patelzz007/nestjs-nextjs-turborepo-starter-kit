import { Injectable } from "@nestjs/common";
import type { Prisma, RewardRedemption } from "@prisma/client";

import { merchantRedemptionListQuery, type MerchantRedemptionListQuery, type MerchantRedemptionListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

const REDEMPTION_LIST_INCLUDE = {
	claim: { include: { reward: { select: { title: true } } } },
} satisfies Prisma.RewardRedemptionInclude;

export type RewardRedemptionListRow = Prisma.RewardRedemptionGetPayload<{ include: typeof REDEMPTION_LIST_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/list-queries.md) ──

const REDEMPTION_SORT_COLUMNS: SortColumns<MerchantRedemptionListSortField, Prisma.RewardRedemptionOrderByWithRelationInput> = {
	redeemedAt: (direction) => ({ redeemedAt: direction }),
};

/** Keyset for the default order (`redeemedAt desc, id desc`). */
const REDEMPTION_LIST_KEYSET: ListKeyset<RewardRedemptionListRow, Prisma.RewardRedemptionWhereInput> = timestampIdKeyset(
	(row: RewardRedemptionListRow) => ({ at: Number(row.redeemedAt), id: row.id }),
	({ at, id }): Prisma.RewardRedemptionWhereInput => ({ OR: [{ redeemedAt: { lt: at } }, { redeemedAt: at, id: { lt: id } }] }),
);

/**
 * The organization's live redemptions, optionally narrowed to ONE store.
 * Both are authorization scopes resolved by the service (never raw client input).
 */
export function buildRedemptionListWhere(organizationId: string, locationId: string | undefined): Prisma.RewardRedemptionWhereInput {
	return {
		AND: [{ organizationId, isDeleted: false, claim: { isDeleted: false, reward: { isDeleted: false } } }, ...(locationId !== undefined ? [{ locationId }] : [])],
	};
}

export function buildRedemptionListOrder(query: MerchantRedemptionListQuery): ListOrder<Prisma.RewardRedemptionOrderByWithRelationInput> {
	return buildListOrder(merchantRedemptionListQuery.resolveSort(query.sort), {
		columns: REDEMPTION_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

@Injectable()
export class RewardRedemptionRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findByClaimId(claimId: string): Promise<RewardRedemption | null> {
		return this.prisma.rewardRedemption.findUnique({
			where: { claimId },
		});
	}

	public async findById(redemptionId: string): Promise<RewardRedemption | null> {
		return this.prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
	}

	/** `locationId` is the AUTHORIZED store scope (already checked against the member's stores), or `undefined` for every store. */
	public async listForMerchant(
		organizationId: string,
		locationId: string | undefined,
		query: MerchantRedemptionListQuery,
	): Promise<RepositoryListResult<RewardRedemptionListRow>> {
		return fetchListPage(query, {
			where: buildRedemptionListWhere(organizationId, locationId),
			order: buildRedemptionListOrder(query),
			keyset: REDEMPTION_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.rewardRedemption.count({ where }),
			findMany: (args): Promise<RewardRedemptionListRow[]> => this.prisma.rewardRedemption.findMany({ ...args, include: REDEMPTION_LIST_INCLUDE }),
		});
	}

	public async listForMerchantAnalytics(
		organizationId: string,
		redeemedAtRange: { readonly gte: number; readonly lte: number },
		locationId?: string,
	): Promise<{ readonly redeemedAt: bigint; readonly claim: { readonly rewardId: string } }[]> {
		return this.prisma.rewardRedemption.findMany({
			where: {
				isDeleted: false,
				organizationId,
				redeemedAt: redeemedAtRange,
				claim: { isDeleted: false },
				...(locationId !== undefined ? { locationId } : {}),
			},
			select: { redeemedAt: true, claim: { select: { rewardId: true } } },
		});
	}

	public async confirmInTransaction(input: {
		readonly claimId: string;
		readonly rewardId: string;
		readonly organizationId: string;
		/** The store the POS call came from; `null` when unknown. */
		readonly locationId: string | null;
		readonly userId: string;
		readonly terminalId: string;
		readonly redemptionMethod: "SCAN" | "MANUAL";
		readonly idempotencyKey: string;
		readonly redemptionTokenHash: string;
		readonly redeemedAt: number;
	}): Promise<RewardRedemption | null> {
		return this.prisma.$transaction(async (tx) => {
			const updated = await tx.rewardClaim.updateMany({
				where: { id: input.claimId, status: "PENDING" },
				data: { status: "REDEEMED", redeemedAt: input.redeemedAt },
			});

			if (updated.count === 0) {
				return null;
			}

			await tx.reward.update({
				where: { id: input.rewardId },
				data: {
					quantityReserved: { decrement: 1 },
					redemptionCount: { increment: 1 },
				},
			});

			const created = await tx.rewardRedemption.create({
				data: {
					claimId: input.claimId,
					organizationId: input.organizationId,
					locationId: input.locationId,
					userId: input.userId,
					terminalId: input.terminalId,
					redemptionMethod: input.redemptionMethod,
					idempotencyKey: input.idempotencyKey,
					redeemedAt: input.redeemedAt,
				},
			});

			await tx.rewardRedemptionIdempotencyRecord.create({
				data: {
					redemptionTokenHash: input.redemptionTokenHash,
					idempotencyKey: input.idempotencyKey,
					redemptionId: created.id,
				},
			});

			await tx.rewardAuditLog.create({
				data: {
					organizationId: input.organizationId,
					action: "merchant.redeem_reward",
					metadata: { claimId: input.claimId, redemptionId: created.id, terminalId: input.terminalId },
				},
			});

			return created;
		});
	}
}
