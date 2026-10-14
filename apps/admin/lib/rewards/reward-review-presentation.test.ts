import { describe, expect, it } from "vitest";

import {
	REWARD_STATUS_PRESENTATION,
	rewardCategoryLabel,
	rewardMinimumSpendLabel,
	rewardQuantityLabel,
	rewardReferralsLabel,
	rewardStoresLabel,
	rewardUsesPerCustomerLabel,
} from "./reward-review-presentation";

describe("REWARD_STATUS_PRESENTATION", () => {
	it("names every status in sentence case, with pending review as the one waiting on the reviewer", () => {
		expect(REWARD_STATUS_PRESENTATION.PENDING_REVIEW).toEqual({ label: "Pending review", tone: "warning" });
		expect(REWARD_STATUS_PRESENTATION.PUBLISHED).toEqual({ label: "Published", tone: "success" });
		expect(REWARD_STATUS_PRESENTATION.DISABLED.tone).toBe("danger");
	});
});

describe("rewardCategoryLabel", () => {
	it("labels a known category, and shows an unknown one as stored", () => {
		expect(rewardCategoryLabel("cafe")).toBe("Café");
		expect(rewardCategoryLabel("bakery")).toBe("bakery");
	});
});

describe("rewardStoresLabel", () => {
	it("says every store, names the selected stores, or counts them when the names are not loaded", () => {
		expect(rewardStoresLabel({ locationScopeType: "ALL_LOCATIONS", locationIds: [], locationNames: [] })).toBe("All stores");
		expect(rewardStoresLabel({ locationScopeType: "SELECTED", locationIds: ["a", "b"], locationNames: ["Jonker Street", "Bukit Bintang"] })).toBe(
			"Jonker Street, Bukit Bintang",
		);
		expect(rewardStoresLabel({ locationScopeType: "SELECTED", locationIds: ["a"] })).toBe("1 store");
		expect(rewardStoresLabel({ locationScopeType: "SELECTED", locationIds: ["a", "b", "c"], locationNames: [] })).toBe("3 stores");
	});
});

describe("rewardMinimumSpendLabel", () => {
	it("shows the minimum bill in ringgit, or none", () => {
		expect(rewardMinimumSpendLabel(30)).toBe("RM 30.00");
		expect(rewardMinimumSpendLabel(12.5)).toBe("RM 12.50");
		expect(rewardMinimumSpendLabel(0)).toBe("None");
		expect(rewardMinimumSpendLabel(undefined)).toBe("None");
	});
});

describe("rewardUsesPerCustomerLabel", () => {
	it("says once, a number of times, or no limit", () => {
		expect(rewardUsesPerCustomerLabel(1)).toBe("Once");
		expect(rewardUsesPerCustomerLabel(3)).toBe("3 times");
		expect(rewardUsesPerCustomerLabel(undefined)).toBe("No limit");
	});
});

describe("rewardReferralsLabel", () => {
	it("says off, on, or on with what is left of the referral pool", () => {
		expect(rewardReferralsLabel({ referralsEnabled: false, referralPoolTotal: 50, referralPoolRemaining: 50 })).toBe("Off");
		expect(rewardReferralsLabel({ referralsEnabled: true, referralPoolTotal: null, referralPoolRemaining: null })).toBe("On");
		expect(rewardReferralsLabel({ referralsEnabled: true, referralPoolTotal: 1000, referralPoolRemaining: 40 })).toBe("On, 40 of 1,000 referral rewards left");
	});
});

describe("rewardQuantityLabel", () => {
	it("says how many are left of the total", () => {
		expect(rewardQuantityLabel(8, 1200)).toBe("8 of 1,200 left");
	});
});
