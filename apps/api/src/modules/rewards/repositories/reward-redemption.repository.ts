import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { merchantRedemptionListQuery, type MerchantRedemptionListQuery, type MerchantRedemptionListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { fieldWhere, toPrismaComparableFilter } from "../../../platform/persistence/list-query/prisma-filter";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import type { MerchantLocationScope } from "../types/merchant-location-scope";
import { locationIdInFilter } from "../utils/merchant-location-scope.util";

const REDEMPTION_LIST_INCLUDE = {
	claim: { include: { reward: { select: { title: true } } } },
} satisfies Prisma.RewardRedemptionInclude;

export type RewardRedemptionListRow = Prisma.RewardRedemptionGetPayload<{ include: typeof REDEMPTION_LIST_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const REDEMPTION_SORT_COLUMNS: SortColumns<MerchantRedemptionListSortField, Prisma.RewardRedemptionOrderByWithRelationInput> = {
	redeemedAt: (direction) => ({ redeemedAt: direction }),
};

/** Keyset for the default order (`redeemedAt desc, id desc`). */
const REDEMPTION_LIST_KEYSET: ListKeyset<RewardRedemptionListRow, Prisma.RewardRedemptionWhereInput> = timestampIdKeyset(
	(row: RewardRedemptionListRow) => ({ at: Number(row.redeemedAt), id: row.id }),
	({ at, id }): Prisma.RewardRedemptionWhereInput => ({ OR: [{ redeemedAt: { lt: at } }, { redeemedAt: at, id: { lt: id } }] }),
);

/**
 * The organization's live redemptions within the caller's stores, plus the
 * `redeemedAt` window filter. `organizationId` and `scope` are authorization
 * scopes resolved by the service (never raw client input); a store-limited
 * scope excludes redemptions with no recorded store.
 */
export function buildRedemptionListWhere(organizationId: string, scope: MerchantLocationScope, query: MerchantRedemptionListQuery): Prisma.RewardRedemptionWhereInput {
	const locationFilter = locationIdInFilter(scope);
	return {
		AND: [
			{ organizationId, isDeleted: false, claim: { isDeleted: false, reward: { isDeleted: false } } },
			...(locationFilter !== undefined ? [{ locationId: locationFilter }] : []),
			...fieldWhere(toPrismaComparableFilter(query.filter?.redeemedAt), (redeemedAt) => ({ redeemedAt })),
		],
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

	/** `scope` is the AUTHORIZED store scope (resolved from the member's stores or the API key's store). */
	public async listForMerchant(
		organizationId: string,
		scope: MerchantLocationScope,
		query: MerchantRedemptionListQuery,
	): Promise<RepositoryListResult<RewardRedemptionListRow>> {
		return fetchListPage(query, {
			where: buildRedemptionListWhere(organizationId, scope, query),
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
		scope: MerchantLocationScope,
	): Promise<{ readonly redeemedAt: bigint; readonly claim: { readonly rewardId: string } }[]> {
		const locationFilter = locationIdInFilter(scope);
		return this.prisma.rewardRedemption.findMany({
			where: {
				isDeleted: false,
				organizationId,
				redeemedAt: redeemedAtRange,
				claim: { isDeleted: false },
				...(locationFilter !== undefined ? { locationId: locationFilter } : {}),
			},
			select: { redeemedAt: true, claim: { select: { rewardId: true } } },
		});
	}
}
