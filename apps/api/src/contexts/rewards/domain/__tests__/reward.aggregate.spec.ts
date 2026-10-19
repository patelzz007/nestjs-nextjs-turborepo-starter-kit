import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { Reward, type RewardManager } from "../aggregates/reward.aggregate";
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
import { RewardApproved, RewardAutoPublished, RewardCreated, RewardRejected, RewardRevised, RewardSubmittedForReview } from "../events/reward.events";
import { RewardLocationScope } from "../value-objects/reward-location-scope.value-object";
import { RewardRulesValue } from "../value-objects/reward-rules.value-object";
import { AUTO_PUBLISH_WINDOW_MS, REFERRER_REWARD_MAX_TTL_MS, REWARD_LIFECYCLE_STATUSES } from "../value-objects/reward-status.value-object";
import {
	LOADED_UPDATED_AT,
	newReward,
	NOW,
	ORGANIZATION_ID,
	referrerRow,
	REFERRER_ID,
	REVIEWER_ID,
	REWARD_ID,
	rewardState,
	STORE_A,
	STORE_B,
	WEEK_MS,
} from "./reward-state.fixture";

/** A merchant who may manage every store. */
const ALL_STORES: RewardManager = { locationIds: null, actorId: REVIEWER_ID };

function storeManager(locationIds: readonly string[]): RewardManager {
	return { locationIds, actorId: REVIEWER_ID };
}

function withReferrer(status: string): Reward {
	return Reward.rehydrate(rewardState(status, { referrer: referrerRow(status), referralsEnabled: true, referralPoolTotal: 3, referralPoolRemaining: 3 }));
}

describe("Reward.create", () => {
	it("creates a draft with no review timestamps and records RewardCreated once", () => {
		const reward = Reward.create(newReward(), NOW);
		const snapshot = reward.snapshot();
		expect(snapshot.review).toEqual({ status: "DRAFT", submittedForReviewAt: null, autoPublishAt: null, reviewedAt: null, reviewedByUserId: null });
		expect(snapshot.inventory).toEqual({ quantityTotal: 5, quantityRemaining: 5, quantityReserved: 0, claimCount: 0, redemptionCount: 0 });
		expect(snapshot.referrer).toBeNull();
		expect(reward.concurrencyToken).toBeNull();
		const events = reward.pullEvents();
		expect(events).toHaveLength(1);
		expect(events.at(0)).toBeInstanceOf(RewardCreated);
		expect(reward.pullEvents()).toHaveLength(0);
	});

	it("submits straight away when not saved as a draft, opening the 24-hour review window", () => {
		const snapshot = Reward.create(newReward({ saveAsDraft: false }), NOW).snapshot();
		expect(snapshot.review.status).toBe("PENDING_REVIEW");
		expect(snapshot.review.submittedForReviewAt).toBe(NOW);
		expect(snapshot.review.autoPublishAt).toBe(NOW + AUTO_PUBLISH_WINDOW_MS);
	});

	it("creates the referrer child with the pool, mirrored offer and a capped expiry (D02)", () => {
		const longExpiry = epochMs(NOW + REFERRER_REWARD_MAX_TTL_MS + WEEK_MS);
		const reward = Reward.create(newReward({ referralsEnabled: true, referralPoolTotal: 4, expiryDate: longExpiry, saveAsDraft: false }), NOW);
		const child = reward.snapshot().referrer;
		expect(child).not.toBeNull();
		expect(child?.id).toBe(REFERRER_ID);
		expect(child?.title).toBe("Free coffee — Referrer bonus");
		expect(child?.description).toBe("Referrer reward for Free coffee");
		expect(child?.inventory.quantityTotal).toBe(4);
		expect(child?.expiryDate).toBe(NOW + REFERRER_REWARD_MAX_TTL_MS);
		expect(child?.review.status).toBe("PENDING_REVIEW");
		expect(reward.snapshot().referralPoolRemaining).toBe(4);
	});

	it("keeps a parent expiry shorter than the cap and uses a given referrer title", () => {
		const reward = Reward.create(newReward({ referralsEnabled: true, referralPoolTotal: 1, referrerRewardTitle: "Bring a friend" }), NOW);
		expect(reward.snapshot().referrer?.expiryDate).toBe(NOW + WEEK_MS);
		expect(reward.snapshot().referrer?.title).toBe("Bring a friend");
	});

	it("ignores a pool when referrals are off", () => {
		const reward = Reward.create(newReward({ referralsEnabled: false, referralPoolTotal: 4 }), NOW);
		expect(reward.snapshot().referrer).toBeNull();
		expect(reward.snapshot().referralPoolTotal).toBeNull();
	});

	it.each([0, -1, 1.5, Number.NaN])("refuses a quantity of %s", (quantity) => {
		expect(() => Reward.create(newReward({ quantityTotal: quantity }), NOW)).toThrow(RewardQuantityInvalidError);
	});

	it("binds every image on create", () => {
		expect(Reward.create(newReward(), NOW).imagesToBind()).toEqual(["66666666-6666-4666-8666-666666666666"]);
	});
});

