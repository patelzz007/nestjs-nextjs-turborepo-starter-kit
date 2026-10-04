import { Injectable } from "@nestjs/common";
import type { OrganizationLocationScopeType, Prisma, Reward, RewardClaim, RewardType } from "@prisma/client";

import { rewardClaimListQuery, type RewardClaimListQuery, type RewardClaimListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { appendRewardAuditLog } from "./reward-audit-log.repository";

const CLAIM_WITH_REWARD_TITLE_INCLUDE = {
	reward: { select: { title: true } },
} satisfies Prisma.RewardClaimInclude;

const CLAIM_WITH_REWARD_INCLUDE = {
	// Closed (soft-deleted) stores never count as a place the reward can be redeemed.
	reward: { include: { locationScopes: { where: { location: { isDeleted: false } }, select: { locationId: true } } } },
} satisfies Prisma.RewardClaimInclude;

export type RewardClaimWithRewardTitle = Prisma.RewardClaimGetPayload<{ include: typeof CLAIM_WITH_REWARD_TITLE_INCLUDE }>;
export type RewardClaimWithReward = Prisma.RewardClaimGetPayload<{ include: typeof CLAIM_WITH_REWARD_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

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
		/** `rewards.min_spend_minor`; `null` when the reward has no minimum. */
		readonly minSpendMinor: number | null;
	};
}

/** Claim statuses that count toward a reward's per-customer limit (an expired claim returned its unit and does not). */
const LIMIT_COUNTED_CLAIM_STATUSES: RewardClaim["status"][] = ["PENDING", "REDEEMED"];

export interface ReservedClaimInput {
	readonly userId: string;
	readonly rewardId: string;
	/** `rules.maxUsePerUser`; `null` = unlimited. */
	readonly maxClaimsPerUser: number | null;
	readonly redemptionTokenHash: string;
	readonly backupCodeHash: string;
	readonly claimedAt: number;
	readonly claimExpiresAt: number;
	/** The customer's pending referral attribution token (`null` = none / expired). */
	readonly attributionToken: string | null;
	/** The verified phone the claim was made with. */
	readonly phone: string;
}

export type ReservedClaimOutcome =
	{ readonly kind: "created"; readonly claim: RewardClaim } | { readonly kind: "out_of_stock" } | { readonly kind: "limit_reached"; readonly limit: number };

/** Rolls the claim transaction back when the customer already holds `limit` claims of the reward. */
class ClaimLimitReachedError extends Error {
	public constructor(public readonly limit: number) {
		super(`Claim limit of ${String(limit)} reached`);
		this.name = "ClaimLimitReachedError";
	}
}

