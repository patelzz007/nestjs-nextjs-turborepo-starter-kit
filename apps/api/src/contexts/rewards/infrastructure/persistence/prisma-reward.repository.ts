import { Prisma } from "@prisma/client";

import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { Reward, type RewardInventoryDelta } from "../../domain/aggregates/reward.aggregate";
import type { ReferrerRewardSnapshot, RewardSnapshot } from "../../domain/aggregates/reward.state";
import type { ReferrerReward } from "../../domain/entities/referrer-reward.entity";
import { RewardNotFoundError } from "../../domain/errors/reward.errors";
import type { RewardRepository } from "../../domain/repositories/reward.repository";
import { REWARD_AGGREGATE_INCLUDE, rulesColumn, toRewardState, type RewardAggregateRow } from "./reward.mapper";

/** Thrown inside the save when a compare-and-set matched nothing; the transaction rolls back. */
class RewardSaveConflict extends Error {
	public constructor(public readonly rewardId: string) {
		super(`Reward ${rewardId} changed after it was loaded.`);
		this.name = "RewardSaveConflict";
	}
}

/** Increment (or decrement) of one counter; `{ increment: 0 }` leaves it untouched. */
function counterChange(delta: number): { increment: number } {
	return { increment: delta };
}

/** A decrement must still leave the counter non-negative (a concurrent change may have used the units). */
function nonNegativeAfter(column: "quantityRemaining" | "quantityReserved" | "referralPoolRemaining", delta: number): Prisma.RewardWhereInput {
	return delta < 0 ? { [column]: { gte: -delta } } : {};
}

/**
 * The Reward aggregate on Prisma, bound to one transaction. Saves are compare-and-set on the
 * loaded `status`, `updatedAt` and `autoPublishAt` (plus `autoPublishAt <= dueBy` for an
 * auto-publish, D10); counters are written as increments.
 */
