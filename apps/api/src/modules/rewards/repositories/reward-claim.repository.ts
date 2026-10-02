import { Injectable } from "@nestjs/common";
import type { OrganizationLocationScopeType, Prisma, Reward, RewardClaim, RewardType } from "@prisma/client";

import { rewardClaimListQuery, type RewardClaimListQuery, type RewardClaimListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { minSpendMinorFromRules } from "../utils/redemption-eligibility.util";

const CLAIM_WITH_REWARD_TITLE_INCLUDE = {
	reward: { select: { title: true } },
} satisfies Prisma.RewardClaimInclude;

const CLAIM_WITH_REWARD_INCLUDE = {
	reward: { include: { locationScopes: { select: { locationId: true } } } },
} satisfies Prisma.RewardClaimInclude;

export type RewardClaimWithRewardTitle = Prisma.RewardClaimGetPayload<{ include: typeof CLAIM_WITH_REWARD_TITLE_INCLUDE }>;
export type RewardClaimWithReward = Prisma.RewardClaimGetPayload<{ include: typeof CLAIM_WITH_REWARD_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/list-queries.md) ──

const REWARD_CLAIM_SORT_COLUMNS: SortColumns<RewardClaimListSortField, Prisma.RewardClaimOrderByWithRelationInput> = {
	claimedAt: (direction) => ({ claimedAt: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`claimedAt desc, id desc`). */
const REWARD_CLAIM_LIST_KEYSET: ListKeyset<RewardClaimWithRewardTitle, Prisma.RewardClaimWhereInput> = timestampIdKeyset(
	(row: RewardClaimWithRewardTitle) => ({ at: Number(row.claimedAt), id: row.id }),
	({ at, id }): Prisma.RewardClaimWhereInput => ({ OR: [{ claimedAt: { lt: at } }, { claimedAt: at, id: { lt: id } }] }),
);

/** The signed-in user's live claims + the filter AST. `userId` is the authorization scope, never client input. */
export function buildRewardClaimListWhere(userId: string, query: RewardClaimListQuery): Prisma.RewardClaimWhereInput {
	return {
		AND: [{ userId, isDeleted: false }, ...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status) => ({ status }))],
	};
}

export function buildRewardClaimListOrder(query: RewardClaimListQuery): ListOrder<Prisma.RewardClaimOrderByWithRelationInput> {
	return buildListOrder(rewardClaimListQuery.resolveSort(query.sort), {
		columns: REWARD_CLAIM_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

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
		readonly organizationId: string;
		readonly title: string;
		readonly rewardType: RewardType;
		readonly expiryDate: bigint;
		readonly locationScopeType: OrganizationLocationScopeType;
		/** The stores a `SELECTED`-scope reward is valid at (empty for `ALL_LOCATIONS`). */
		readonly locationIds: readonly string[];
		/** `rules.minSpendMyr` in minor units; `null` when the reward has no minimum. */
		readonly minSpendMinor: number | null;
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

	public async listForUser(userId: string, query: RewardClaimListQuery): Promise<RepositoryListResult<RewardClaimWithRewardTitle>> {
		return fetchListPage(query, {
			where: buildRewardClaimListWhere(userId, query),
			order: buildRewardClaimListOrder(query),
			keyset: REWARD_CLAIM_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.rewardClaim.count({ where }),
			findMany: (args): Promise<RewardClaimWithRewardTitle[]> => this.prisma.rewardClaim.findMany({ ...args, include: CLAIM_WITH_REWARD_TITLE_INCLUDE }),
		});
	}

	public async findActiveForUser(claimId: string, userId: string): Promise<RewardClaim | null> {
		return this.prisma.rewardClaim.findFirst({
			where: { id: claimId, userId, isDeleted: false },
		});
	}

	public async updateTokenHashes(claimId: string, userId: string, redemptionTokenHash: string, backupCodeHash: string): Promise<void> {
		await this.prisma.rewardClaim.updateMany({
			where: { id: claimId, userId },
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
				organizationId: claim.reward.organizationId,
				title: claim.reward.title,
				rewardType: claim.reward.rewardType,
				expiryDate: claim.reward.expiryDate,
				locationScopeType: claim.reward.locationScopeType,
				locationIds: claim.reward.locationScopes.map((scope) => scope.locationId),
				minSpendMinor: minSpendMinorFromRules(claim.reward.rules),
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

	/**
	 * Expire a PENDING claim, return its reserved unit, and write the audit row;
	 * `withinTransaction` (the caller's outbox event) runs only when the claim
	 * actually expired, inside the same transaction. Returns false (and writes
	 * nothing) when another worker already moved the claim.
	 */
	public async expireClaimInTransaction(
		claimId: string,
		rewardId: string,
		organizationId: string,
		isReferrerCredit: boolean,
		withinTransaction: (tx: Prisma.TransactionClient) => Promise<void>,
	): Promise<boolean> {
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
					organizationId,
					action: "reward.claim_expired",
					metadata: { claimId, isReferrerCredit },
				},
			});

			await withinTransaction(tx);
			return true;
		});
	}

	public async listForMerchantAnalytics(
		organizationId: string,
		claimedAtRange: { readonly gte: number; readonly lte: number },
	): Promise<Pick<RewardClaim, "claimedAt" | "status" | "rewardId">[]> {
		return this.prisma.rewardClaim.findMany({
			where: {
				isDeleted: false,
				claimedAt: claimedAtRange,
				reward: { organizationId, isDeleted: false },
			},
			select: { claimedAt: true, status: true, rewardId: true },
		});
	}

	public async listForUserAnalytics(
		userId: string,
		claimedAtRange: { readonly gte: number; readonly lte: number },
	): Promise<Pick<RewardClaim, "claimedAt" | "redeemedAt" | "status">[]> {
		return this.prisma.rewardClaim.findMany({
			where: {
				userId,
				isDeleted: false,
				claimedAt: claimedAtRange,
			},
			select: { claimedAt: true, redeemedAt: true, status: true },
		});
	}
}