@Injectable()
export class RewardClaimRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Claims a unit of a reward atomically, in ONE transaction:
	 *
	 * 1. Reserve stock with a conditional update (`quantityRemaining > 0`, still
	 *    published). It row-locks the reward until commit, so every concurrent
	 *    claim of this reward waits here — the steps below run one at a time.
	 * 2. Enforce `maxClaimsPerUser` (live PENDING/REDEEMED claims); over the
	 *    limit the transaction rolls back, returning the reserved unit.
	 * 3. Attribute a pending referral, insert the claim, record the verified
	 *    phone and clear the attribution — all or nothing.
	 */
	public async createReservedClaim(input: ReservedClaimInput): Promise<ReservedClaimOutcome> {
		try {
			return await this.prisma.$transaction(async (tx): Promise<ReservedClaimOutcome> => {
				const reserved = await tx.reward.updateMany({
					where: {
						id: input.rewardId,
						isDeleted: false,
						status: "PUBLISHED",
						rewardKind: "CONSUMER",
						quantityRemaining: { gt: 0 },
						// A reward offered only at closed stores can no longer be claimed.
						OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { location: { isDeleted: false, status: "ACTIVE" } } } }],
					},
					data: { quantityRemaining: { decrement: 1 }, quantityReserved: { increment: 1 }, claimCount: { increment: 1 } },
				});
				if (reserved.count === 0) {
					return { kind: "out_of_stock" };
				}

				if (input.maxClaimsPerUser !== null) {
					const held = await tx.rewardClaim.count({
						where: { userId: input.userId, rewardId: input.rewardId, isDeleted: false, status: { in: LIMIT_COUNTED_CLAIM_STATUSES } },
					});
					if (held >= input.maxClaimsPerUser) {
						throw new ClaimLimitReachedError(input.maxClaimsPerUser);
					}
				}

				const referral =
					input.attributionToken === null
						? null
						: await tx.rewardReferral.findFirst({
								where: { attributionToken: input.attributionToken, rewardId: input.rewardId, status: "PENDING", isDeleted: false },
								select: { id: true },
							});
				if (referral !== null) {
					await tx.rewardReferral.update({ where: { id: referral.id }, data: { refereeUserId: input.userId } });
				}

				const claim = await tx.rewardClaim.create({
					data: {
						userId: input.userId,
						rewardId: input.rewardId,
						referralId: referral?.id ?? null,
						redemptionTokenHash: input.redemptionTokenHash,
						backupCodeHash: input.backupCodeHash,
						status: "PENDING",
						claimedAt: input.claimedAt,
						claimExpiresAt: input.claimExpiresAt,
					},
				});

				await tx.user.update({
					where: { id: input.userId },
					data: { phone: input.phone, phoneVerifiedAt: input.claimedAt, pendingAttributionToken: null, pendingAttributionExpiresAt: null },
				});

				return { kind: "created", claim };
			});
		} catch (error) {
			if (error instanceof ClaimLimitReachedError) {
				return { kind: "limit_reached", limit: error.limit };
			}
			throw error;
		}
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

	/**
	 * The live claim behind a QR token (`tokenHashes`: its hash under every key version) — but only a claim on one of
	 * `organizationId`'s rewards. Another merchant's code is "not found",
	 * exactly like an unknown one, so a till learns nothing about codes that
	 * are not its own.
	 */
	public async findMerchantClaimByTokenHash(tokenHashes: readonly string[], organizationId: string): Promise<RewardClaimWithReward | null> {
		return this.prisma.rewardClaim.findFirst({
			where: { redemptionTokenHash: { in: [...tokenHashes] }, isDeleted: false, reward: { organizationId } },
			include: CLAIM_WITH_REWARD_INCLUDE,
		});
	}

	/** Same as {@link findMerchantClaimByTokenHash}, for the backup code read out instead of the QR. */
	public async findMerchantClaimByBackupCodeHash(codeHashes: readonly string[], organizationId: string): Promise<RewardClaimWithReward | null> {
		return this.prisma.rewardClaim.findFirst({
			where: { backupCodeHash: { in: [...codeHashes] }, isDeleted: false, reward: { organizationId } },
			include: CLAIM_WITH_REWARD_INCLUDE,
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
			},
			reward: {
				id: claim.reward.id,
				organizationId: claim.reward.organizationId,
				title: claim.reward.title,
				rewardType: claim.reward.rewardType,
				expiryDate: claim.reward.expiryDate,
				locationScopeType: claim.reward.locationScopeType,
				locationIds: claim.reward.locationScopes.map((scope) => scope.locationId),
				minSpendMinor: claim.reward.minSpendMinor,
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

			await appendRewardAuditLog(tx, {
				organizationId,
				action: "reward.claim_expired",
				metadata: { claimId, isReferrerCredit },
			});

			await withinTransaction(tx);
			return true;
		});
	}

	/** `rewardScope` narrows to the rewards the caller's stores offer (`{}` = every reward of the organization). */
	public async listForMerchantAnalytics(
		organizationId: string,
		claimedAtRange: { readonly gte: number; readonly lte: number },
		rewardScope: Prisma.RewardWhereInput,
	): Promise<Pick<RewardClaim, "claimedAt" | "status" | "rewardId">[]> {
		return this.prisma.rewardClaim.findMany({
			where: {
				isDeleted: false,
				claimedAt: claimedAtRange,
				reward: { AND: [{ organizationId, isDeleted: false }, rewardScope] },
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
