import type { Prisma, RewardClaim } from "@prisma/client";
import { rewardClaimListQuery, type RewardClaimListQuery, type RewardClaimListSortField } from "@workspace/shared";

import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";

// ── List queries → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const REWARD_CLAIM_SORT_COLUMNS: SortColumns<RewardClaimListSortField, Prisma.RewardClaimOrderByWithRelationInput> = {
	claimedAt: (direction) => ({ claimedAt: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default claim order (`claimedAt desc, id desc`). */
export const REWARD_CLAIM_LIST_KEYSET: ListKeyset<RewardClaim, Prisma.RewardClaimWhereInput> = timestampIdKeyset(
	(row: RewardClaim) => ({ at: Number(row.claimedAt), id: row.id }),
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
