import { describe, expect, it } from "vitest";

import {
	mapMerchantCreateRewardFormToInput,
	mapMerchantUpdateRewardFormToInput,
	MerchantCreateRewardSchema,
	MerchantUpdateRewardSchema,
	REWARD_MAX_AUDIENCE_CUSTOMERS,
	type MerchantCreateRewardFormValues,
} from "../reward";

const ALICE = "0193f2c4-0000-7000-8000-0000000000a1";
const BOB = "0193f2c4-0000-7000-8000-0000000000a2";
const IMAGE = "0193f2c4-0000-7000-8000-0000000000b1";
const EXPIRY = Date.UTC(2027, 0, 1);

const CREATE = {
	title: "Free latte",
	description: "One free latte",
	rewardType: "FREE_ITEM",
	rewardValue: 1,
	freeItem: { name: "Latte", sku: "BEV-LATTE-12OZ" },
	category: "cafe",
	imageFileIds: [IMAGE],
	quantityTotal: 10,
	expiryDate: EXPIRY,
};

function issuePaths(result: { readonly error?: { readonly issues: readonly { readonly path: readonly PropertyKey[] }[] } | undefined }): string[] {
	return (result.error?.issues ?? []).map((issue) => issue.path.map(String).join("."));
}

describe("who a reward is for", () => {
	it("is for everyone when nothing is chosen", () => {
		const parsed = MerchantCreateRewardSchema.parse(CREATE);

		expect(parsed.audienceType).toBe("EVERYONE");
		expect(parsed.audienceCustomerIds).toEqual([]);
	});

	it("takes the customers it is given to", () => {
		const parsed = MerchantCreateRewardSchema.parse({ ...CREATE, audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [ALICE, BOB] });

		expect(parsed.audienceCustomerIds).toEqual([ALICE, BOB]);
	});

	it("needs at least one customer when it is for chosen customers", () => {
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, audienceType: "SELECTED_CUSTOMERS" }))).toEqual(["audienceCustomerIds"]);
	});

	it("refuses customers on a reward for everyone", () => {
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, audienceCustomerIds: [ALICE] }))).toEqual(["audienceCustomerIds"]);
	});

	it("refuses referrals on a reward for chosen customers", () => {
		const result = MerchantCreateRewardSchema.safeParse({
			...CREATE,
			audienceType: "SELECTED_CUSTOMERS",
			audienceCustomerIds: [ALICE],
			referralsEnabled: true,
			referralPoolTotal: 5,
		});

		expect(issuePaths(result)).toEqual(["referralsEnabled"]);
	});

	it("takes each customer once, and at most the limit", () => {
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [ALICE, ALICE] }))).toEqual([
			"audienceCustomerIds",
		]);

		const tooMany = Array.from({ length: REWARD_MAX_AUDIENCE_CUSTOMERS + 1 }, (_unused, index) => `0193f2c4-0000-7000-8000-${String(index).padStart(12, "0")}`);
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: tooMany }))).toEqual(["audienceCustomerIds"]);
	});

	it("changes the audience on update only with its type", () => {
		expect(MerchantUpdateRewardSchema.safeParse({ audienceType: "EVERYONE", audienceCustomerIds: [] }).success).toBe(true);
		expect(issuePaths(MerchantUpdateRewardSchema.safeParse({ audienceCustomerIds: [ALICE] }))).toContain("audienceType");
	});
});

describe("a reward's minimum tier (ADR 085)", () => {
	it("is Bronze, open to every customer, when none is sent", () => {
		expect(MerchantCreateRewardSchema.parse(CREATE).minimumTier).toBe("BRONZE");
	});

	it("narrows a reward for everyone", () => {
		expect(MerchantCreateRewardSchema.parse({ ...CREATE, minimumTier: "GOLD" }).minimumTier).toBe("GOLD");
	});

	it("is refused on a reward for chosen customers, who are open at any tier", () => {
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [ALICE], minimumTier: "SILVER" }))).toEqual([
			"minimumTier",
		]);
		expect(MerchantCreateRewardSchema.safeParse({ ...CREATE, audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [ALICE], minimumTier: "BRONZE" }).success).toBe(true);
	});

	it("is refused with referrals, because a referred newcomer starts at Bronze", () => {
		expect(issuePaths(MerchantCreateRewardSchema.safeParse({ ...CREATE, minimumTier: "GOLD", referralsEnabled: true, referralPoolTotal: 5 }))).toEqual(["referralsEnabled"]);
		expect(issuePaths(MerchantUpdateRewardSchema.safeParse({ minimumTier: "DIAMOND", referralsEnabled: true }))).toEqual(["referralsEnabled"]);
	});
});

describe("the reward form's audience", () => {
	const form: MerchantCreateRewardFormValues = {
		rewardType: "FREE_ITEM",
		title: "Free latte",
		description: "One free latte",
		imageFileIds: [IMAGE],
		rewardValue: 0,
		startDate: "2026-11-01",
		expiryDate: "2027-01-01",
		quantityTotal: 10,
		maxClaimsPerUser: 1,
		saveAsDraft: true,
	};

	it("sends everyone when the form chose no one", () => {
		expect(mapMerchantCreateRewardFormToInput({ ...form, audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [] }, "cafe")).toMatchObject({
			audienceType: "EVERYONE",
			audienceCustomerIds: [],
		});
	});

	it("sends the chosen customers on create and update", () => {
		const chosen: MerchantCreateRewardFormValues = { ...form, audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [ALICE] };

		expect(mapMerchantCreateRewardFormToInput(chosen, "cafe")).toMatchObject({ audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [ALICE] });
		expect(mapMerchantUpdateRewardFormToInput(chosen)).toMatchObject({ audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [ALICE] });
	});

	it("sends the minimum tier for a reward for everyone, and Bronze for chosen customers", () => {
		expect(mapMerchantCreateRewardFormToInput({ ...form, minimumTier: "GOLD" }, "cafe")).toMatchObject({ audienceType: "EVERYONE", minimumTier: "GOLD" });
		expect(mapMerchantCreateRewardFormToInput(form, "cafe")).toMatchObject({ minimumTier: "BRONZE" });
		expect(mapMerchantUpdateRewardFormToInput({ ...form, audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [ALICE], minimumTier: "GOLD" })).toMatchObject({
			minimumTier: "BRONZE",
		});
	});
});
