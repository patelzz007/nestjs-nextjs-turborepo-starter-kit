import { describe, expect, it } from "vitest";

import {
	mapMerchantCreateRewardFormToInput,
	mapMerchantUpdateRewardFormToInput,
	MerchantCreateRewardSchema,
	MerchantUpdateRewardSchema,
	type MerchantCreateRewardFormValues,
} from "../reward";
import { RewardTypeSchema } from "../reward-enums";
import { REWARD_FREE_ITEM_SKU_MAX_LENGTH, rewardTypeGivesFreeItem, RewardFreeItemSchema } from "../reward-free-item";

const IMAGE = "0193f2c4-0000-7000-8000-0000000000b1";
const EXPIRY = Date.UTC(2027, 0, 1);
const LATTE = { name: "Latte", sku: "BEV-LATTE-12OZ" };

const CREATE = {
	title: "Free latte",
	description: "One free latte",
	rewardType: "FREE_ITEM",
	rewardValue: 1,
	freeItem: LATTE,
	category: "cafe",
	imageFileIds: [IMAGE],
	quantityTotal: 10,
	expiryDate: EXPIRY,
};

function issuePaths(result: { readonly error?: { readonly issues: readonly { readonly path: readonly PropertyKey[] }[] } | undefined }): string[] {
	return (result.error?.issues ?? []).map((issue) => issue.path.map(String).join("."));
}

describe("the item a reward gives", () => {
	it("is given by free item and buy one, get one rewards only", () => {
		expect(RewardTypeSchema.options.filter(rewardTypeGivesFreeItem)).toEqual(["FREE_ITEM", "BOGO"]);
	});

	it("is required for a free item and a buy one, get one reward", () => {
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, freeItem: undefined }))).toEqual(["freeItem"]);
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, rewardType: "BOGO", freeItem: undefined }))).toEqual(["freeItem"]);
		expect(MerchantCreateRewardSchema.parse({ ...CREATE, rewardType: "BOGO" }).freeItem).toEqual(LATTE);
	});

	it("is refused for a reward that gives no item", () => {
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, rewardType: "DISCOUNT" }))).toEqual(["freeItem"]);
		expect(MerchantCreateRewardSchema.safeParse({ ...CREATE, rewardType: "DISCOUNT", freeItem: undefined }).success).toBe(true);
	});

	it("needs both a name and a SKU, trimmed", () => {
		expect(RewardFreeItemSchema.parse({ name: "  Latte ", sku: " BEV-LATTE-12OZ " })).toEqual(LATTE);
		expect(RewardFreeItemSchema.safeParse({ name: "Latte" }).success).toBe(false);
		expect(RewardFreeItemSchema.safeParse({ name: " ", sku: "A1" }).success).toBe(false);
		expect(RewardFreeItemSchema.safeParse({ name: "Latte", sku: "" }).success).toBe(false);
	});

	it("takes a SKU of letters and digits with . _ - / between them", () => {
		for (const sku of ["A", "BEV/LATTE_12.OZ", "8851234567890"]) {
			expect(RewardFreeItemSchema.safeParse({ name: "Latte", sku }).success, sku).toBe(true);
		}
		for (const sku of ["-LATTE", "LATTE-", "LAT TE", "LATTE#1", "A".repeat(REWARD_FREE_ITEM_SKU_MAX_LENGTH + 1)]) {
			expect(RewardFreeItemSchema.safeParse({ name: "Latte", sku }).success, sku).toBe(false);
		}
	});

	it("checks an update against the type it carries, and leaves one without a type to the API", () => {
		expect(issuePaths(MerchantUpdateRewardSchema.safeParse({ rewardType: "FREE_ITEM", freeItem: null }))).toEqual(["freeItem"]);
		expect(issuePaths(MerchantUpdateRewardSchema.safeParse({ rewardType: "CASHBACK", freeItem: LATTE }))).toEqual(["freeItem"]);
		expect(MerchantUpdateRewardSchema.safeParse({ freeItem: LATTE }).success).toBe(true);
		expect(MerchantUpdateRewardSchema.safeParse({ rewardType: "CASHBACK", freeItem: null }).success).toBe(true);
	});
});

describe("the reward form's free item", () => {
	const form: MerchantCreateRewardFormValues = {
		rewardType: "FREE_ITEM",
		title: "Free latte",
		description: "One free latte",
		imageFileIds: [IMAGE],
		rewardValue: 1,
		freeItem: LATTE,
		startDate: "2026-11-01",
		expiryDate: "2027-01-01",
		quantityTotal: 10,
		maxClaimsPerUser: 1,
		saveAsDraft: true,
	};

	it("sends the item while the type gives one", () => {
		expect(mapMerchantCreateRewardFormToInput(form, "cafe").freeItem).toEqual(LATTE);
		expect(mapMerchantUpdateRewardFormToInput(form).freeItem).toEqual(LATTE);
	});

	it("drops the item once the type gives none (create omits it, update clears it)", () => {
		const discount: MerchantCreateRewardFormValues = { ...form, rewardType: "DISCOUNT" };
		expect(mapMerchantCreateRewardFormToInput(discount, "cafe")).not.toHaveProperty("freeItem");
		expect(mapMerchantUpdateRewardFormToInput(discount).freeItem).toBeNull();
	});
});
