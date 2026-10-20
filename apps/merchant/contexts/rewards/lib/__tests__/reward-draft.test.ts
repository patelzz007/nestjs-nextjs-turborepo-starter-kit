import type { MerchantRewardFormValues } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { describeDraftRewardStores, describeRewardDraftGaps, formatDraftRewardEnd, RewardEditorSectionIdSchema } from "@/contexts/rewards/lib/reward-draft";

const STORE_A = { id: "5d2f6a1b-0c3e-4f7a-9b8c-2d1e0f3a4b5c", name: "Jonker Street Kitchen — Bukit Katil" };
const STORE_B = { id: "6e3a7b2c-1d4f-4a8b-8c9d-3e2f1a4b5c6d", name: "Jonker Street Kitchen — Melaka Raya" };

/** A reward the shared schema accepts — override what the test is about. */
function completeDraft(overrides: Partial<MerchantRewardFormValues> = {}): MerchantRewardFormValues {
	return {
		rewardType: "DISCOUNT",
		title: "20% off nasi lemak",
		description: "Any nasi lemak set, dine-in or takeaway.",
		imageFileIds: ["4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b"],
		rewardValue: 20,
		startDate: "2026-11-01",
		expiryDate: "2026-11-30",
		quantityTotal: 100,
		maxClaimsPerUser: 1,
		locationScopeType: "ALL_LOCATIONS",
		locationIds: [],
		...overrides,
	};
}

describe("describeRewardDraftGaps", () => {
	it("has nothing left to ask for once the shared schema accepts the reward", () => {
		expect(describeRewardDraftGaps(completeDraft())).toEqual([]);
	});

	it("lists what a blank reward still needs, in the order the fields appear on the page", () => {
		const gaps = describeRewardDraftGaps(completeDraft({ title: "", description: "", imageFileIds: [] }));

		expect(gaps.map((gap) => gap.label)).toEqual(["Give it a title", "Describe what customers get", "Add at least one photo"]);
		expect(gaps.map((gap) => gap.sectionId)).toEqual(["reward-offer", "reward-offer", "reward-photos"]);
	});

	it("names an end date before the start as one gap, linked to the schedule", () => {
		const gaps = describeRewardDraftGaps(completeDraft({ startDate: "2026-11-30", expiryDate: "2026-11-01" }));

		expect(gaps).toEqual([{ field: "expiryDate", label: "End it on or after the start date", sectionId: "reward-schedule" }]);
	});

	it("asks for a store when availability is limited to stores but none is ticked", () => {
		const gaps = describeRewardDraftGaps(completeDraft({ locationScopeType: "SELECTED", locationIds: [] }));

		expect(gaps).toEqual([{ field: "locationIds", label: "Pick at least one store", sectionId: "reward-stores" }]);
	});

	it("reads a cleared number field as missing rather than failing", () => {
		const gaps = describeRewardDraftGaps(completeDraft({ quantityTotal: Number.NaN }));

		expect(gaps.map((gap) => gap.field)).toEqual(["quantityTotal"]);
	});

	it("links every gap to a section that exists on the page", () => {
		const gaps = describeRewardDraftGaps({});

		expect(gaps.length).toBeGreaterThan(0);
		expect(gaps.every((gap) => RewardEditorSectionIdSchema.safeParse(gap.sectionId).success)).toBe(true);
	});
});

describe("formatDraftRewardEnd", () => {
	it("words a picked end date the way the catalog does", () => {
		expect(formatDraftRewardEnd("2026-11-14")).toBe("Ends 14 Nov 2026");
	});

	it("prompts for a date while none valid is picked", () => {
		expect(formatDraftRewardEnd(undefined)).toBe("No end date yet");
		expect(formatDraftRewardEnd("14/11/2026")).toBe("No end date yet");
	});
});

describe("describeDraftRewardStores", () => {
	const locations = [STORE_A, STORE_B];

	it("says all stores while the reward is not limited", () => {
		expect(describeDraftRewardStores({ locationScopeType: "ALL_LOCATIONS", locationIds: [] }, locations, "Jonker Street Kitchen").label).toBe("All stores");
		expect(describeDraftRewardStores({ locationScopeType: undefined, locationIds: undefined }, locations, undefined).label).toBe("All stores");
	});

	it("names the ticked stores by branch, keeping the full names for the tooltip", () => {
		const stores = describeDraftRewardStores({ locationScopeType: "SELECTED", locationIds: [STORE_B.id] }, locations, "Jonker Street Kitchen");

		expect(stores).toEqual({ label: "Melaka Raya", fullLabel: STORE_B.name });
	});

	it("keeps full store names while the organization's name is still loading", () => {
		expect(describeDraftRewardStores({ locationScopeType: "SELECTED", locationIds: [STORE_A.id] }, locations, undefined).label).toBe(STORE_A.name);
	});
});
