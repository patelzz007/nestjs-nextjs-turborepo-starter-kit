import { Injectable } from "@nestjs/common";
import { Prisma, type Reward, type StoredFile } from "@prisma/client";

import {
	adminPendingRewardListQuery,
	rewardListQuery,
	type AdminPendingRewardListQuery,
	type AdminPendingRewardListSortField,
	type RewardListQuery,
	type RewardListSortField,
} from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { ORGANIZATION_LOGO_ASSETS_SELECT } from "../../organization/utils/organization-logo.util";
import type { MerchantLocationScope } from "../types/merchant-location-scope";
import { rewardAvailabilityWhere } from "../utils/merchant-location-scope.util";
import { appendRewardAuditLog } from "./reward-audit-log.repository";

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

const REWARD_WITH_ORGANIZATION_INCLUDE = {
	// The merchant's logo comes in the same query as the reward (no N+1).
	organization: { select: { displayName: true, assets: ORGANIZATION_LOGO_ASSETS_SELECT } },
	images: REWARD_IMAGES_SELECT,
	locationScopes: {
		where: { location: { isDeleted: false } },
		select: {
			locationId: true,
			location: { select: { name: true } },
		},
	},
} satisfies Prisma.RewardInclude;

export type RewardWithOrganization = Prisma.RewardGetPayload<{ include: typeof REWARD_WITH_ORGANIZATION_INCLUDE }>;

/** An image a reward names is not one of the organization's ready, published `REWARD_IMAGE`s. */
export class RewardImagesUnavailableError extends Error {
	public constructor(public readonly fileIds: readonly string[]) {
		super(`Files ${fileIds.join(", ")} cannot all be used as reward images`);
		this.name = "RewardImagesUnavailableError";
	}
}

/** The images a write sets on a reward, in display order, and who sets them. */
export interface RewardImageSet {
	readonly organizationId: string;
	readonly fileIds: readonly string[];
	/** Recorded as `deleted_by` on the image rows the write replaces. */
	readonly actorId: string;
}

type RewardWriteClient = Prisma.TransactionClient;

/**
 * Locks every image file row of a write and checks each is usable: this
 * organization's READY, public, published, live `REWARD_IMAGE`. The same row
 * lock is taken by file deletion (`StoredFileRepository.softDeleteWithReferences`),
 * so a reward can never be saved naming an image that is being deleted, nor an
 * image deleted while a save names it.
 */
async function lockUsableRewardImages(tx: RewardWriteClient, organizationId: string, fileIds: readonly string[]): Promise<void> {
	const locked = await tx.$queryRaw<{ id: string }[]>`
		SELECT id FROM "stored_files"
		WHERE id IN (${Prisma.join([...fileIds])})
			AND organization_id = ${organizationId}
			AND category = 'REWARD_IMAGE'
			AND visibility = 'PUBLIC'
			AND status = 'READY'
			AND is_deleted = false
			AND public_path IS NOT NULL
		ORDER BY id
		FOR UPDATE`;
	if (locked.length !== new Set(fileIds).size) {
		const usable = new Set(locked.map((row) => row.id));
		throw new RewardImagesUnavailableError(fileIds.filter((fileId) => !usable.has(fileId)));
	}
}

/** Writes a reward's image rows in display order (position 0 is the cover). */
async function createRewardImageRows(tx: RewardWriteClient, rewardId: string, organizationId: string, fileIds: readonly string[]): Promise<void> {
	await tx.rewardImage.createMany({
		data: fileIds.map((fileId, position) => ({ rewardId, organizationId, fileId, position })),
	});
}

/** Replaces a reward's live images: the old rows are soft-deleted (kept as history), the new ones written in order. */
async function replaceRewardImageRows(tx: RewardWriteClient, rewardId: string, images: RewardImageSet): Promise<void> {
	const deletedAt = BigInt(Date.now());
	await tx.rewardImage.updateMany({
		where: { rewardId, isDeleted: false },
		data: { isDeleted: true, deletedAt, deletedBy: images.actorId, updatedAt: deletedAt },
	});
	await createRewardImageRows(tx, rewardId, images.organizationId, images.fileIds);
}

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
			...fieldWhere(toPrismaEqualityFilter(filter?.organizationId), (organizationId) => ({ organizationId })),
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

/**
 * One review-state transition: `shared` is written to the reward AND (when it
 * has one) its referrer reward; `rewardOnly` goes to the reward alone.
 */
async function transitionWithReferrer(
	tx: Prisma.TransactionClient,
	rewardId: string,
	referrerRewardId: string | null,
	shared: Prisma.RewardUncheckedUpdateInput,
	rewardOnly: Prisma.RewardUncheckedUpdateInput = {},
): Promise<void> {
	await tx.reward.update({ where: { id: rewardId }, data: { ...shared, ...rewardOnly } });
	if (referrerRewardId !== null) {
		await tx.reward.update({ where: { id: referrerRewardId }, data: shared });
	}
}