describe("Reward.rehydrate", () => {
	it.each(["EXPIRED", "DISABLED", "ARCHIVED", ""])("refuses the unmodelled status %s", (status) => {
		expect(() => Reward.rehydrate(rewardState(status))).toThrow(CorruptRewardStateError);
	});

	it("refuses a referrer child out of lockstep with its parent", () => {
		expect(() => Reward.rehydrate(rewardState("DRAFT", { referrer: referrerRow("PUBLISHED") }))).toThrow(CorruptRewardStateError);
	});

	it("refuses a referrer row that itself has a child", () => {
		expect(() => Reward.rehydrate(rewardState("PUBLISHED", { kind: "REFERRER", referrer: referrerRow("PUBLISHED") }))).toThrow(CorruptRewardStateError);
	});

	it("refuses a child that is not a referrer reward", () => {
		expect(() => Reward.rehydrate(rewardState("DRAFT", { referrer: referrerRow("DRAFT", { kind: "CONSUMER" }) }))).toThrow(CorruptRewardStateError);
	});

	it.each([-1, 0.5])("refuses a counter of %s", (value) => {
		expect(() =>
			Reward.rehydrate(rewardState("PUBLISHED", { inventory: { quantityTotal: 5, quantityRemaining: value, quantityReserved: 0, claimCount: 0, redemptionCount: 0 } })),
		).toThrow(CorruptRewardStateError);
	});

	it("keeps what it was loaded with as the concurrency token and records nothing", () => {
		const reward = Reward.rehydrate(rewardState("PENDING_REVIEW"));
		expect(reward.concurrencyToken).toEqual({ status: "PENDING_REVIEW", updatedAt: LOADED_UPDATED_AT, autoPublishAt: NOW });
		expect(reward.pullEvents()).toHaveLength(0);
		expect(reward.imagesToBind()).toEqual([]);
	});
});

