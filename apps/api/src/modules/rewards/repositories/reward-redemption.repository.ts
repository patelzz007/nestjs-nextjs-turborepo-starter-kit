import { Injectable } from "@nestjs/common";
import type { Prisma, RewardRedemption } from "@prisma/client";

import type { MerchantRedemptionListQuery } from "@workspace/shared";

import { fetchStringIdListPage } from "../../../platform/persistence/cursor-list";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

const REDEMPTION_LIST_INCLUDE = {
	claim: { include: { reward: { select: { title: true } } } },
} as const satisfies Prisma.RewardRedemptionInclude;

export type RewardRedemptionListRow = Prisma.RewardRedemptionGetPayload<{ include: typeof REDEMPTION_LIST_INCLUDE }>;

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

	public async listForMerchant(
		merchantOrgId: string,
		query: MerchantRedemptionListQuery,
	): Promise<RepositoryListResult<RewardRedemptionListRow>> {
		const where: Prisma.RewardRedemptionWhereInput = { merchantOrgId, isDeleted: false };
		return fetchStringIdListPage(query, {
			where,
			mergeCursor: (baseWhere, cursorId) => ({ ...baseWhere, id: { gt: cursorId } }),
			readId: (row) => row.id,
			findMany: (args): Promise<RewardRedemptionListRow[]> =>
				this.prisma.rewardRedemption.findMany({
					...args,
					include: REDEMPTION_LIST_INCLUDE,
				}),
			count: (listWhere) => this.prisma.rewardRedemption.count({ where: listWhere }),
		});
	}

	public async listForMerchantAnalytics(
		merchantOrgId: string,
		redeemedAtRange: { readonly gte: number; readonly lte: number },
	): Promise<{ readonly redeemedAt: bigint; readonly claim: { readonly rewardId: string } }[]> {
		return this.prisma.rewardRedemption.findMany({
			where: {
				isDeleted: false,
				merchantOrgId,
				redeemedAt: redeemedAtRange,
			},
			select: { redeemedAt: true, claim: { select: { rewardId: true } } },
		});
	}

	public async confirmInTransaction(input: {
		readonly claimId: string;
		readonly rewardId: string;
		readonly merchantOrgId: string;
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
					merchantOrgId: input.merchantOrgId,
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
					merchantOrgId: input.merchantOrgId,
					action: "merchant.redeem_reward",
					metadata: { claimId: input.claimId, redemptionId: created.id, terminalId: input.terminalId },
				},
			});

			return created;
		});
	}
}
