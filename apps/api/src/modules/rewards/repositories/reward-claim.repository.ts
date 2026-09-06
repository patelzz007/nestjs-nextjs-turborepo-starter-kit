import { Injectable } from "@nestjs/common";
import type { Prisma, Reward, RewardClaim, RewardType } from "@prisma/client";

import type { RewardClaimListQuery } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

const CLAIM_WITH_REWARD_TITLE_INCLUDE = {
	reward: { select: { title: true } },
} as const satisfies Prisma.RewardClaimInclude;

const CLAIM_WITH_REWARD_INCLUDE = {
	reward: true,
} as const satisfies Prisma.RewardClaimInclude;

export type RewardClaimWithRewardTitle = Prisma.RewardClaimGetPayload<{ include: typeof CLAIM_WITH_REWARD_TITLE_INCLUDE }>;
export type RewardClaimWithReward = Prisma.RewardClaimGetPayload<{ include: typeof CLAIM_WITH_REWARD_INCLUDE }>;

export interface RewardClaimRedemptionLookup {
	readonly claim: {
		readonly id: string;
		readonly userId: string;
		readonly rewardId: string;
		readonly status: "PENDING" | "REDEEMED" | "EXPIRED";
		readonly claimExpiresAt: bigint;
		readonly redemptionTokenHash: string;
		readonly backupFailedAttempts: number;
		readonly backupLockedUntil: bigint | null;
	};
	readonly reward: {
		readonly id: string;
		readonly merchantOrgId: string;
		readonly title: string;
		readonly rewardType: RewardType;
		readonly expiryDate: bigint;
	};
}

@Injectable()
export class RewardClaimRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async create(input: {
		readonly userId: string;
		readonly rewardId: string;
		readonly referralId: string | null;
		readonly redemptionTokenHash: string;
		readonly backupCodeHash: string;
		readonly status: "PENDING";
		readonly claimedAt: number;
		readonly claimExpiresAt: number;
	}): Promise<RewardClaim> {
		return this.prisma.rewardClaim.create({
			data: {
				userId: input.userId,
				rewardId: input.rewardId,
				referralId: input.referralId,
				redemptionTokenHash: input.redemptionTokenHash,
				backupCodeHash: input.backupCodeHash,
				status: input.status,
				claimedAt: input.claimedAt,
				claimExpiresAt: input.claimExpiresAt,
			},
		});
	}

	public async listForUser(userId: string, query: RewardClaimListQuery): Promise<{ readonly rows: RewardClaimWithRewardTitle[]; readonly total: number }> {
		const skip = (query.page - 1) * query.limit;
		const where: Prisma.RewardClaimWhereInput = {
			userId,
			isDeleted: false,
			...(query.status !== undefined ? { status: query.status } : {}),
		};

		const [rows, total] = await this.prisma.$transaction([
			this.prisma.rewardClaim.findMany({
				where,
				include: CLAIM_WITH_REWARD_TITLE_INCLUDE,
				orderBy: { claimedAt: "desc" },
				skip,
				take: query.limit,
			}),
			this.prisma.rewardClaim.count({ where }),
		]);

		return { rows, total };
	}

	public async findActiveForUser(claimId: string, userId: string): Promise<RewardClaim | null> {
		return this.prisma.rewardClaim.findFirst({
			where: { id: claimId, userId, isDeleted: false },
		});
	}

	public async updateTokenHashes(claimId: string, redemptionTokenHash: string, backupCodeHash: string): Promise<void> {
		await this.prisma.rewardClaim.update({
			where: { id: claimId },
			data: { redemptionTokenHash, backupCodeHash },
		});
	}

	public async findByRedemptionTokenHash(tokenHash: string): Promise<RewardClaimWithReward | null> {
		return this.prisma.rewardClaim.findFirst({
			where: { redemptionTokenHash: tokenHash, isDeleted: false },
			include: CLAIM_WITH_REWARD_INCLUDE,
		});
	}

	public async findByBackupCodeHash(codeHash: string): Promise<RewardClaimWithReward | null> {
		return this.prisma.rewardClaim.findFirst({
			where: { backupCodeHash: codeHash, isDeleted: false },
			include: CLAIM_WITH_REWARD_INCLUDE,
		});
	}

	public async findById(claimId: string): Promise<RewardClaim | null> {
		return this.prisma.rewardClaim.findUnique({ where: { id: claimId } });
	}

	public async recordBackupFailure(claimId: string, attempts: number, backupLockedUntil: bigint | null): Promise<void> {
		await this.prisma.rewardClaim.update({
			where: { id: claimId },
			data: {
				backupFailedAttempts: attempts,
				backupLockedUntil,
			},
		});
	}

	public toRedemptionLookup(claim: RewardClaimWithReward): RewardClaimRedemptionLookup {
		return {
			claim: {
				id: claim.id,
				userId: claim.userId,
				rewardId: claim.rewardId,
				status: claim.status,
				claimExpiresAt: claim.claimExpiresAt,
				redemptionTokenHash: claim.redemptionTokenHash,
				backupFailedAttempts: claim.backupFailedAttempts,
				backupLockedUntil: claim.backupLockedUntil,
			},
			reward: {
				id: claim.reward.id,
				merchantOrgId: claim.reward.merchantOrgId,
				title: claim.reward.title,
				rewardType: claim.reward.rewardType,
				expiryDate: claim.reward.expiryDate,
			},
		};
	}

	public async listExpiredPending(input: { readonly isReferrerCredit: boolean; readonly now: number; readonly take: number }): Promise<(RewardClaim & { reward: Reward })[]> {
		return this.prisma.rewardClaim.findMany({
			where: {
				status: "PENDING",
				isReferrerCredit: input.isReferrerCredit,
				claimExpiresAt: { lt: input.now },
				isDeleted: false,
			},
			include: { reward: true },
			take: input.take,
		});
	}

	public async expireClaimInTransaction(claimId: string, rewardId: string, merchantOrgId: string, isReferrerCredit: boolean): Promise<boolean> {
		return this.prisma.$transaction(async (tx) => {
			const updated = await tx.rewardClaim.updateMany({
				where: { id: claimId, status: "PENDING", ...(isReferrerCredit ? { isReferrerCredit: true } : { isReferrerCredit: false }) },
				data: { status: "EXPIRED" },
			});

			if (updated.count === 0) {
				return false;
			}

			await tx.reward.update({
				where: { id: rewardId },
				data: {
					quantityReserved: { decrement: 1 },
					quantityRemaining: { increment: 1 },
				},
			});

			await tx.rewardAuditLog.create({
				data: {
					merchantOrgId,
					action: "reward.claim_expired",
					metadata: { claimId, isReferrerCredit },
				},
			});

			return true;
		});
	}

	public async listForMerchantAnalytics(
		merchantOrgId: string,
		claimedAtRange: { readonly gte: number; readonly lte: number },
	): Promise<Pick<RewardClaim, "claimedAt" | "status" | "rewardId">[]> {
		return this.prisma.rewardClaim.findMany({
			where: {
				isDeleted: false,
				claimedAt: claimedAtRange,
				reward: { merchantOrgId, isDeleted: false },
			},
			select: { claimedAt: true, status: true, rewardId: true },
		});
	}

	public async listForUserAnalytics(userId: string, claimedAtRange: { readonly gte: number; readonly lte: number }): Promise<Pick<RewardClaim, "claimedAt" | "status">[]> {
		return this.prisma.rewardClaim.findMany({
			where: {
				userId,
				isDeleted: false,
				claimedAt: claimedAtRange,
			},
			select: { claimedAt: true, status: true },
		});
	}
}