@Injectable()
export class RewardRepository {
	public constructor(private readonly prisma: PrismaService) {}

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

	/**
	 * Creates the reward with its images (in order) and store scope, after
	 * locking and checking the images; throws {@link RewardImagesUnavailableError}.
	 */
	public async createConsumerReward(
		data: Prisma.RewardUncheckedCreateInput,
		imageFileIds: readonly string[],
		locationIds: readonly string[],
	): Promise<RewardWithOrganization> {
		return this.prisma.$transaction(async (tx) => {
			await lockUsableRewardImages(tx, data.organizationId, imageFileIds);
			const reward = await tx.reward.create({ data });
			await createRewardImageRows(tx, reward.id, reward.organizationId, imageFileIds);

			if (reward.locationScopeType === "SELECTED" && locationIds.length > 0) {
				await tx.rewardLocationScope.createMany({
					data: locationIds.map((locationId) => ({
						organizationId: reward.organizationId,
						rewardId: reward.id,
						locationId,
					})),
				});
			}

			return tx.reward.findUniqueOrThrow({ where: { id: reward.id }, include: REWARD_WITH_ORGANIZATION_INCLUDE });
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

	/** Creates a referrer reward showing the same images as the consumer reward it is earned through (already checked and locked by it). */
	public async createReferrerReward(data: Prisma.RewardUncheckedCreateInput, imageFileIds: readonly string[]): Promise<Reward> {
		return this.prisma.$transaction(async (tx) => {
			const reward = await tx.reward.create({ data });
			await createRewardImageRows(tx, reward.id, reward.organizationId, imageFileIds);
			return reward;
		});
	}

	/**
	 * Updates the reward with `data` and replaces its images — and those of its
	 * referrer reward, which shows the same ones — after locking and checking
	 * the new images; throws {@link RewardImagesUnavailableError}.
	 */
	public async updateRewardWithImages(rewardId: string, referrerRewardId: string | null, data: Prisma.RewardUpdateInput, images: RewardImageSet): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await lockUsableRewardImages(tx, images.organizationId, images.fileIds);
			await tx.reward.update({ where: { id: rewardId }, data });
			await replaceRewardImageRows(tx, rewardId, images);
			if (referrerRewardId !== null) {
				await replaceRewardImageRows(tx, referrerRewardId, images);
			}
		});
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

	/** One live consumer reward with its organization, images and stores, whatever its status (admin moderation detail). */
	public async findConsumerWithOrganization(rewardId: string): Promise<RewardWithOrganization | null> {
		return this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false, rewardKind: "CONSUMER" },
			include: REWARD_WITH_ORGANIZATION_INCLUDE,
		});
	}

	public async findPendingReviewById(rewardId: string): Promise<RewardPendingReviewSummary | null> {
		return this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false, rewardKind: "CONSUMER" },
			select: { id: true, title: true, organizationId: true, referrerRewardId: true, status: true },
		});
	}

	/**
	 * The stored file behind one live image of a live consumer reward — `null`
	 * when the file is not (or no longer) one of that reward's images, or is not
	 * READY. Reward images are READY before they can be attached, so a `null`
	 * here means the pair is wrong, not that processing is pending.
	 */
	public async findRewardImageFile(rewardId: string, fileId: string): Promise<StoredFile | null> {
		const image = await this.prisma.rewardImage.findFirst({
			where: {
				rewardId,
				fileId,
				isDeleted: false,
				reward: { isDeleted: false, rewardKind: "CONSUMER" },
				file: { isDeleted: false, status: "READY" },
			},
			select: { file: true },
		});
		return image?.file ?? null;
	}

	/**
	 * A live consumer reward's title and the stored files of its live, READY
	 * images in display order — `null` when there is no such reward.
	 */
	public async findRewardImageFiles(rewardId: string): Promise<{ readonly title: string; readonly files: StoredFile[] } | null> {
		const reward = await this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false, rewardKind: "CONSUMER" },
			select: {
				title: true,
				images: {
					where: { isDeleted: false, file: { isDeleted: false, status: "READY" } },
					orderBy: { position: "asc" },
					select: { file: true },
				},
			},
		});
		return reward === null ? null : { title: reward.title, files: reward.images.map((image) => image.file) };
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
			await transitionWithReferrer(tx, rewardId, referrerRewardId, { status: "PUBLISHED", reviewedAt: now, autoPublishAt: null });

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
			await transitionWithReferrer(
				tx,
				rewardId,
				referrerRewardId,
				{ status: "PUBLISHED", reviewedAt: now, reviewedByUserId: adminUserId, autoPublishAt: null },
				{ rejectionReason: null },
			);
		});
	}

	public async rejectInTransaction(rewardId: string, referrerRewardId: string | null, adminUserId: string, reason: string | null, now: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await transitionWithReferrer(
				tx,
				rewardId,
				referrerRewardId,
				{ status: "DRAFT", reviewedAt: now, reviewedByUserId: adminUserId, autoPublishAt: null, submittedForReviewAt: null },
				{ rejectionReason: reason },
			);
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