describe("Reward lifecycle", () => {
	it("submits a draft and moves the referrer child with it (D04)", () => {
		const reward = withReferrer("DRAFT");
		reward.submitForReview(ALL_STORES, NOW);
		const snapshot = reward.snapshot();
		expect(snapshot.review.status).toBe("PENDING_REVIEW");
		expect(snapshot.review.autoPublishAt).toBe(NOW + AUTO_PUBLISH_WINDOW_MS);
		expect(snapshot.referrer?.review).toEqual(snapshot.review);
		expect(reward.referrerChild?.hasChanges).toBe(true);
		const events = reward.pullEvents();
		expect(events).toHaveLength(1);
		expect(events.at(0)).toBeInstanceOf(RewardSubmittedForReview);
	});

	it("approves with the reviewer, clears the review window and the rejection reason (D01)", () => {
		const reward = Reward.rehydrate(rewardState("PENDING_REVIEW", { rejectionReason: "old", referrer: referrerRow("PENDING_REVIEW") }));
		reward.approve(REVIEWER_ID, NOW);
		const snapshot = reward.snapshot();
		expect(snapshot.review).toMatchObject({ status: "PUBLISHED", autoPublishAt: null, reviewedAt: NOW, reviewedByUserId: REVIEWER_ID });
		expect(snapshot.rejectionReason).toBeNull();
		expect(snapshot.referrer?.review.status).toBe("PUBLISHED");
		const [event] = reward.pullEvents();
		expect(event).toBeInstanceOf(RewardApproved);
		expect(event).toMatchObject({ rewardId: REWARD_ID, organizationId: ORGANIZATION_ID, title: "Free coffee", reviewerUserId: REVIEWER_ID });
	});

	it("rejects back to draft with a reason, clearing submission and window (D01)", () => {
		const reward = withReferrer("PENDING_REVIEW");
		reward.reject(REVIEWER_ID, "Fix the terms", NOW);
		const snapshot = reward.snapshot();
		expect(snapshot.review).toEqual({ status: "DRAFT", submittedForReviewAt: null, autoPublishAt: null, reviewedAt: NOW, reviewedByUserId: REVIEWER_ID });
		expect(snapshot.rejectionReason).toBe("Fix the terms");
		expect(snapshot.referrer?.review.status).toBe("DRAFT");
		const [event] = reward.pullEvents();
		expect(event).toBeInstanceOf(RewardRejected);
		expect(event).toMatchObject({ reason: "Fix the terms" });
	});

	it.each(["", " ", "\t\n"])("refuses a blank rejection reason %j with its own error", (reason) => {
		const reward = Reward.rehydrate(rewardState("PENDING_REVIEW"));
		expect(() => {
			reward.reject(REVIEWER_ID, reason, NOW);
		}).toThrow(RewardRejectionReasonBlankError);
		expect(reward.currentStatus).toBe("PENDING_REVIEW");
		expect(reward.pullEvents()).toHaveLength(0);
	});

	it.each(REWARD_LIFECYCLE_STATUSES.filter((status) => status !== "DRAFT"))("refuses to submit a %s reward", (status) => {
		expect(() => {
			Reward.rehydrate(rewardState(status)).submitForReview(ALL_STORES, NOW);
		}).toThrow(RewardNotDraftError);
	});

	it.each(REWARD_LIFECYCLE_STATUSES.filter((status) => status !== "PENDING_REVIEW"))("refuses to approve or reject a %s reward", (status) => {
		expect(() => {
			Reward.rehydrate(rewardState(status)).approve(REVIEWER_ID, NOW);
		}).toThrow(RewardNotPendingReviewError);
		expect(() => {
			Reward.rehydrate(rewardState(status)).reject(REVIEWER_ID, "reason", NOW);
		}).toThrow(RewardNotPendingReviewError);
	});

	it("tells a store-limited merchant that a reward outside its stores does not exist", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT", { locationScope: RewardLocationScope.selected([STORE_A, STORE_B]) }));
		expect(() => {
			reward.submitForReview(storeManager([STORE_A]), NOW);
		}).toThrow(RewardNotFoundError);
		expect(() => {
			reward.revise({ title: "x" }, storeManager([STORE_A]), NOW);
		}).toThrow(RewardNotFoundError);
		reward.submitForReview(storeManager([STORE_A, STORE_B]), NOW);
		expect(reward.currentStatus).toBe("PENDING_REVIEW");
	});

	it("never lets a store-limited merchant manage an organization-wide reward", () => {
		expect(() => {
			Reward.rehydrate(rewardState("DRAFT")).submitForReview(storeManager([STORE_A]), NOW);
		}).toThrow(RewardNotFoundError);
	});
});

describe("Reward.autoPublish (D10)", () => {
	it.each([
		["due exactly now", NOW, true],
		["due a millisecond ago", epochMs(NOW - 1), true],
		["due a millisecond from now", epochMs(NOW + 1), false],
	])("is due when %s", (_label, autoPublishAt, due) => {
		const reward = Reward.rehydrate(rewardState("PENDING_REVIEW", { autoPublishAt }));
		expect(reward.isDueForAutoPublish(NOW)).toBe(due);
	});

	it("publishes a due reward and its child, keeping the save guarded by the due time", () => {
		const reward = withReferrer("PENDING_REVIEW");
		reward.autoPublish(NOW);
		const snapshot = reward.snapshot();
		expect(snapshot.review).toMatchObject({ status: "PUBLISHED", autoPublishAt: null, reviewedAt: NOW, reviewedByUserId: null });
		expect(snapshot.referrer?.review.status).toBe("PUBLISHED");
		expect(reward.autoPublishDueBy).toBe(NOW);
		expect(reward.pullEvents().at(0)).toBeInstanceOf(RewardAutoPublished);
	});

	it("refuses a resubmitted reward whose new window has not elapsed", () => {
		const reward = Reward.rehydrate(rewardState("PENDING_REVIEW", { autoPublishAt: epochMs(NOW + AUTO_PUBLISH_WINDOW_MS) }));
		expect(() => {
			reward.autoPublish(NOW);
		}).toThrow(RewardTransitionNotAllowedError);
	});

	it.each(["DRAFT", "PUBLISHED"])("refuses a %s reward even with a past window", (status) => {
		const reward = Reward.rehydrate(rewardState(status, { autoPublishAt: epochMs(NOW - 1) }));
		expect(reward.isDueForAutoPublish(NOW)).toBe(false);
		expect(() => {
			reward.autoPublish(NOW);
		}).toThrow(RewardTransitionNotAllowedError);
	});

	it("refuses a pending reward with no window", () => {
		const reward = Reward.rehydrate(rewardState("PENDING_REVIEW", { autoPublishAt: null }));
		expect(reward.isDueForAutoPublish(NOW)).toBe(false);
	});
});

