import { Injectable } from "@nestjs/common";
import type { Prisma, RewardReferral } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export type RewardReferralWithReward = Prisma.RewardReferralGetPayload<{
	include: {
		reward: true;
	};
}>;

@Injectable()
export class RewardReferralRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findPendingByTokenAndReward(attributionToken: string, rewardId: string): Promise<RewardReferral | null> {
		return this.prisma.rewardReferral.findFirst({
			where: {
				attributionToken,
				rewardId,
				status: "PENDING",
			},
		});
	}

	public async assignReferee(referralId: string, refereeUserId: string): Promise<void> {
		await this.prisma.rewardReferral.update({
			where: { id: referralId },
			data: { refereeUserId },
		});
	}

	public async findPendingByRewardAndReferee(rewardId: string, refereeUserId: string): Promise<RewardReferral | null> {
		return this.prisma.rewardReferral.findFirst({
			where: { rewardId, refereeUserId, status: "PENDING" },
		});
	}

	public async countByMerchantOrg(merchantOrgId: string, createdAtRange: { readonly gte: number; readonly lte: number }): Promise<number> {
		return this.prisma.rewardReferral.count({
			where: {
				isDeleted: false,
				createdAt: createdAtRange,
				reward: { merchantOrgId, isDeleted: false },
			},
		});
	}

	public async listForReferrerAnalytics(
		referrerUserId: string,
		createdAtRange: { readonly gte: number; readonly lte: number },
	): Promise<Pick<RewardReferral, "createdAt" | "status">[]> {
		return this.prisma.rewardReferral.findMany({
			where: {
				referrerUserId,
				isDeleted: false,
				createdAt: createdAtRange,
			},
			select: { createdAt: true, status: true },
		});
	}

	public async creditReferrerInTransaction(input: {
		readonly parentRewardId: string;
		readonly referrerRewardId: string;
		readonly referralId: string;
		readonly referrerUserId: string;
		readonly redemptionTokenHash: string;
		readonly backupCodeHash: string;
		readonly claimedAt: number;
		readonly claimExpiresAt: number;
	}): Promise<boolean> {
		return this.prisma.$transaction(async (tx) => {
			await tx.reward.update({
				where: { id: input.parentRewardId },
				data: { referralPoolRemaining: { decrement: 1 } },
			});

			const reserved = await tx.reward.updateMany({
				where: { id: input.referrerRewardId, quantityRemaining: { gt: 0 } },
				data: {
					quantityRemaining: { decrement: 1 },
					quantityReserved: { increment: 1 },
					claimCount: { increment: 1 },
				},
			});

			if (reserved.count === 0) {
				return false;
			}

			await tx.rewardClaim.create({
				data: {
					userId: input.referrerUserId,
					rewardId: input.referrerRewardId,
					redemptionTokenHash: input.redemptionTokenHash,
					backupCodeHash: input.backupCodeHash,
					status: "PENDING",
					isReferrerCredit: true,
					claimedAt: input.claimedAt,
					claimExpiresAt: input.claimExpiresAt,
				},
			});

			await tx.rewardReferral.update({
				where: { id: input.referralId },
				data: { status: "CREDITED", creditedAt: input.claimedAt },
			});

			return true;
		});
	}
}