export class PrismaRewardRepository implements RewardRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async getConsumerInTenant(tenantId: string, rewardId: string): Promise<Reward> {
		return this.require(rewardId, await this.findRow({ id: rewardId, tenantId, isDeleted: false, rewardKind: "CONSUMER" }));
	}

	public async getConsumer(rewardId: string): Promise<Reward> {
		return this.require(rewardId, await this.findConsumer(rewardId));
	}

	public async findConsumer(rewardId: string): Promise<Reward | null> {
		const row = await this.findRow({ id: rewardId, isDeleted: false, rewardKind: "CONSUMER" });
		return row === null ? null : Reward.rehydrate(toRewardState(row));
	}

	public async getLive(rewardId: string): Promise<Reward> {
		const row = await this.findRow({ id: rewardId, isDeleted: false });
		return this.require(rewardId, row === null ? null : Reward.rehydrate(toRewardState(row)));
	}

	public async getForInventory(rewardId: string): Promise<Reward> {
		await this.db.$queryRaw`SELECT id FROM "Reward" WHERE id = ${rewardId} AND "isDeleted" = false FOR UPDATE`;
		return this.getLive(rewardId);
	}

	/**
	 * Every requested reward and its referrer child in one statement. `ORDER BY id` sorts BEFORE the
	 * rows are locked (Postgres locks rows as the sorted result is read), so every caller takes the
	 * locks in the same order.
	 */
	public async lockForCheckout(rewardIds: readonly string[]): Promise<void> {
		const ids = [...new Set(rewardIds)];
		if (ids.length === 0) {
			return;
		}
		await this.db.$queryRaw`
			SELECT id FROM "Reward"
			WHERE "isDeleted" = false
				AND (id IN (${Prisma.join(ids)})
					OR id IN (SELECT "referrerRewardId" FROM "Reward" WHERE id IN (${Prisma.join(ids)}) AND "referrerRewardId" IS NOT NULL))
			ORDER BY id
			FOR UPDATE`;
	}

	/**
	 * The consumer reward and then its referrer child, both locked `FOR UPDATE` in that order (a
	 * referrer claim's expiry locks the child alone, so the order cannot deadlock with it). A checkout
	 * already holds both from {@link lockForCheckout}, so it never takes them in this order itself.
	 */
	public async getForReferralCredit(rewardId: string): Promise<Reward> {
		await this.db.$queryRaw`SELECT id FROM "Reward" WHERE id = ${rewardId} AND "isDeleted" = false FOR UPDATE`;
		await this.db.$queryRaw`
			SELECT child.id FROM "Reward" child
			JOIN "Reward" parent ON parent."referrerRewardId" = child.id
			WHERE parent.id = ${rewardId} AND child."isDeleted" = false
			FOR UPDATE OF child`;
		return this.getLive(rewardId);
	}

	public async add(reward: Reward): Promise<void> {
		const snapshot = reward.snapshot();
		await this.db.reward.create({
			data: {
				id: snapshot.id,
				tenantId: snapshot.tenantId,
				title: snapshot.title,
				description: snapshot.description,
				rewardType: snapshot.offer.rewardType,
				rewardValue: snapshot.offer.rewardValue,
				termsConditions: snapshot.offer.termsConditions,
				rewardKind: snapshot.kind,
				category: snapshot.offer.category,
				rules: rulesColumn(snapshot.rules),
				minSpendMinor: snapshot.rules.minSpend === null ? null : snapshot.rules.minSpend.amount,
				quantityTotal: snapshot.inventory.quantityTotal,
				quantityRemaining: snapshot.inventory.quantityRemaining,
				startDate: snapshot.startDate,
				expiryDate: snapshot.expiryDate,
				status: snapshot.review.status,
				submittedForReviewAt: snapshot.review.submittedForReviewAt,
				autoPublishAt: snapshot.review.autoPublishAt,
				referralsEnabled: snapshot.referralsEnabled,
				referralPoolTotal: snapshot.referralPoolTotal,
				referralPoolRemaining: snapshot.referralPoolRemaining,
				locationScopeType: snapshot.locationScope.type,
				updatedAt: snapshot.updatedAt,
			},
			select: { id: true },
		});
		await this.insertImages(snapshot.id, snapshot.tenantId, snapshot.imageFileIds);
		await this.insertLocationScopes(snapshot.id, snapshot);
		if (snapshot.referrer !== null) {
			await this.insertReferrer(snapshot, snapshot.referrer);
			await this.db.reward.updateMany({ where: { id: snapshot.id }, data: { referrerRewardId: snapshot.referrer.id } });
		}
	}

	public async save(reward: Reward): Promise<void> {
		try {
			await this.write(reward);
		} catch (error) {
			if (error instanceof RewardSaveConflict) {
				throw new ConcurrentModificationError(error.rewardId);
			}
			throw error;
		}
	}

	public async saveIfUnchanged(reward: Reward): Promise<boolean> {
		if (!(await this.writeRoot(reward))) {
			return false;
		}
		try {
			await this.writeParts(reward);
		} catch (error) {
			if (error instanceof RewardSaveConflict) {
				throw new ConcurrentModificationError(error.rewardId);
			}
			throw error;
		}
		return true;
	}

	/**
	 * The referrer child of a new reward: shows the same images at the same stores. Kept as its own
	 * step so a test-only adapter can fail it and prove nothing of the reward is left behind (D02).
	 */
	protected async insertReferrer(parent: RewardSnapshot, child: ReferrerRewardSnapshot): Promise<void> {
		await this.db.reward.create({
			data: {
				id: child.id,
				tenantId: parent.tenantId,
				title: child.title,
				description: child.description,
				rewardType: child.offer.rewardType,
				rewardValue: child.offer.rewardValue,
				termsConditions: child.offer.termsConditions,
				rewardKind: "REFERRER",
				category: child.offer.category,
				quantityTotal: child.inventory.quantityTotal,
				quantityRemaining: child.inventory.quantityRemaining,
				expiryDate: child.expiryDate,
				status: child.review.status,
				submittedForReviewAt: child.review.submittedForReviewAt,
				autoPublishAt: child.review.autoPublishAt,
				referralsEnabled: false,
				locationScopeType: parent.locationScope.type,
				parentConsumerRewardId: parent.id,
				updatedAt: child.updatedAt,
			},
			select: { id: true },
		});
		await this.insertImages(child.id, parent.tenantId, parent.imageFileIds);
		await this.insertLocationScopes(child.id, parent);
	}

	private async write(reward: Reward): Promise<void> {
		if (!(await this.writeRoot(reward))) {
			throw new RewardSaveConflict(reward.id);
		}
		await this.writeParts(reward);
	}

	/** The referrer child and the image rows, after the reward row's compare-and-set succeeded. */
	private async writeParts(reward: Reward): Promise<void> {
		const child = reward.referrerChild;
		if (child?.hasChanges === true) {
			await this.writeReferrer(child);
		}
		const images = reward.imagesToBind();
		const replacedBy = reward.imagesReplacedBy;
		if (images.length > 0 && replacedBy !== null) {
			await this.replaceImages(reward.id, reward.tenantId, images, replacedBy);
			if (child !== null) {
				await this.replaceImages(child.id, reward.tenantId, images, replacedBy);
			}
		}
	}

	private async writeRoot(reward: Reward): Promise<boolean> {
		const token = reward.concurrencyToken;
		if (token === null) {
			throw new RewardSaveConflict(reward.id);
		}
		const snapshot = reward.snapshot();
		const delta = reward.inventoryDelta();
		const poolDelta = reward.referralPoolDelta();
		const dueBy = reward.autoPublishDueBy;
		const where: Prisma.RewardWhereInput = {
			id: reward.id,
			isDeleted: false,
			status: token.status,
			updatedAt: token.updatedAt,
			AND: [{ autoPublishAt: token.autoPublishAt }, ...(dueBy === null ? [] : [{ autoPublishAt: { lte: dueBy } }])],
			...nonNegativeAfter("quantityRemaining", delta.quantityRemaining),
			...nonNegativeAfter("quantityReserved", delta.quantityReserved),
			...nonNegativeAfter("referralPoolRemaining", poolDelta),
		};
		const counters: Prisma.RewardUpdateManyMutationInput = {
			...counterColumns(delta),
			// The pool is nullable: it is written as an increment only when this unit of work spent from it.
			...(poolDelta === 0 ? {} : { referralPoolRemaining: counterChange(poolDelta) }),
			updatedAt: snapshot.updatedAt,
		};
		const data: Prisma.RewardUpdateManyMutationInput = reward.hasDefinitionChanges ? { ...counters, ...definitionColumns(snapshot) } : counters;
		const updated = await this.db.reward.updateMany({ where, data });
		return updated.count === 1;
	}

	private async writeReferrer(child: ReferrerReward): Promise<void> {
		const token = child.concurrencyToken;
		if (token === null) {
			throw new RewardSaveConflict(child.id);
		}
		const snapshot = child.snapshot();
		const delta = child.inventoryDelta();
		const updated = await this.db.reward.updateMany({
			where: {
				id: child.id,
				isDeleted: false,
				status: token.status,
				updatedAt: token.updatedAt,
				...nonNegativeAfter("quantityRemaining", delta.quantityRemaining),
				...nonNegativeAfter("quantityReserved", delta.quantityReserved),
			},
			data: {
				...counterColumns(delta),
				title: snapshot.title,
				rewardType: snapshot.offer.rewardType,
				rewardValue: snapshot.offer.rewardValue,
				termsConditions: snapshot.offer.termsConditions,
				expiryDate: snapshot.expiryDate,
				status: snapshot.review.status,
				submittedForReviewAt: snapshot.review.submittedForReviewAt,
				autoPublishAt: snapshot.review.autoPublishAt,
				reviewedAt: snapshot.review.reviewedAt,
				reviewedByUserId: snapshot.review.reviewedByUserId,
				updatedAt: snapshot.updatedAt,
			},
		});
		if (updated.count !== 1) {
			throw new RewardSaveConflict(child.id);
		}
	}

	private async findRow(where: Prisma.RewardWhereInput): Promise<RewardAggregateRow | null> {
		return this.db.reward.findFirst({ where, include: REWARD_AGGREGATE_INCLUDE });
	}

	private require(rewardId: string, reward: Reward | RewardAggregateRow | null): Reward {
		if (reward === null) {
			throw new RewardNotFoundError(rewardId);
		}
		return reward instanceof Reward ? reward : Reward.rehydrate(toRewardState(reward));
	}

	/** Image rows in display order (position 0 is the cover). */
	private async insertImages(rewardId: string, tenantId: string, fileIds: readonly string[]): Promise<void> {
		await this.db.rewardImage.createMany({ data: fileIds.map((fileId, position) => ({ rewardId, tenantId, fileId, position })) });
	}

	/** The old image rows are soft-deleted (kept as history), the new ones written in order. */
	private async replaceImages(rewardId: string, tenantId: string, fileIds: readonly string[], replacedBy: { readonly actorId: string; readonly at: number }): Promise<void> {
		const deletedAt = BigInt(replacedBy.at);
		await this.db.rewardImage.updateMany({ where: { rewardId, isDeleted: false }, data: { isDeleted: true, deletedAt, deletedBy: replacedBy.actorId, updatedAt: deletedAt } });
		await this.insertImages(rewardId, tenantId, fileIds);
	}

	private async insertLocationScopes(rewardId: string, parent: RewardSnapshot): Promise<void> {
		if (parent.locationScope.type !== "SELECTED" || parent.locationScope.locationIds.length === 0) {
			return;
		}
		await this.db.rewardLocationScope.createMany({
			data: parent.locationScope.locationIds.map((locationId) => ({ tenantId: parent.tenantId, rewardId, locationId })),
		});
	}
}