describe("Reward.revise (D03)", () => {
	it.each(["DRAFT", "PENDING_REVIEW"])("applies an edit to a %s reward and records RewardRevised", (status) => {
		const reward = Reward.rehydrate(rewardState(status));
		reward.revise({ title: "Two coffees", termsConditions: null, startDate: NOW }, ALL_STORES, NOW);
		expect(reward.snapshot()).toMatchObject({ title: "Two coffees", startDate: NOW });
		expect(reward.pullEvents().at(0)).toBeInstanceOf(RewardRevised);
	});

	it("refuses to edit a published reward", () => {
		expect(() => {
			Reward.rehydrate(rewardState("PUBLISHED")).revise({ title: "x" }, ALL_STORES, NOW);
		}).toThrow(RewardNotEditableError);
	});

	it("moves remaining by the change of total", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT", { inventory: { quantityTotal: 5, quantityRemaining: 2, quantityReserved: 3, claimCount: 3, redemptionCount: 0 } }));
		reward.revise({ quantityTotal: 3 }, ALL_STORES, NOW);
		expect(reward.snapshot().inventory).toMatchObject({ quantityTotal: 3, quantityRemaining: 0 });
		expect(reward.inventoryDelta()).toMatchObject({ quantityTotal: -2, quantityRemaining: -2, quantityReserved: 0 });
	});

	it("refuses a total below what was already handed out", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT", { inventory: { quantityTotal: 5, quantityRemaining: 2, quantityReserved: 3, claimCount: 3, redemptionCount: 0 } }));
		expect(() => {
			reward.revise({ quantityTotal: 2 }, ALL_STORES, NOW);
		}).toThrow(RewardQuantityBelowReservedError);
	});

	it.each([0, -3, 2.5])("refuses a quantity or pool of %s", (value) => {
		expect(() => {
			Reward.rehydrate(rewardState("DRAFT")).revise({ quantityTotal: value }, ALL_STORES, NOW);
		}).toThrow(RewardQuantityInvalidError);
		expect(() => {
			Reward.rehydrate(rewardState("DRAFT")).revise({ referralPoolTotal: value }, ALL_STORES, NOW);
		}).toThrow(RewardQuantityInvalidError);
	});

	it("resets the referral pool to the new total", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT", { referralPoolTotal: 3, referralPoolRemaining: 1 }));
		reward.revise({ referralPoolTotal: 6 }, ALL_STORES, NOW);
		expect(reward.snapshot()).toMatchObject({ referralPoolTotal: 6, referralPoolRemaining: 6 });
	});

	it("revises the referrer child in the same aggregate: title, mirrored offer and the expiry cap", () => {
		const reward = withReferrer("DRAFT");
		const longExpiry = epochMs(NOW + REFERRER_REWARD_MAX_TTL_MS + WEEK_MS);
		reward.revise({ referrerRewardTitle: "Bring a friend", rewardValue: 15, expiryDate: longExpiry }, ALL_STORES, NOW);
		const child = reward.snapshot().referrer;
		expect(child?.title).toBe("Bring a friend");
		expect(child?.offer.rewardValue).toBe(15);
		expect(child?.expiryDate).toBe(NOW + REFERRER_REWARD_MAX_TTL_MS);
		expect(reward.snapshot().expiryDate).toBe(longExpiry);
		expect(reward.referrerChild?.hasChanges).toBe(true);
	});

	it("leaves the referrer child untouched by edits it does not mirror", () => {
		const reward = withReferrer("DRAFT");
		reward.revise({ description: "Better coffee", quantityTotal: 9 }, ALL_STORES, NOW);
		expect(reward.referrerChild?.hasChanges).toBe(false);
	});

	it("binds new images only when the images were replaced", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT"));
		reward.revise({ title: "x" }, ALL_STORES, NOW);
		expect(reward.imagesToBind()).toEqual([]);
		reward.revise({ imageFileIds: [STORE_A] }, ALL_STORES, NOW);
		expect(reward.imagesToBind()).toEqual([STORE_A]);
		expect(reward.imagesReplacedBy).toEqual({ actorId: REVIEWER_ID, at: NOW });
	});

	it("stores new rules", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT"));
		reward.revise({ rules: RewardRulesValue.fromApi({ maxUsePerUser: 2 }) }, ALL_STORES, NOW);
		expect(reward.snapshot().rules.maxUsePerUser()).toBe(2);
	});

	it("moves updatedAt strictly forward even within the same millisecond as the load", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT", { updatedAt: NOW }));
		reward.revise({ title: "x" }, ALL_STORES, NOW);
		expect(reward.snapshot().updatedAt).toBe(NOW + 1);
	});
});

