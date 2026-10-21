import type { Prisma, Reward } from "@prisma/client";

import {
	TENANT_OPERATING_LIFECYCLE_STATE,
	adminPendingRewardListQuery,
	rewardListQuery,
	type AdminPendingRewardListQuery,
	type AdminPendingRewardListSortField,
	type RewardListQuery,
	merchantRewardListQuery,
	type MerchantRewardListQuery,
	type RewardListSortField,
} from "@workspace/shared";

import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";

/**
 * A reward's live images in display order, each with its published renditions
 * (every reward has at least one: `imageFileIds` is required and checked on
 * every save, and an image in use cannot be deleted).
 */
const REWARD_IMAGES_SELECT = {
	where: { isDeleted: false },
	orderBy: { position: "asc" },
	select: {
		fileId: true,
		file: {
			select: {
				imageWidth: true,
				imageHeight: true,
				variants: { where: { isDeleted: false }, orderBy: { width: "asc" }, select: { width: true, publicPath: true } },
			},
		},
	},
} satisfies Prisma.Reward$imagesArgs;

const REWARD_LOCATION_SCOPES_SELECT = {
	where: { location: { isDeleted: false } },
	select: {
		locationId: true,
		location: { select: { name: true } },
	},
} satisfies Prisma.Reward$locationScopesArgs;

/** A reward as a response needs it; the merchant's name and logo come from the tenants context, once per page. */
export const REWARD_RESPONSE_INCLUDE = {
	images: REWARD_IMAGES_SELECT,
	locationScopes: REWARD_LOCATION_SCOPES_SELECT,
} satisfies Prisma.RewardInclude;

/**
 * Columns the marketplace response returns. Moderation and authorship columns
 * (`rejectionReason`, `reviewedByUserId`, `metadata`, `createdBy`, …) stay off
 * the select so a published-reward read never loads them.
 */
export const MARKETPLACE_REWARD_SELECT = {
	id: true,
	tenantId: true,
	title: true,
	description: true,
	rewardType: true,
	rewardValue: true,
	termsConditions: true,
	rewardKind: true,
	category: true,
	rules: true,
	minSpendMinor: true,
	quantityTotal: true,
	quantityRemaining: true,
	quantityReserved: true,
	startDate: true,
	expiryDate: true,
	status: true,
	claimCount: true,
	redemptionCount: true,
	referralsEnabled: true,
	referralPoolTotal: true,
	referralPoolRemaining: true,
	referrerRewardId: true,
	locationScopeType: true,
	createdAt: true,
	updatedAt: true,
	isDeleted: true,
	deletedAt: true,
	images: REWARD_IMAGES_SELECT,
	locationScopes: REWARD_LOCATION_SCOPES_SELECT,
} satisfies Prisma.RewardSelect;

export type MarketplaceRewardRow = Prisma.RewardGetPayload<{ select: typeof MARKETPLACE_REWARD_SELECT }>;

export type RewardResponseRow = Prisma.RewardGetPayload<{ include: typeof REWARD_RESPONSE_INCLUDE }>;

// ── Marketplace list query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const REWARD_SORT_COLUMNS: SortColumns<RewardListSortField, Prisma.RewardOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	expiryDate: (direction) => ({ expiryDate: direction }),
	title: (direction) => ({ title: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
export function rewardListKeyset<TRow extends Pick<Reward, "id" | "createdAt">>(): ListKeyset<TRow, Prisma.RewardWhereInput> {
	return timestampIdKeyset(
		(row: TRow) => ({ at: Number(row.createdAt), id: row.id }),
		({ at, id }): Prisma.RewardWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
	);
}

/**
 * A reward the public sees belongs to a merchant that operates: a suspended, banned or not-yet-live
 * merchant's rewards leave the marketplace (and their detail page) until it operates again.
 */
export const OPERATING_MERCHANT_WHERE: Prisma.RewardWhereInput = { tenant: { isDeleted: false, lifecycleState: TENANT_OPERATING_LIFECYCLE_STATE } };

/** Published, in-stock, unexpired consumer rewards of operating merchants + the filter AST + search. */
export function buildMarketplaceWhere(query: RewardListQuery, now = BigInt(Date.now())): Prisma.RewardWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false, status: "PUBLISHED", rewardKind: "CONSUMER", quantityRemaining: { gt: 0 }, expiryDate: { gte: now } },
			OPERATING_MERCHANT_WHERE,
			...fieldWhere(toPrismaEqualityFilter(filter?.category), (category) => ({ category })),
			...fieldWhere(toPrismaEqualityFilter(filter?.city), (city): Prisma.RewardWhereInput => ({ tenant: { merchantProfile: { city } } })),
			...fieldWhere(toPrismaEqualityFilter(filter?.tenantId), (tenantId) => ({ tenantId })),
			...(query.search !== undefined
				? [
						{
							OR: [{ title: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }],
						} satisfies Prisma.RewardWhereInput,
					]
				: []),
		],
	};
}

// ── Admin moderation queue (oldest first) ──

const PENDING_REVIEW_SORT_COLUMNS: SortColumns<AdminPendingRewardListSortField, Prisma.RewardOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`createdAt asc, id asc`). */
export const PENDING_REVIEW_LIST_KEYSET: ListKeyset<RewardResponseRow, Prisma.RewardWhereInput> = timestampIdKeyset(
	(row: RewardResponseRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.RewardWhereInput => ({ OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] }),
);

export function buildPendingReviewWhere(): Prisma.RewardWhereInput {
	return { status: "PENDING_REVIEW", isDeleted: false, rewardKind: "CONSUMER" };
}

export function buildPendingReviewOrder(query: AdminPendingRewardListQuery): ListOrder<Prisma.RewardOrderByWithRelationInput> {
	return buildListOrder(adminPendingRewardListQuery.resolveSort(query.sort), {
		columns: PENDING_REVIEW_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

export function buildMarketplaceOrder(query: RewardListQuery): ListOrder<Prisma.RewardOrderByWithRelationInput> {
	return buildListOrder(rewardListQuery.resolveSort(query.sort), {
		columns: REWARD_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/** Rewards available at a store of `grant`: tenant-wide rewards plus those offered at one of its stores. */
export function rewardAvailabilityWhere(grant: MerchantAccessGrant): Prisma.RewardWhereInput {
	if (grant.locationScope === "ALL_LOCATIONS") {
		return {};
	}
	return { OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [...grant.locationIds] } } } }] };
}

/** The tenant's live consumer rewards available at a store of `grant` (the AUTHORIZED store scope). */
export function tenantRewardWhere(grant: MerchantAccessGrant): Prisma.RewardWhereInput {
	return { AND: [{ tenantId: grant.tenantId, isDeleted: false, rewardKind: "CONSUMER" }, rewardAvailabilityWhere(grant)] };
}

/** `GET /tenants/:tenantSlug/rewards`: the rewards of `grant`, narrowed by the status filter. The grant is the scope, never a filter. */
export function buildTenantRewardListWhere(grant: MerchantAccessGrant, query: MerchantRewardListQuery): Prisma.RewardWhereInput {
	return { AND: [tenantRewardWhere(grant), ...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status) => ({ status }))] };
}

export function buildTenantRewardListOrder(query: MerchantRewardListQuery): ListOrder<Prisma.RewardOrderByWithRelationInput> {
	return buildListOrder(merchantRewardListQuery.resolveSort(query.sort), { columns: REWARD_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}