/** The stock counters as increments (a zero delta leaves the column as it is). */
function counterColumns(delta: RewardInventoryDelta): Prisma.RewardUpdateManyMutationInput {
	return {
		quantityTotal: counterChange(delta.quantityTotal),
		quantityRemaining: counterChange(delta.quantityRemaining),
		quantityReserved: counterChange(delta.quantityReserved),
		claimCount: counterChange(delta.claimCount),
		redemptionCount: counterChange(delta.redemptionCount),
	};
}

/** Every column a merchant edit or a review decision can change. */
function definitionColumns(snapshot: RewardSnapshot): Prisma.RewardUpdateManyMutationInput {
	return {
		title: snapshot.title,
		description: snapshot.description,
		rewardType: snapshot.offer.rewardType,
		rewardValue: snapshot.offer.rewardValue,
		termsConditions: snapshot.offer.termsConditions,
		rules: rulesColumn(snapshot.rules),
		minSpendMinor: snapshot.rules.minSpend === null ? null : snapshot.rules.minSpend.amount,
		startDate: snapshot.startDate,
		expiryDate: snapshot.expiryDate,
		status: snapshot.review.status,
		submittedForReviewAt: snapshot.review.submittedForReviewAt,
		autoPublishAt: snapshot.review.autoPublishAt,
		reviewedAt: snapshot.review.reviewedAt,
		reviewedByUserId: snapshot.review.reviewedByUserId,
		rejectionReason: snapshot.rejectionReason,
		referralsEnabled: snapshot.referralsEnabled,
		referralPoolTotal: snapshot.referralPoolTotal,
		referralPoolRemaining: snapshot.referralPoolRemaining,
	};
}