describe("Reward inventory", () => {
	it("reports claimable facts for a published, unexpired, stocked consumer reward", () => {
		const reward = Reward.rehydrate(rewardState("PUBLISHED", { rules: RewardRulesValue.fromApi({ maxUsePerUser: 1 }) }));
		expect(reward.assertClaimable(NOW)).toEqual({
			rewardId: REWARD_ID,
			organizationId: ORGANIZATION_ID,
			title: "Free coffee",
			expiryDate: NOW + WEEK_MS,
			maxClaimsPerUser: 1,
		});
	});

	it.each(["DRAFT", "PENDING_REVIEW"])("treats a %s reward as not found for claims", (status) => {
		expect(() => Reward.rehydrate(rewardState(status)).assertClaimable(NOW)).toThrow(RewardNotFoundError);
	});

	it("treats a referrer row as not found for claims", () => {
		expect(() => Reward.rehydrate(rewardState("PUBLISHED", { kind: "REFERRER" })).assertClaimable(NOW)).toThrow(RewardNotFoundError);
	});

	it.each([
		["expired a millisecond ago", epochMs(NOW - 1), RewardExpiredError],
		["expiring exactly now", NOW, null],
	])("claimability when %s", (_label, expiryDate, error) => {
		const reward = Reward.rehydrate(rewardState("PUBLISHED", { expiryDate }));
		if (error === null) {
			expect(reward.assertClaimable(NOW).expiryDate).toBe(NOW);
		} else {
			expect(() => reward.assertClaimable(NOW)).toThrow(error);
		}
	});

	it("is sold out with nothing remaining", () => {
		const reward = Reward.rehydrate(
			rewardState("PUBLISHED", { inventory: { quantityTotal: 1, quantityRemaining: 0, quantityReserved: 1, claimCount: 1, redemptionCount: 0 } }),
		);
		expect(() => reward.assertClaimable(NOW)).toThrow(RewardSoldOutError);
	});

	it("reserves one unit: remaining −1, reserved +1, claims +1", () => {
		const reward = Reward.rehydrate(
			rewardState("PUBLISHED", { inventory: { quantityTotal: 1, quantityRemaining: 1, quantityReserved: 0, claimCount: 0, redemptionCount: 0 } }),
		);
		reward.reserve(NOW);
		expect(reward.snapshot().inventory).toEqual({ quantityTotal: 1, quantityRemaining: 0, quantityReserved: 1, claimCount: 1, redemptionCount: 0 });
		expect(reward.inventoryDelta()).toEqual({ quantityTotal: 0, quantityRemaining: -1, quantityReserved: 1, claimCount: 1, redemptionCount: 0 });
		expect(() => reward.reserve(NOW)).toThrow(RewardJustSoldOutError);
	});

	it.each([
		["a draft", rewardState("DRAFT")],
		["an expired reward", rewardState("PUBLISHED", { expiryDate: epochMs(NOW - 1) })],
		["a reward offered only at closed stores", rewardState("PUBLISHED", { availableAtActiveStore: false })],
		["a referrer reward", rewardState("PUBLISHED", { kind: "REFERRER" })],
	])("refuses to reserve %s", (_label, state) => {
		expect(() => Reward.rehydrate(state).reserve(NOW)).toThrow(RewardJustSoldOutError);
	});

	it("releases and redeems reserved units", () => {
		const reward = Reward.rehydrate(
			rewardState("PUBLISHED", { inventory: { quantityTotal: 5, quantityRemaining: 3, quantityReserved: 2, claimCount: 2, redemptionCount: 0 } }),
		);
		reward.release(NOW);
		reward.recordRedemption(NOW);
		expect(reward.snapshot().inventory).toEqual({ quantityTotal: 5, quantityRemaining: 4, quantityReserved: 0, claimCount: 2, redemptionCount: 1 });
	});

	it("refuses to release or redeem without a reserved unit", () => {
		const reward = Reward.rehydrate(rewardState("PUBLISHED"));
		expect(() => {
			reward.release(NOW);
		}).toThrow(RewardReservationMissingError);
		expect(() => {
			reward.recordRedemption(NOW);
		}).toThrow(RewardReservationMissingError);
	});
});

