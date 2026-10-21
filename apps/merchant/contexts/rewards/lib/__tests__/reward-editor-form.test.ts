import { describe, expect, it } from "vitest";

import { RewardEditorFormSchema, rewardEditorErrors, toRewardEditorInput, toRewardFormCandidate, type RewardEditorInput } from "@/contexts/rewards/lib/reward-editor-form";

const IMAGE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";

function input(overrides: Partial<RewardEditorInput> = {}): RewardEditorInput {
	return {
		rewardType: "DISCOUNT",
		title: "20% off nasi lemak",
		description: "Any nasi lemak set.",
		imageFileIds: [IMAGE_ID],
		rewardValue: "20",
		minPurchase: "",
		termsConditions: "",
		startDate: "2026-11-01",
		expiryDate: "2026-11-30",
		quantityTotal: "100",
		maxClaimsPerUser: 1,
		locationScopeType: "ALL_LOCATIONS",
		locationIds: [],
		...overrides,
	};
}

describe("toRewardFormCandidate", () => {
	it("reads numbers from their text and treats blank optional fields as not given", () => {
		const candidate = toRewardFormCandidate(input({ minPurchase: " 12.5 ", termsConditions: "  " }));

		expect(candidate.rewardValue).toBe(20);
		expect(candidate.quantityTotal).toBe(100);
		expect(candidate.minPurchase).toBe(12.5);
		expect(candidate.termsConditions).toBeUndefined();
	});

	it("reads a blank required number as NaN (the schema reports it missing), never 0", () => {
		expect(toRewardFormCandidate(input({ quantityTotal: "" })).quantityTotal).toBeNaN();
	});

	it("leaves location fields out when the editor has none (editing never changes them)", () => {
		const editing: RewardEditorInput = {
			rewardType: "DISCOUNT",
			title: "20% off nasi lemak",
			description: "Any nasi lemak set.",
			imageFileIds: [IMAGE_ID],
			rewardValue: "20",
			minPurchase: "",
			termsConditions: "",
			startDate: "2026-11-01",
			expiryDate: "2026-11-30",
			quantityTotal: "100",
			maxClaimsPerUser: 1,
		};
		const candidate = toRewardFormCandidate(editing);

		expect("locationScopeType" in candidate).toBe(false);
		expect("locationIds" in candidate).toBe(false);
	});
});

describe("RewardEditorFormSchema", () => {
	it("outputs the shared form values the API mappers take", () => {
		expect(RewardEditorFormSchema.parse(input({ minPurchase: "30", termsConditions: "Dine-in only." }))).toMatchObject({
			rewardValue: 20,
			quantityTotal: 100,
			minPurchase: 30,
			termsConditions: "Dine-in only.",
		});
	});
});

describe("rewardEditorErrors", () => {
	it("is empty for valid values, and names the first message of each failing field", () => {
		expect(rewardEditorErrors(input())).toEqual({});

		const errors = rewardEditorErrors(input({ imageFileIds: [], startDate: "2026-11-30", expiryDate: "2026-11-01" }));
		expect(errors.imageFileIds).toBe("Add at least one image");
		expect(errors.expiryDate).toBe("Expiry date must be on or after the start date");
		expect(errors.title).toBeUndefined();
	});
});

describe("toRewardEditorInput", () => {
	it("holds a saved reward's numbers as text and its missing optional values as blank", () => {
		const editorInput = toRewardEditorInput(RewardEditorFormSchema.parse(input({ minPurchase: "30" })));

		expect(editorInput.rewardValue).toBe("20");
		expect(editorInput.minPurchase).toBe("30");
		expect(editorInput.quantityTotal).toBe("100");
		expect(toRewardEditorInput(RewardEditorFormSchema.parse(input())).minPurchase).toBe("");
		expect(toRewardEditorInput(RewardEditorFormSchema.parse(input())).termsConditions).toBe("");
	});
});
