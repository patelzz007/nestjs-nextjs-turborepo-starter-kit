import { epochMs, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { ReferrerReward } from "../entities/referrer-reward.entity";
import {
	CorruptRewardStateError,
	RewardExpiredError,
	RewardJustSoldOutError,
	RewardNotDraftError,
	RewardNotEditableError,
	RewardNotFoundError,
	RewardNotPendingReviewError,
	RewardQuantityBelowReservedError,
	RewardQuantityInvalidError,
	RewardRejectionReasonBlankError,
	RewardReservationMissingError,
	RewardSoldOutError,
	RewardTransitionNotAllowedError,
} from "../errors/reward.errors";
import {
	RewardApproved,
	RewardAutoPublished,
	RewardCreated,
	RewardRejected,
	RewardRevised,
	RewardSubmittedForReview,
	type RewardDomainEvent,
	type RewardEventFacts,
} from "../events/reward.events";
import { nextUpdatedAt, type RewardConcurrencyToken } from "../value-objects/reward-concurrency-token.value-object";
import type { RewardLocationScope } from "../value-objects/reward-location-scope.value-object";
import type { RewardRulesValue } from "../value-objects/reward-rules.value-object";
import {
	AUTO_PUBLISH_WINDOW_MS,
	EDITABLE_REWARD_STATUSES,
	RewardLifecycleStatusSchema,
	type RewardKindValue,
	type RewardLifecycleStatus,
} from "../value-objects/reward-status.value-object";
import type {
	ClaimableRewardFacts,
	NewRewardDefinition,
	ReferrerCreditFacts,
	RewardInventoryCounts,
	RewardOffer,
	RewardReviewState,
	RewardRevision,
	RewardRowState,
	RewardSnapshot,
	RewardState,
} from "./reward.state";

/** The one-step moves of the reward lifecycle; anything else is refused. */
const ALLOWED_TRANSITIONS: readonly (readonly [RewardLifecycleStatus, RewardLifecycleStatus])[] = [
	["DRAFT", "PENDING_REVIEW"],
	["PENDING_REVIEW", "PUBLISHED"],
	["PENDING_REVIEW", "DRAFT"],
];

/** The merchant caller of an edit: the stores it may manage (null = every store) and who it is, for audit columns. */
export interface RewardManager {
	readonly locationIds: readonly string[] | null;
	/** The member's user id, or the API key id for machine calls. */
	readonly actorId: string;
}

/** Counter changes of one unit of work, applied to the stored counters as increments. */
export type RewardInventoryDelta = RewardInventoryCounts;

const NO_INVENTORY_CHANGE: RewardInventoryDelta = { quantityTotal: 0, quantityRemaining: 0, quantityReserved: 0, claimCount: 0, redemptionCount: 0 };

function parseStatus(rewardId: string, status: string): RewardLifecycleStatus {
	const parsed = RewardLifecycleStatusSchema.safeParse(status);
	if (!parsed.success) {
		throw new CorruptRewardStateError(rewardId);
	}
	return parsed.data;
}

function isValidCounter(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 0;
}

function assertCountersValid(row: RewardRowState): void {
	const { quantityTotal, quantityRemaining, quantityReserved, claimCount, redemptionCount } = row.inventory;
	if (![quantityTotal, quantityRemaining, quantityReserved, claimCount, redemptionCount].every(isValidCounter)) {
		throw new CorruptRewardStateError(row.id);
	}
}

function reviewOf(row: RewardRowState, status: RewardLifecycleStatus): RewardReviewState {
	return {
		status,
		submittedForReviewAt: row.submittedForReviewAt,
		autoPublishAt: row.autoPublishAt,
		reviewedAt: row.reviewedAt,
		reviewedByUserId: row.reviewedByUserId,
	};
}

function assertWholeQuantity(quantity: number): void {
	if (!Number.isSafeInteger(quantity) || quantity < 1) {
		throw new RewardQuantityInvalidError(quantity);
	}
}

/**
 * The reward consistency boundary: one reward row and, for a consumer reward, the referrer child
 * its referrals earn. Commands load it, call one method, and save it with a compare-and-set on
 * {@link concurrencyToken}; the inventory port uses the stock methods under a row lock.
 */
export class Reward extends AggregateRoot<RewardDomainEvent> {
	private title: string;
	private description: string;
	private offer: RewardOffer;
	private rules: RewardRulesValue;
	private startDate: EpochMs | null;
	private expiryDate: EpochMs;
	private inventory: RewardInventoryCounts;
	private review: RewardReviewState;
	private rejectionReason: string | null;
	private referralsEnabled: boolean;
	private referralPoolTotal: number | null;
	private referralPoolRemaining: number | null;
	private imageFileIds: readonly string[];
	private imagesReplaced = false;
	private imageReplacement: { readonly actorId: string; readonly at: EpochMs } | null = null;
	private definitionChanged = false;
	private updatedAt: EpochMs;
	private autoPublishGuard: EpochMs | null = null;

	private constructor(
		public readonly id: string,
		public readonly kind: RewardKindValue,
		public readonly organizationId: string,
		private readonly locationScope: RewardLocationScope,
		private readonly availableAtActiveStore: boolean,
		private readonly referrer: ReferrerReward | null,
		private readonly loaded: { readonly token: RewardConcurrencyToken; readonly inventory: RewardInventoryCounts; readonly referralPoolRemaining: number | null } | null,
		state: Omit<RewardSnapshot, "id" | "kind" | "organizationId" | "locationScope" | "referrer">,
	) {
		super();
		this.title = state.title;
		this.description = state.description;
		this.offer = state.offer;
		this.rules = state.rules;
		this.startDate = state.startDate;
		this.expiryDate = state.expiryDate;
		this.inventory = state.inventory;
		this.review = state.review;
		this.rejectionReason = state.rejectionReason;
		this.referralsEnabled = state.referralsEnabled;
		this.referralPoolTotal = state.referralPoolTotal;
		this.referralPoolRemaining = state.referralPoolRemaining;
		this.imageFileIds = state.imageFileIds;
		this.updatedAt = state.updatedAt;
	}

	/**
	 * A new consumer reward: a draft, or submitted for review straight away. With referrals enabled
	 * and a pool, its referrer child is created with it — one aggregate, one transaction (D02).
	 */
	public static create(definition: NewRewardDefinition, now: EpochMs): Reward {
		assertWholeQuantity(definition.quantityTotal);
		const review: RewardReviewState = definition.saveAsDraft
			? { status: "DRAFT", submittedForReviewAt: null, autoPublishAt: null, reviewedAt: null, reviewedByUserId: null }
			: { status: "PENDING_REVIEW", submittedForReviewAt: now, autoPublishAt: epochMs(now + AUTO_PUBLISH_WINDOW_MS), reviewedAt: null, reviewedByUserId: null };
		const pool = definition.referralsEnabled ? definition.referralPoolTotal : null;
		if (pool !== null) {
			assertWholeQuantity(pool);
		}
		const referrer =
			pool === null
				? null
				: ReferrerReward.create(
						definition.referrerId,
						definition.referrerRewardTitle ?? `${definition.title} — Referrer bonus`,
						`Referrer reward for ${definition.title}`,
						definition.offer,
						definition.expiryDate,
						pool,
						review,
						now,
					);
		const reward = new Reward(definition.id, "CONSUMER", definition.organizationId, definition.locationScope, true, referrer, null, {
			title: definition.title,
			description: definition.description,
			offer: definition.offer,
			rules: definition.rules,
			startDate: definition.startDate,
			expiryDate: definition.expiryDate,
			inventory: { quantityTotal: definition.quantityTotal, quantityRemaining: definition.quantityTotal, quantityReserved: 0, claimCount: 0, redemptionCount: 0 },
			review,
			rejectionReason: null,
			referralsEnabled: definition.referralsEnabled,
			referralPoolTotal: pool,
			referralPoolRemaining: pool,
			imageFileIds: definition.imageFileIds,
			updatedAt: now,
		});
		reward.imagesReplaced = true;
		reward.record(new RewardCreated(now, reward.facts(), referrer === null ? null : referrer.id));
		return reward;
	}

	/** Rebuilds a stored reward. Stored state the domain cannot represent is corrupt, never silently accepted. */
	public static rehydrate(state: RewardState): Reward {
		const status = parseStatus(state.id, state.status);
		assertCountersValid(state);
		const child = state.referrer;
		if (child !== null && state.kind === "REFERRER") {
			throw new CorruptRewardStateError(state.id);
		}
		const referrer = child === null ? null : Reward.rehydrateReferrer(child, status);
		const token: RewardConcurrencyToken = { status, updatedAt: state.updatedAt, autoPublishAt: state.autoPublishAt };
		return new Reward(
			state.id,
			state.kind,
			state.organizationId,
			state.locationScope,
			state.availableAtActiveStore,
			referrer,
			{ token, inventory: state.inventory, referralPoolRemaining: state.referralPoolRemaining },
			{
				title: state.title,
				description: state.description,
				offer: state.offer,
				rules: state.rules,
				startDate: state.startDate,
				expiryDate: state.expiryDate,
				inventory: state.inventory,
				review: reviewOf(state, status),
				rejectionReason: state.rejectionReason,
				referralsEnabled: state.referralsEnabled,
				referralPoolTotal: state.referralPoolTotal,
				referralPoolRemaining: state.referralPoolRemaining,
				imageFileIds: state.imageFileIds,
				updatedAt: state.updatedAt,
			},
		);
	}

	/** A child moves in lockstep with its parent: one whose status differs is corrupt state. */
	private static rehydrateReferrer(child: RewardRowState, parentStatus: RewardLifecycleStatus): ReferrerReward {
		const status = parseStatus(child.id, child.status);
		assertCountersValid(child);
		if (child.kind !== "REFERRER" || status !== parentStatus) {
			throw new CorruptRewardStateError(child.id);
		}
		return ReferrerReward.rehydrate({
			id: child.id,
			title: child.title,
			description: child.description,
			offer: child.offer,
			expiryDate: child.expiryDate,
			inventory: child.inventory,
			review: reviewOf(child, status),
			updatedAt: child.updatedAt,
		});
	}

	// ── Persistence view ────────────────────────────────────────────────

	/** The row as it was loaded (compare-and-set input); null for a reward created in this unit of work. */
	public get concurrencyToken(): RewardConcurrencyToken | null {
		return this.loaded === null ? null : this.loaded.token;
	}

	public get currentStatus(): RewardLifecycleStatus {
		return this.review.status;
	}

	public get referrerChild(): ReferrerReward | null {
		return this.referrer;
	}

	/** Counter changes since load, written as increments so they compose with concurrent counter updates. */
	public inventoryDelta(): RewardInventoryDelta {
		if (this.loaded === null) {
			return NO_INVENTORY_CHANGE;
		}
		const before = this.loaded.inventory;
		return {
			quantityTotal: this.inventory.quantityTotal - before.quantityTotal,
			quantityRemaining: this.inventory.quantityRemaining - before.quantityRemaining,
			quantityReserved: this.inventory.quantityReserved - before.quantityReserved,
			claimCount: this.inventory.claimCount - before.claimCount,
			redemptionCount: this.inventory.redemptionCount - before.redemptionCount,
		};
	}

	/** Change of the referral pool since load, written as an increment like the stock counters (0 when unchanged). */
	public referralPoolDelta(): number {
		const loadedPool = this.loaded?.referralPoolRemaining ?? null;
		if (loadedPool === null || this.referralPoolRemaining === null) {
			return 0;
		}
		return this.referralPoolRemaining - loadedPool;
	}

	/** Images to lock and bind in this unit of work (empty when the images did not change). */
	public imagesToBind(): readonly string[] {
		return this.imagesReplaced ? this.imageFileIds : [];
	}

	/** Who replaced the images in this unit of work, and when (recorded as `deletedBy` / `deletedAt` on the old rows). */
	public get imagesReplacedBy(): { readonly actorId: string; readonly at: EpochMs } | null {
		return this.imageReplacement;
	}

	/** Whether this unit of work changed the definition or review columns (stock-only saves write the counters alone). */
	public get hasDefinitionChanges(): boolean {
		return this.definitionChanged;
	}

	/** Set when this unit of work auto-published: the save must still find `autoPublishAt <= dueBy` (D10). */
	public get autoPublishDueBy(): EpochMs | null {
		return this.autoPublishGuard;
	}

	public snapshot(): RewardSnapshot {
		return {
			id: this.id,
			kind: this.kind,
			organizationId: this.organizationId,
			title: this.title,
			description: this.description,
			offer: this.offer,
			rules: this.rules,
			startDate: this.startDate,
			expiryDate: this.expiryDate,
			inventory: this.inventory,
			review: this.review,
			rejectionReason: this.rejectionReason,
			referralsEnabled: this.referralsEnabled,
			referralPoolTotal: this.referralPoolTotal,
			referralPoolRemaining: this.referralPoolRemaining,
			locationScope: this.locationScope,
			imageFileIds: this.imageFileIds,
			updatedAt: this.updatedAt,
			referrer: this.referrer === null ? null : this.referrer.snapshot(),
		};
	}

	// ── Merchant commands ───────────────────────────────────────────────

	/**
	 * Applies a merchant's edit (D03). Allowed only while DRAFT or PENDING_REVIEW, and only for a
	 * caller who may manage every store the reward is offered at (anyone else is told it does not
	 * exist). The referrer child follows the mirrored offer terms, the images and the expiry cap.
	 */
	public revise(revision: RewardRevision, manager: RewardManager, now: EpochMs): void {
		this.assertManageableBy(manager.locationIds);
		if (!EDITABLE_REWARD_STATUSES.includes(this.review.status)) {
			throw new RewardNotEditableError(this.id);
		}
		if (revision.quantityTotal !== undefined) {
			this.changeQuantity(revision.quantityTotal);
		}
		if (revision.referralPoolTotal !== undefined) {
			assertWholeQuantity(revision.referralPoolTotal);
			this.referralPoolTotal = revision.referralPoolTotal;
			this.referralPoolRemaining = revision.referralPoolTotal;
		}
		this.title = revision.title ?? this.title;
		this.description = revision.description ?? this.description;
		this.rules = revision.rules ?? this.rules;
		this.startDate = revision.startDate === undefined ? this.startDate : revision.startDate;
		this.referralsEnabled = revision.referralsEnabled ?? this.referralsEnabled;
		const offer: RewardOffer = {
			rewardType: revision.rewardType ?? this.offer.rewardType,
			rewardValue: revision.rewardValue ?? this.offer.rewardValue,
			termsConditions: revision.termsConditions === undefined ? this.offer.termsConditions : revision.termsConditions,
			category: this.offer.category,
		};
		const offerChanged = revision.rewardType !== undefined || revision.rewardValue !== undefined || revision.termsConditions !== undefined;
		this.offer = offer;
		if (revision.imageFileIds !== undefined) {
			this.imageFileIds = revision.imageFileIds;
			this.imagesReplaced = true;
			this.imageReplacement = { actorId: manager.actorId, at: now };
		}
		if (revision.expiryDate !== undefined) {
			this.expiryDate = revision.expiryDate;
		}
		this.reviseReferrer(revision, offerChanged, now);
		this.definitionChanged = true;
		this.touch(now);
		this.record(new RewardRevised(now, this.facts()));
	}

	/** Draft → pending review, for the reward and its referrer child together (D04). */
	public submitForReview(manager: RewardManager, now: EpochMs): void {
		this.assertManageableBy(manager.locationIds);
		if (this.review.status !== "DRAFT") {
			throw new RewardNotDraftError(this.id);
		}
		this.transition(
			{
				status: "PENDING_REVIEW",
				submittedForReviewAt: now,
				autoPublishAt: epochMs(now + AUTO_PUBLISH_WINDOW_MS),
				reviewedAt: this.review.reviewedAt,
				reviewedByUserId: this.review.reviewedByUserId,
			},
			now,
		);
		this.record(new RewardSubmittedForReview(now, this.facts()));
	}

	// ── Review commands ─────────────────────────────────────────────────

	/** Pending review → published by a reviewer (D01). */
	public approve(reviewerUserId: string, now: EpochMs): void {
		if (this.review.status !== "PENDING_REVIEW") {
			throw new RewardNotPendingReviewError(this.id);
		}
		this.transition(
			{ status: "PUBLISHED", submittedForReviewAt: this.review.submittedForReviewAt, autoPublishAt: null, reviewedAt: now, reviewedByUserId: reviewerUserId },
			now,
		);
		this.rejectionReason = null;
		this.record(new RewardApproved(now, this.facts(), reviewerUserId));
	}

	/**
	 * Pending review → draft (D01). The reviewer must say why (owner decision Q74): a blank reason
	 * is refused with its own error, so a merchant is never shown an empty note.
	 */
	public reject(reviewerUserId: string, reason: string, now: EpochMs): void {
		if (this.review.status !== "PENDING_REVIEW") {
			throw new RewardNotPendingReviewError(this.id);
		}
		if (reason.trim().length === 0) {
			throw new RewardRejectionReasonBlankError();
		}
		this.transition({ status: "DRAFT", submittedForReviewAt: null, autoPublishAt: null, reviewedAt: now, reviewedByUserId: reviewerUserId }, now);
		this.rejectionReason = reason;
		this.record(new RewardRejected(now, this.facts(), reviewerUserId, reason));
	}

	/** Whether the review window has elapsed: pending review with `autoPublishAt <= now`. */
	public isDueForAutoPublish(now: EpochMs): boolean {
		return this.review.status === "PENDING_REVIEW" && this.review.autoPublishAt !== null && this.review.autoPublishAt <= now;
	}

	/** Pending review → published once the review window has elapsed (D10). */
	public autoPublish(now: EpochMs): void {
		if (!this.isDueForAutoPublish(now)) {
			throw new RewardTransitionNotAllowedError(this.id, this.review.status, "PUBLISHED");
		}
		this.autoPublishGuard = now;
		this.transition(
			{ status: "PUBLISHED", submittedForReviewAt: this.review.submittedForReviewAt, autoPublishAt: null, reviewedAt: now, reviewedByUserId: this.review.reviewedByUserId },
			now,
		);
		this.record(new RewardAutoPublished(now, this.facts()));
	}

	// ── Inventory (claims and checkout, through RewardInventoryPort) ────

	/** A consumer may start a claim: published, unexpired, in stock. Otherwise 404 / 400 / 409 as today. */
	public assertClaimable(now: EpochMs): ClaimableRewardFacts {
		if (this.kind !== "CONSUMER" || this.review.status !== "PUBLISHED") {
			throw new RewardNotFoundError(this.id);
		}
		if (this.expiryDate < now) {
			throw new RewardExpiredError();
		}
		if (this.inventory.quantityRemaining <= 0) {
			throw new RewardSoldOutError();
		}
		return { rewardId: this.id, organizationId: this.organizationId, title: this.title, expiryDate: this.expiryDate, maxClaimsPerUser: this.rules.maxUsePerUser() };
	}

	/** Takes one unit for a claim: remaining −1, reserved +1, claims +1. */
	public reserve(now: EpochMs): ClaimableRewardFacts {
		const sellable =
			this.kind === "CONSUMER" && this.review.status === "PUBLISHED" && this.expiryDate >= now && this.inventory.quantityRemaining > 0 && this.availableAtActiveStore;
		if (!sellable) {
			throw new RewardJustSoldOutError();
		}
		this.inventory = {
			...this.inventory,
			quantityRemaining: this.inventory.quantityRemaining - 1,
			quantityReserved: this.inventory.quantityReserved + 1,
			claimCount: this.inventory.claimCount + 1,
		};
		this.touch(now);
		return { rewardId: this.id, organizationId: this.organizationId, title: this.title, expiryDate: this.expiryDate, maxClaimsPerUser: this.rules.maxUsePerUser() };
	}

	/** Returns an expired claim's unit: reserved −1, remaining +1. */
	public release(now: EpochMs): void {
		this.assertReservedUnit();
		this.inventory = { ...this.inventory, quantityReserved: this.inventory.quantityReserved - 1, quantityRemaining: this.inventory.quantityRemaining + 1 };
		this.touch(now);
	}

	/** A claim was redeemed at checkout: reserved −1, redemptions +1. */
	public recordRedemption(now: EpochMs): void {
		this.assertReservedUnit();
		this.inventory = { ...this.inventory, quantityReserved: this.inventory.quantityReserved - 1, redemptionCount: this.inventory.redemptionCount + 1 };
		this.touch(now);
	}

	/**
	 * A referee redeemed this reward and their referral is being credited: one unit of the referral
	 * pool goes, and one unit of the referrer child is held for the referrer's credit claim. Both or
	 * neither: `null` (nothing changes) when there is no live referrer child, the pool is spent or
	 * the child is out of stock, and the referral then stays uncredited.
	 */
	public creditReferral(now: EpochMs): ReferrerCreditFacts | null {
		const referrer = this.referrer;
		const pool = this.referralPoolRemaining;
		if (referrer === null || pool === null || pool <= 0 || !referrer.hasStock) {
			return null;
		}
		this.referralPoolRemaining = pool - 1;
		this.touch(now);
		return referrer.reserveForCredit(now);
	}

	// ── Internals ───────────────────────────────────────────────────────

	/** The total may change only while the units already handed out still fit: remaining + delta ≥ 0. */
	private changeQuantity(nextTotal: number): void {
		assertWholeQuantity(nextTotal);
		const delta = nextTotal - this.inventory.quantityTotal;
		if (this.inventory.quantityRemaining + delta < 0) {
			throw new RewardQuantityBelowReservedError(this.id);
		}
		this.inventory = { ...this.inventory, quantityTotal: nextTotal, quantityRemaining: this.inventory.quantityRemaining + delta };
	}

	private reviseReferrer(revision: RewardRevision, offerChanged: boolean, now: EpochMs): void {
		const referrer = this.referrer;
		if (referrer === null) {
			return;
		}
		if (revision.referrerRewardTitle !== undefined) {
			referrer.rename(revision.referrerRewardTitle, now);
		}
		if (offerChanged) {
			referrer.mirrorOffer(this.offer, now);
		}
		if (revision.expiryDate !== undefined) {
			referrer.followExpiry(this.expiryDate, now);
		}
	}

	private assertManageableBy(managerLocationIds: readonly string[] | null): void {
		if (!this.locationScope.isManageableBy(managerLocationIds)) {
			throw new RewardNotFoundError(this.id);
		}
	}

	private assertReservedUnit(): void {
		if (this.inventory.quantityReserved <= 0) {
			throw new RewardReservationMissingError(this.id);
		}
	}

	private transition(next: RewardReviewState, now: EpochMs): void {
		const from = this.review.status;
		if (!ALLOWED_TRANSITIONS.some(([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === next.status)) {
			throw new RewardTransitionNotAllowedError(this.id, from, next.status);
		}
		this.review = next;
		this.definitionChanged = true;
		this.referrer?.followLifecycle(next, now);
		this.touch(now);
	}

	private touch(now: EpochMs): void {
		this.updatedAt = this.loaded === null ? now : nextUpdatedAt(this.loaded.token.updatedAt, now);
	}

	private facts(): RewardEventFacts {
		return { rewardId: this.id, organizationId: this.organizationId, title: this.title };
	}
}