describe("Reward.creditReferral", () => {
	it("spends one pool unit and holds one referrer unit for the credit claim", () => {
		const reward = withReferrer("PUBLISHED");

		expect(reward.creditReferral(NOW)).toEqual({ referrerRewardId: REFERRER_ID, title: "Free coffee — Referrer bonus", expiryDate: NOW + WEEK_MS });

		expect(reward.referralPoolDelta()).toBe(-1);
		expect(reward.snapshot().referralPoolRemaining).toBe(2);
		expect(reward.snapshot().referrer?.inventory).toEqual({ quantityTotal: 3, quantityRemaining: 2, quantityReserved: 1, claimCount: 1, redemptionCount: 0 });
		expect(reward.referrerChild?.inventoryDelta()).toEqual({ quantityTotal: 0, quantityRemaining: -1, quantityReserved: 1, claimCount: 1, redemptionCount: 0 });
		expect(reward.referrerChild?.hasChanges).toBe(true);
		expect(reward.inventoryDelta()).toEqual({ quantityTotal: 0, quantityRemaining: 0, quantityReserved: 0, claimCount: 0, redemptionCount: 0 });
		expect(reward.snapshot().updatedAt).toBeGreaterThan(LOADED_UPDATED_AT);
	});

	it("credits until the pool is spent, then credits nothing", () => {
		const reward = withReferrer("PUBLISHED");
		const credits = [reward.creditReferral(NOW), reward.creditReferral(NOW), reward.creditReferral(NOW), reward.creditReferral(NOW)];

		expect(credits.filter((credit) => credit !== null)).toHaveLength(3);
		expect(credits.at(-1)).toBeNull();
		expect(reward.snapshot().referralPoolRemaining).toBe(0);
	});

	it.each([
		["no referrer child", rewardState("PUBLISHED", { referralsEnabled: true, referralPoolTotal: 3, referralPoolRemaining: 3 })],
		["no pool", rewardState("PUBLISHED", { referrer: referrerRow("PUBLISHED") })],
		["a spent pool", rewardState("PUBLISHED", { referrer: referrerRow("PUBLISHED"), referralsEnabled: true, referralPoolTotal: 3, referralPoolRemaining: 0 })],
		[
			"a sold-out referrer child",
			rewardState("PUBLISHED", {
				referrer: referrerRow("PUBLISHED", { inventory: { quantityTotal: 3, quantityRemaining: 0, quantityReserved: 3, claimCount: 3, redemptionCount: 0 } }),
				referralsEnabled: true,
				referralPoolTotal: 3,
				referralPoolRemaining: 3,
			}),
		],
	])("credits nothing and changes nothing with %s", (_label, state) => {
		const reward = Reward.rehydrate(state);

		expect(reward.creditReferral(NOW)).toBeNull();

		expect(reward.referralPoolDelta()).toBe(0);
		expect(reward.snapshot().updatedAt).toBe(LOADED_UPDATED_AT);
		expect(reward.referrerChild?.hasChanges ?? false).toBe(false);
	});

	it("reports no pool change for a reward created in this unit of work", () => {
		const reward = Reward.create(newReward({ referralsEnabled: true, referralPoolTotal: 3 }), NOW);

		expect(reward.referralPoolDelta()).toBe(0);
		expect(reward.referrerChild?.inventoryDelta()).toEqual({ quantityTotal: 0, quantityRemaining: 0, quantityReserved: 0, claimCount: 0, redemptionCount: 0 });
	});
});
