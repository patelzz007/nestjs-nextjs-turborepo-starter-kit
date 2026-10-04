import { Injectable } from "@nestjs/common";
import type { Prisma, Reward } from "@prisma/client";

import {
	adminPendingRewardListQuery,
	nowEpochMs,
	rewardListQuery,
	type AdminPendingRewardListQuery,
	type AdminPendingRewardListSortField,
	type RewardListQuery,
	type RewardListSortField,
} from "@workspace/shared";

import { BaseRepository } from "../../../platform/persistence/base.repository";
import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { EmptyMutationInput, RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import type { MerchantLocationScope } from "../types/merchant-location-scope";
import { rewardAvailabilityWhere } from "../utils/merchant-location-scope.util";
import { appendRewardAuditLog } from "./reward-audit-log.repository";

/**
 * The merchant's logo, fetched in the same query as the reward (no N+1): the
 * organization's live `LOGO` asset whose file finished processing and has a
 * public URL. `(organizationId, assetType)` is unique, so this is 0 or 1 row.
 *
 * The file conditions live in the relation filter (not only in the mapper) so
 * an asset whose `stored_files` row is hidden by RLS is excluded up front
 * instead of tripping Prisma's required-relation check on `file`.
 */
const ORGANIZATION_LOGO_ASSETS_SELECT = {
	where: {
		assetType: "LOGO",
		isDeleted: false,
		file: { status: "READY", isDeleted: false, publicPath: { not: null } },
	},
	select: { file: { select: { publicPath: true } } },
	take: 1,
} satisfies Prisma.Organization$assetsArgs;

const REWARD_WITH_ORGANIZATION_INCLUDE = {
	organization: { select: { displayName: true, assets: ORGANIZATION_LOGO_ASSETS_SELECT } },
	locationScopes: {
		where: { location: { isDeleted: false } },
		select: {
			locationId: true,
			location: { select: { name: true } },
		},
	},
} satisfies Prisma.RewardInclude;

export type RewardWithOrganization = Prisma.RewardGetPayload<{ include: typeof REWARD_WITH_ORGANIZATION_INCLUDE }>;

/** The organization's live consumer rewards available at a store of `scope` (the AUTHORIZED store scope). */
function buildOrganizationRewardWhere(organizationId: string, scope: MerchantLocationScope): Prisma.RewardWhereInput {
	return {
		AND: [{ organizationId, isDeleted: false, rewardKind: "CONSUMER" }, rewardAvailabilityWhere(scope)],
	};
}

export type RewardClaimableSummary = Pick<Reward, "id" | "title" | "expiryDate" | "quantityRemaining" | "rules" | "minSpendMinor">;

export type RewardOrgConsumerSummary = Pick<Reward, "id" | "status" | "referrerRewardId" | "quantityTotal" | "quantityRemaining" | "locationScopeType"> & {
	/** The stores a `SELECTED` reward is available at (empty for `ALL_LOCATIONS`). */
	readonly locationIds: readonly string[];
};

export type RewardPendingReviewSummary = Pick<Reward, "id" | "title" | "organizationId" | "referrerRewardId" | "status">;

export type RewardWithReferrerReward = Prisma.RewardGetPayload<{ include: { referrerReward: true } }>;

function toDomain(row: Reward): Reward {
	return row;
}

function toCreateInput(_input: EmptyMutationInput): Prisma.RewardCreateInput {
	throw new Error("RewardRepository.create via BaseRepository ports is not supported");
}

function toUpdateInput(_input: EmptyMutationInput): Prisma.RewardUpdateManyMutationInput {
	throw new Error("RewardRepository.update via BaseRepository ports is not supported");
}

// ── Marketplace list query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const REWARD_SORT_COLUMNS: SortColumns<RewardListSortField, Prisma.RewardOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	expiryDate: (direction) => ({ expiryDate: direction }),
	title: (direction) => ({ title: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
function rewardListKeyset<TRow extends Pick<Reward, "id" | "createdAt">>(): ListKeyset<TRow, Prisma.RewardWhereInput> {
	return timestampIdKeyset(
		(row: TRow) => ({ at: Number(row.createdAt), id: row.id }),
		({ at, id }): Prisma.RewardWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
	);
}

/** Published, in-stock, unexpired consumer rewards + the filter AST + search. */
export function buildMarketplaceWhere(query: RewardListQuery, now = BigInt(Date.now())): Prisma.RewardWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false, status: "PUBLISHED", rewardKind: "CONSUMER", quantityRemaining: { gt: 0 }, expiryDate: { gte: now } },
			...fieldWhere(toPrismaEqualityFilter(filter?.category), (category) => ({ category })),
			...fieldWhere(toPrismaEqualityFilter(filter?.city), (city): Prisma.RewardWhereInput => ({ organization: { merchantProfile: { city } } })),
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
const PENDING_REVIEW_LIST_KEYSET: ListKeyset<RewardWithOrganization, Prisma.RewardWhereInput> = timestampIdKeyset(
	(row: RewardWithOrganization) => ({ at: Number(row.createdAt), id: row.id }),
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

const RewardRepositoryPorts = {
	toDomain,
	toCreateInput,
	toUpdateInput,
	buildListWhere: (query: RewardListQuery): Prisma.RewardWhereInput => buildMarketplaceWhere(query),
	buildListOrder: buildMarketplaceOrder,
	listKeyset: rewardListKeyset<Reward>(),
	andWhere: (left: Prisma.RewardWhereInput, right: Prisma.RewardWhereInput): Prisma.RewardWhereInput => ({ AND: [left, right] }),
	buildFindByIdWhere: (id: string): Prisma.RewardWhereInput => ({
		id,
		isDeleted: false,
		status: "PUBLISHED",
		rewardKind: "CONSUMER",
	}),
	buildLiveWhere: (id: string): Prisma.RewardWhereInput => ({ id, isDeleted: false }),
	buildUniqueWhere: (id: string): Prisma.RewardWhereUniqueInput => ({ id }),
	buildUpdateWhere: (id: string): Prisma.RewardWhereInput => ({ id, isDeleted: false }),
	stampUpdate: (data: Prisma.RewardUpdateManyMutationInput): Prisma.RewardUpdateManyMutationInput => ({ ...data, updatedAt: nowEpochMs() }),
	stampSoftDelete: (): Prisma.RewardUpdateManyMutationInput => ({ isDeleted: true, deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.RewardUpdateManyMutationInput => ({ isDeleted: false, deletedAt: null, updatedAt: nowEpochMs() }),
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
	Prisma.RewardUpdateManyMutationInput,
	Prisma.RewardWhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, RewardRepositoryPorts, (db: Prisma.TransactionClient) => db.reward, { softDelete: true });
	}

	public async listMarketplace(query: RewardListQuery): Promise<RepositoryListResult<RewardWithOrganization>> {
		return fetchListPage(query, {
			where: buildMarketplaceWhere(query),
			order: buildMarketplaceOrder(query),
			keyset: rewardListKeyset<RewardWithOrganization>(),
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.reward.count({ where }),
			findMany: (args): Promise<RewardWithOrganization[]> => this.prisma.reward.findMany({ ...args, include: REWARD_WITH_ORGANIZATION_INCLUDE }),
		});
	}

	public async findPublishedConsumerWithOrganization(rewardId: string): Promise<RewardWithOrganization | null> {
		return this.prisma.reward.findFirst({
			where: {
				id: rewardId,
				isDeleted: false,
				status: "PUBLISHED",
				rewardKind: "CONSUMER",
			},
			include: REWARD_WITH_ORGANIZATION_INCLUDE,
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
			select: { id: true, title: true, expiryDate: true, quantityRemaining: true, rules: true, minSpendMinor: true },
		});
	}

	public async findTitleById(rewardId: string): Promise<Pick<Reward, "title"> | null> {
		return this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false },
			select: { title: true },
		});
	}

	/** One of the organization's live consumer rewards, if it is offered at a store of `scope` (else `null`). */
	public async findConsumerByOrganization(organizationId: string, rewardId: string, scope: MerchantLocationScope): Promise<RewardWithOrganization | null> {
		return this.prisma.reward.findFirst({
			where: { AND: [buildOrganizationRewardWhere(organizationId, scope), { id: rewardId }] },
			include: REWARD_WITH_ORGANIZATION_INCLUDE,
		});
	}

	public async listConsumerByOrganization(organizationId: string, scope: MerchantLocationScope): Promise<RewardWithOrganization[]> {
		return this.prisma.reward.findMany({
			where: buildOrganizationRewardWhere(organizationId, scope),
			include: REWARD_WITH_ORGANIZATION_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	}

	public async createConsumerReward(data: Prisma.RewardUncheckedCreateInput, locationIds: readonly string[]): Promise<RewardWithOrganization> {
		return this.prisma.$transaction(async (tx) => {
			const reward = await tx.reward.create({
				data,
				include: REWARD_WITH_ORGANIZATION_INCLUDE,
			});

			if (reward.locationScopeType === "SELECTED" && locationIds.length > 0) {
				await tx.rewardLocationScope.createMany({
					data: locationIds.map((locationId) => ({
						organizationId: reward.organizationId,
						rewardId: reward.id,
						locationId,
					})),
				});

				return tx.reward.findUniqueOrThrow({
					where: { id: reward.id },
					include: REWARD_WITH_ORGANIZATION_INCLUDE,
				});
			}

			return reward;
		});
	}

	public async replaceLocationScopes(rewardId: string, organizationId: string, locationIds: readonly string[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.rewardLocationScope.deleteMany({ where: { rewardId } });

			if (locationIds.length > 0) {
				await tx.rewardLocationScope.createMany({
					data: locationIds.map((locationId) => ({
						organizationId,
						rewardId,
						locationId,
					})),
				});
			}
		});
	}

	public async countOrganizationLocations(organizationId: string): Promise<number> {
		return this.prisma.organizationLocation.count({
			where: { organizationId, isDeleted: false, status: "ACTIVE" },
		});
	}

	public async findOrganizationLocationIds(organizationId: string, locationIds: readonly string[]): Promise<string[]> {
		const rows = await this.prisma.organizationLocation.findMany({
			where: { organizationId, isDeleted: false, status: "ACTIVE", id: { in: [...locationIds] } },
			select: { id: true },
		});
		return rows.map((row) => row.id);
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

	public async findUniqueOrThrowWithOrganization(rewardId: string): Promise<RewardWithOrganization> {
		return this.prisma.reward.findUniqueOrThrow({
			where: { id: rewardId },
			include: REWARD_WITH_ORGANIZATION_INCLUDE,
		});
	}

	public async findOrgConsumerReward(organizationId: string, rewardId: string): Promise<RewardOrgConsumerSummary | null> {
		const row = await this.prisma.reward.findFirst({
			where: { id: rewardId, organizationId, isDeleted: false, rewardKind: "CONSUMER" },
			select: {
				id: true,
				status: true,
				referrerRewardId: true,
				quantityTotal: true,
				quantityRemaining: true,
				locationScopeType: true,
				locationScopes: { select: { locationId: true } },
			},
		});
		if (row === null) {
			return null;
		}
		const { locationScopes, ...summary } = row;
		return { ...summary, locationIds: locationScopes.map((scope) => scope.locationId) };
	}

	/** One page of the moderation queue (bounded by the list query's limit). */
	public async listPendingReview(query: AdminPendingRewardListQuery): Promise<RepositoryListResult<RewardWithOrganization>> {
		return fetchListPage(query, {
			where: buildPendingReviewWhere(),
			order: buildPendingReviewOrder(query),
			keyset: PENDING_REVIEW_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.reward.count({ where }),
			findMany: (args): Promise<RewardWithOrganization[]> => this.prisma.reward.findMany({ ...args, include: REWARD_WITH_ORGANIZATION_INCLUDE }),
		});
	}

	public async findPendingReviewById(rewardId: string): Promise<RewardPendingReviewSummary | null> {
		return this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false, rewardKind: "CONSUMER" },
			select: { id: true, title: true, organizationId: true, referrerRewardId: true, status: true },
		});
	}

	public async listPendingAutoPublish(now: number): Promise<RewardWithOrganization[]> {
		return this.prisma.reward.findMany({
			where: {
				status: "PENDING_REVIEW",
				autoPublishAt: { lte: now },
				isDeleted: false,
				rewardKind: "CONSUMER",
			},
			include: REWARD_WITH_ORGANIZATION_INCLUDE,
		});
	}

	/**
	 * Publish a reward (and its referrer reward) with its audit row, then run
	 * `withinTransaction` — the caller's same-transaction write (the outbox
	 * event) — so the status change and its event commit or roll back together.
	 */
	public async autoPublishInTransaction(
		rewardId: string,
		referrerRewardId: string | null,
		organizationId: string,
		now: number,
		withinTransaction: (tx: Prisma.TransactionClient) => Promise<void>,
	): Promise<void> {
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

			await appendRewardAuditLog(tx, {
				organizationId,
				action: "reward.auto_published",
				metadata: { rewardId },
			});

			await withinTransaction(tx);
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
