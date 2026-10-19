import { epochMs, type EpochMs } from "@workspace/shared";

import type { ReferrerCreditFacts, ReferrerRewardSnapshot, RewardInventoryCounts, RewardOffer, RewardReviewState } from "../aggregates/reward.state";
import { nextUpdatedAt, type RewardConcurrencyToken } from "../value-objects/reward-concurrency-token.value-object";
import { REFERRER_REWARD_MAX_TTL_MS } from "../value-objects/reward-status.value-object";

/**
 * The referrer bonus a consumer reward's referrals earn. It lives inside the consumer reward's
 * aggregate: only the parent changes it, and every lifecycle transition moves it in lockstep.
 */
export class ReferrerReward {
	private changed = false;
	/** The counters as they were loaded; the save writes the difference as increments. */
	private readonly loadedInventory: RewardInventoryCounts;

	private constructor(
		public readonly id: string,
		private title: string,
		private readonly description: string,
		private offer: RewardOffer,
		private expiryDate: EpochMs,
		private inventory: RewardInventoryCounts,
		private review: RewardReviewState,
		private updatedAt: EpochMs,
		private readonly loaded: RewardConcurrencyToken | null,
	) {
		this.loadedInventory = inventory;
	}

	/** A new child for a new consumer reward; its expiry is the parent's, capped at the referrer TTL from `now`. */
	public static create(
		id: string,
		title: string,
		description: string,
		offer: RewardOffer,
		parentExpiry: EpochMs,
		poolTotal: number,
		review: RewardReviewState,
		now: EpochMs,
	): ReferrerReward {
		const inventory: RewardInventoryCounts = { quantityTotal: poolTotal, quantityRemaining: poolTotal, quantityReserved: 0, claimCount: 0, redemptionCount: 0 };
		return new ReferrerReward(id, title, description, offer, cappedExpiry(parentExpiry, now), inventory, review, now, null);
	}

	public static rehydrate(snapshot: ReferrerRewardSnapshot): ReferrerReward {
		const token: RewardConcurrencyToken = { status: snapshot.review.status, updatedAt: snapshot.updatedAt, autoPublishAt: snapshot.review.autoPublishAt };
		return new ReferrerReward(
			snapshot.id,
			snapshot.title,
			snapshot.description,
			snapshot.offer,
			snapshot.expiryDate,
			snapshot.inventory,
			snapshot.review,
			snapshot.updatedAt,
			token,
		);
	}

	/** The row as it was loaded; null for a child created in this unit of work. */
	public get concurrencyToken(): RewardConcurrencyToken | null {
		return this.loaded;
	}

	/** Whether this unit of work changed the child (an unchanged child is not written). */
	public get hasChanges(): boolean {
		return this.changed;
	}

	public get currentStatus(): RewardReviewState["status"] {
		return this.review.status;
	}

	public get currentExpiry(): EpochMs {
		return this.expiryDate;
	}

	public get currentTitle(): string {
		return this.title;
	}

	public followLifecycle(review: RewardReviewState, now: EpochMs): void {
		this.review = review;
		this.touch(now);
	}

	public mirrorOffer(offer: RewardOffer, now: EpochMs): void {
		this.offer = offer;
		this.touch(now);
	}

	public rename(title: string, now: EpochMs): void {
		this.title = title;
		this.touch(now);
	}

	/** The parent's expiry changed: the child follows it, still capped at the referrer TTL from `now`. */
	public followExpiry(parentExpiry: EpochMs, now: EpochMs): void {
		this.expiryDate = cappedExpiry(parentExpiry, now);
		this.touch(now);
	}

	/** Whether one unit is left to credit a referrer with. */
	public get hasStock(): boolean {
		return this.inventory.quantityRemaining > 0;
	}

	/** Counter changes since load (zero for a child created in this unit of work: its row is inserted whole). */
	public inventoryDelta(): RewardInventoryCounts {
		const before = this.loaded === null ? this.inventory : this.loadedInventory;
		return {
			quantityTotal: this.inventory.quantityTotal - before.quantityTotal,
			quantityRemaining: this.inventory.quantityRemaining - before.quantityRemaining,
			quantityReserved: this.inventory.quantityReserved - before.quantityReserved,
			claimCount: this.inventory.claimCount - before.claimCount,
			redemptionCount: this.inventory.redemptionCount - before.redemptionCount,
		};
	}

	/** A referral was credited: one unit is held for the referrer's credit claim (remaining −1, reserved +1, claims +1). */
	public reserveForCredit(now: EpochMs): ReferrerCreditFacts {
		this.inventory = {
			...this.inventory,
			quantityRemaining: this.inventory.quantityRemaining - 1,
			quantityReserved: this.inventory.quantityReserved + 1,
			claimCount: this.inventory.claimCount + 1,
		};
		this.touch(now);
		return { referrerRewardId: this.id, title: this.title, expiryDate: this.expiryDate };
	}

	public snapshot(): ReferrerRewardSnapshot {
		return {
			id: this.id,
			title: this.title,
			description: this.description,
			offer: this.offer,
			expiryDate: this.expiryDate,
			inventory: this.inventory,
			review: this.review,
			updatedAt: this.updatedAt,
		};
	}

	private touch(now: EpochMs): void {
		this.changed = true;
		this.updatedAt = this.loaded === null ? now : nextUpdatedAt(this.loaded.updatedAt, now);
	}
}

function cappedExpiry(parentExpiry: EpochMs, now: EpochMs): EpochMs {
	return epochMs(Math.min(parentExpiry, now + REFERRER_REWARD_MAX_TTL_MS));
}
