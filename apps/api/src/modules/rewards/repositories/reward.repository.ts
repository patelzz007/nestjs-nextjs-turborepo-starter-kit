import { Injectable } from "@nestjs/common";
import type { Prisma, Reward } from "@prisma/client";

import { nowEpochMs, type RewardListQuery } from "@workspace/shared";

import { fetchStringIdListPage } from "../../../platform/persistence/cursor-list";
import { BaseRepository } from "../../../platform/persistence/base.repository";
import type { EmptyMutationInput, RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

const REWARD_WITH_MERCHANT_ORG_INCLUDE = {
	merchantOrg: { select: { businessName: true } },
} as const satisfies Prisma.RewardInclude;

export type RewardWithMerchantOrg = Prisma.RewardGetPayload<{ include: typeof REWARD_WITH_MERCHANT_ORG_INCLUDE }>;

export type RewardClaimableSummary = Pick<Reward, "id" | "title" | "expiryDate" | "quantityRemaining">;

export type RewardOrgConsumerSummary = Pick<Reward, "id" | "status" | "referrerRewardId" | "quantityTotal" | "quantityRemaining">;

export type RewardPendingReviewSummary = Pick<Reward, "id" | "title" | "merchantOrgId" | "referrerRewardId" | "status">;

export type RewardWithReferrerReward = Prisma.RewardGetPayload<{ include: { referrerReward: true } }>;

function toDomain(row: Reward): Reward {
	return row;
}

function toCreateInput(_input: EmptyMutationInput): Prisma.RewardCreateInput {
	throw new Error("RewardRepository.create via BaseRepository ports is not supported");
}

function toUpdateInput(_input: EmptyMutationInput): Prisma.RewardUpdateInput {
	throw new Error("RewardRepository.update via BaseRepository ports is not supported");
}

function buildMarketplaceWhere(query: RewardListQuery): Prisma.RewardWhereInput {
	return {
		isDeleted: false,
		status: "PUBLISHED",
		rewardKind: "CONSUMER",
		quantityRemaining: { gt: 0 },
		expiryDate: { gte: BigInt(Date.now()) },
		...(query.category !== undefined ? { category: query.category } : {}),
		...(query.search !== undefined
			? {
					OR: [{ title: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }],
				}
			: {}),
		...(query.city !== undefined
			? {
					merchantOrg: { city: query.city },
				}
			: {}),
	};
}

const RewardRepositoryPorts = {
	toDomain,
	toCreateInput,
	toUpdateInput,
	buildListWhere: buildMarketplaceWhere,
	buildListOrderBy: (): Prisma.RewardOrderByWithRelationInput => ({ createdAt: "desc" }),
	buildListCursorOrderBy: (): Prisma.RewardOrderByWithRelationInput => ({ id: "asc" }),
	mergeListCursor: (where: Prisma.RewardWhereInput, cursorId: string): Prisma.RewardWhereInput => ({ ...where, id: { gt: cursorId } }),
	readListCursorId: (row: Reward): string => row.id,
	buildFindByIdWhere: (id: string): Prisma.RewardWhereInput => ({
		id,
		isDeleted: false,
		status: "PUBLISHED",
		rewardKind: "CONSUMER",
	}),
	buildUpdateWhere: (id: string): Prisma.RewardWhereUniqueInput => ({ id }),
	stampUpdate: (data: Prisma.RewardUpdateInput): Prisma.RewardUpdateInput => ({ ...data, updatedAt: nowEpochMs() }),
	stampSoftDelete: (): Prisma.RewardUpdateInput => ({ isDeleted: true, deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.RewardUpdateInput => ({ isDeleted: false, deletedAt: null, updatedAt: nowEpochMs() }),
};

@Injectable()
export class RewardRepository extends BaseRepository<
	Reward,
	EmptyMutationInput,
	EmptyMutationInput,
	RewardListQuery,
	Reward,
	Prisma.RewardWhereInput,
	Prisma.RewardOrderByWithRelationInput,
	Prisma.RewardCreateInput,
	Prisma.RewardUpdateInput,
	Prisma.RewardWhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, RewardRepositoryPorts, prisma.reward, { softDelete: true, concurrency: false });
	}

	public async listMarketplace(query: RewardListQuery): Promise<RepositoryListResult<RewardWithMerchantOrg>> {
		const where = buildMarketplaceWhere(query);
		return fetchStringIdListPage(query, {
			where,
			mergeCursor: (baseWhere, cursorId) => ({ ...baseWhere, id: { gt: cursorId } }),
			readId: (row) => row.id,
			findMany: (args): Promise<RewardWithMerchantOrg[]> =>
				this.prisma.reward.findMany({
					...args,
					include: REWARD_WITH_MERCHANT_ORG_INCLUDE,
				}),
			count: (listWhere) => this.prisma.reward.count({ where: listWhere }),
		});
	}

	public async findPublishedConsumerWithMerchant(rewardId: string): Promise<RewardWithMerchantOrg | null> {
		return this.prisma.reward.findFirst({
			where: {
				id: rewardId,
				isDeleted: false,
				status: "PUBLISHED",
				rewardKind: "CONSUMER",
			},
			include: REWARD_WITH_MERCHANT_ORG_INCLUDE,
		});
	}

	public async findClaimableConsumer(rewardId: string): Promise<RewardClaimableSummary | null> {
		return this.prisma.reward.findFirst({
			where: {
				id: rewardId,
				isDeleted: false,
				status: "PUBLISHED",
				rewardKind: "CONSUMER",
			},
			select: { id: true, title: true, expiryDate: true, quantityRemaining: true },
		});
	}

	public async findTitleById(rewardId: string): Promise<Pick<Reward, "title"> | null> {
		return this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false },
			select: { title: true },
		});
	}

	public async reserveQuantity(rewardId: string): Promise<number> {
		const result = await this.prisma.reward.updateMany({
			where: { id: rewardId, quantityRemaining: { gt: 0 } },
			data: {
				quantityRemaining: { decrement: 1 },
				quantityReserved: { increment: 1 },
				claimCount: { increment: 1 },
			},
		});
		return result.count;
	}

	public async listConsumerByMerchantOrg(merchantOrgId: string): Promise<RewardWithMerchantOrg[]> {
		return this.prisma.reward.findMany({
			where: { merchantOrgId, isDeleted: false, rewardKind: "CONSUMER" },
			include: REWARD_WITH_MERCHANT_ORG_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	}

	public async createConsumerReward(data: Prisma.RewardUncheckedCreateInput): Promise<RewardWithMerchantOrg> {
		return this.prisma.reward.create({
			data,
			include: REWARD_WITH_MERCHANT_ORG_INCLUDE,
		});
	}

	public async createReferrerReward(data: Prisma.RewardUncheckedCreateInput): Promise<Reward> {
		return this.prisma.reward.create({ data });
	}

	public async updateReward(rewardId: string, data: Prisma.RewardUpdateInput): Promise<void> {
		await this.prisma.reward.update({
			where: { id: rewardId },
			data,
		});
	}

	public async findUniqueOrThrowWithMerchantOrg(rewardId: string): Promise<RewardWithMerchantOrg> {
		return this.prisma.reward.findUniqueOrThrow({
			where: { id: rewardId },
			include: REWARD_WITH_MERCHANT_ORG_INCLUDE,
		});
	}

	public async findOrgConsumerReward(merchantOrgId: string, rewardId: string): Promise<RewardOrgConsumerSummary | null> {
		return this.prisma.reward.findFirst({
			where: { id: rewardId, merchantOrgId, isDeleted: false, rewardKind: "CONSUMER" },
			select: { id: true, status: true, referrerRewardId: true, quantityTotal: true, quantityRemaining: true },
		});
	}

	public async listPendingReview(): Promise<RewardWithMerchantOrg[]> {
		return this.prisma.reward.findMany({
			where: { status: "PENDING_REVIEW", isDeleted: false, rewardKind: "CONSUMER" },
			include: REWARD_WITH_MERCHANT_ORG_INCLUDE,
			orderBy: { submittedForReviewAt: "asc" },
		});
	}

	public async findPendingReviewById(rewardId: string): Promise<RewardPendingReviewSummary | null> {
		return this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false, rewardKind: "CONSUMER" },
			select: { id: true, title: true, merchantOrgId: true, referrerRewardId: true, status: true },
		});
	}

	public async listPendingAutoPublish(now: number): Promise<RewardWithMerchantOrg[]> {
		return this.prisma.reward.findMany({
			where: {
				status: "PENDING_REVIEW",
				autoPublishAt: { lte: now },
				isDeleted: false,
				rewardKind: "CONSUMER",
			},
			include: REWARD_WITH_MERCHANT_ORG_INCLUDE,
		});
	}

	public async autoPublishInTransaction(rewardId: string, referrerRewardId: string | null, merchantOrgId: string, now: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.reward.update({
				where: { id: rewardId },
				data: {
					status: "PUBLISHED",
					reviewedAt: now,
					autoPublishAt: null,
				},
			});

			if (referrerRewardId !== null) {
				await tx.reward.update({
					where: { id: referrerRewardId },
					data: { status: "PUBLISHED", reviewedAt: now, autoPublishAt: null },
				});
			}

			await tx.rewardAuditLog.create({
				data: {
					merchantOrgId,
					action: "reward.auto_published",
					metadata: { rewardId },
				},
			});
		});
	}

	public async approveInTransaction(rewardId: string, referrerRewardId: string | null, adminUserId: string, now: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.reward.update({
				where: { id: rewardId },
				data: {
					status: "PUBLISHED",
					reviewedAt: now,
					reviewedByUserId: adminUserId,
					autoPublishAt: null,
					rejectionReason: null,
				},
			});

			if (referrerRewardId !== null) {
				await tx.reward.update({
					where: { id: referrerRewardId },
					data: {
						status: "PUBLISHED",
						reviewedAt: now,
						reviewedByUserId: adminUserId,
						autoPublishAt: null,
					},
				});
			}
		});
	}

	public async rejectInTransaction(rewardId: string, referrerRewardId: string | null, adminUserId: string, reason: string | null, now: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.reward.update({
				where: { id: rewardId },
				data: {
					status: "DRAFT",
					reviewedAt: now,
					reviewedByUserId: adminUserId,
					autoPublishAt: null,
					rejectionReason: reason,
					submittedForReviewAt: null,
				},
			});

			if (referrerRewardId !== null) {
				await tx.reward.update({
					where: { id: referrerRewardId },
					data: {
						status: "DRAFT",
						reviewedAt: now,
						reviewedByUserId: adminUserId,
						autoPublishAt: null,
						submittedForReviewAt: null,
					},
				});
			}
		});
	}

	public async count(where: Prisma.RewardWhereInput): Promise<number> {
		return this.prisma.reward.count({ where });
	}

	public async listIdAndTitle(where: Prisma.RewardWhereInput): Promise<Pick<Reward, "id" | "title">[]> {
		return this.prisma.reward.findMany({
			where,
			select: { id: true, title: true },
		});
	}

	public async findWithReferrerReward(rewardId: string): Promise<RewardWithReferrerReward | null> {
		return this.prisma.reward.findUnique({
			where: { id: rewardId },
			include: { referrerReward: true },
		});
	}
}
