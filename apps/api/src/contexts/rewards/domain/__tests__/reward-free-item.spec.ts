import type { RewardType } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { Reward } from "../aggregates/reward.aggregate";
import type { RewardOffer } from "../aggregates/reward.state";
import { RewardFreeItemInvalidError } from "../errors/reward.errors";
import { assertFreeItemFitsType, revisedFreeItem } from "../value-objects/reward-free-item.value-object";
import { newReward, NOW, referrerRow, rewardState } from "./reward-state.fixture";

const LATTE = { name: "Latte", sku: "BEV-LATTE-12OZ" };
const CAKE = { name: "Cheesecake slice", sku: "BAK-CHEESECAKE" };
const TYPES_WITHOUT_ITEM: readonly RewardType[] = ["DISCOUNT", "CASHBACK", "POINTS"];
const MANAGER = { actorId: "merchant-1", locationIds: null };
const DISCOUNT: RewardOffer = { rewardType: "DISCOUNT", rewardValue: 15, freeItem: null, termsConditions: null, category: "cafe" };

describe("assertFreeItemFitsType", () => {
	it("needs an item for a free item and a buy one, get one reward", () => {
		expect((): void => {
			assertFreeItemFitsType("FREE_ITEM", LATTE);
		}).not.toThrow();
		expect((): void => {
			assertFreeItemFitsType("BOGO", LATTE);
		}).not.toThrow();
		expect((): void => {
			assertFreeItemFitsType("FREE_ITEM", null);
		}).toThrow(RewardFreeItemInvalidError);
		expect((): void => {
			assertFreeItemFitsType("BOGO", null);
		}).toThrow("Name the item this reward gives, with its SKU");
	});

	it("refuses an item for every other type", () => {
		for (const rewardType of TYPES_WITHOUT_ITEM) {
			expect((): void => {
				assertFreeItemFitsType(rewardType, null);
			}, rewardType).not.toThrow();
			expect((): void => {
				assertFreeItemFitsType(rewardType, LATTE);
			}, rewardType).toThrow("Only a free item or buy one, get one reward names an item");
		}
	});
});

describe("revisedFreeItem", () => {
	it("takes the item sent, including null to clear it", () => {
		expect(revisedFreeItem("FREE_ITEM", LATTE, CAKE)).toEqual(CAKE);
		expect(revisedFreeItem("DISCOUNT", LATTE, null)).toBeNull();
	});

	it("keeps the current item while the type still gives one, and drops it once it gives none", () => {
		expect(revisedFreeItem("BOGO", LATTE, undefined)).toEqual(LATTE);
		expect(revisedFreeItem("CASHBACK", LATTE, undefined)).toBeNull();
	});
});

describe("a reward's free item", () => {
	it("is required when a free item reward is created, and refused on a discount", () => {
		expect(Reward.create(newReward(), NOW).snapshot().offer.freeItem).toEqual(LATTE);
		expect(() => Reward.create(newReward({ offer: { ...newReward().offer, freeItem: null } }), NOW)).toThrow(RewardFreeItemInvalidError);
		expect(() => Reward.create(newReward({ offer: { ...DISCOUNT, freeItem: LATTE } }), NOW)).toThrow(RewardFreeItemInvalidError);
		expect(Reward.create(newReward({ offer: DISCOUNT }), NOW).snapshot().offer.freeItem).toBeNull();
	});

	it("changes with an edit, and is dropped when the type changes to one without an item", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT"));
		reward.revise({ freeItem: CAKE }, MANAGER, NOW);
		expect(reward.snapshot().offer.freeItem).toEqual(CAKE);

		reward.revise({ rewardType: "DISCOUNT", rewardValue: 10 }, MANAGER, NOW);
		expect(reward.snapshot().offer).toMatchObject({ rewardType: "DISCOUNT", rewardValue: 10, freeItem: null });
	});

	it("must be named when an edit turns a reward into one that gives an item", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT", { offer: DISCOUNT }));
		expect((): void => {
			reward.revise({ rewardType: "BOGO" }, MANAGER, NOW);
		}).toThrow(RewardFreeItemInvalidError);
		reward.revise({ rewardType: "BOGO", freeItem: LATTE }, MANAGER, NOW);
		expect(reward.snapshot().offer).toMatchObject({ rewardType: "BOGO", freeItem: LATTE });
	});

	it("cannot be cleared while the type still gives an item", () => {
		expect((): void => {
			Reward.rehydrate(rewardState("DRAFT")).revise({ freeItem: null }, MANAGER, NOW);
		}).toThrow(RewardFreeItemInvalidError);
	});

	it("is mirrored to the referrer bonus with the rest of the offer", () => {
		const reward = Reward.rehydrate(rewardState("DRAFT", { referralsEnabled: true, referralPoolTotal: 3, referralPoolRemaining: 3, referrer: referrerRow("DRAFT") }));
		reward.revise({ freeItem: CAKE }, MANAGER, NOW);
		expect(reward.snapshot().referrer?.offer.freeItem).toEqual(CAKE);
	});
});
