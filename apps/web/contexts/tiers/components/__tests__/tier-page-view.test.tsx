// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { DEFAULT_TIER_RULES, epochMs, MyTierSchema, type MyTier } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { nextTierLine, TierPageView, tierProgressPercent } from "@/contexts/tiers/components/tier-page-view";

const NOW = 1_800_000_000_000;
const DAY_MS = 86_400_000;
const CAFE = "0193f2c4-0000-7000-8000-00000000c001";

function buildPage(overrides: Partial<MyTier> = {}): MyTier {
	return MyTierSchema.parse({
		tier: "SILVER",
		countedRedemptions: 16,
		nextTier: "GOLD",
		redemptionsToNextTier: 9,
		holdUntil: null,
		demotionWarning: null,
		merchants: [],
		upcomingDropOffs: [],
		history: [],
		rules: DEFAULT_TIER_RULES,
		...overrides,
	});
}

afterEach(() => {
	cleanup();
});

describe("tierProgressPercent", () => {
	it("is how far the count is from this tier's threshold to the next one's", () => {
		// Silver 10 → Gold 25: 16 is 6 of 15 → 40%.
		expect(tierProgressPercent(buildPage())).toBe(40);
		expect(tierProgressPercent(buildPage({ countedRedemptions: 10 }))).toBe(0);
	});

	it("stays within 0–100, and is full at the top tier", () => {
		expect(tierProgressPercent(buildPage({ countedRedemptions: 4 }))).toBe(0);
		expect(tierProgressPercent(buildPage({ countedRedemptions: 40 }))).toBe(100);
		expect(tierProgressPercent(buildPage({ tier: "DIAMOND", nextTier: null, redemptionsToNextTier: null }))).toBe(100);
	});
});

describe("nextTierLine", () => {
	it("counts the redemptions to the next tier, singular for one", () => {
		expect(nextTierLine({ nextTier: "GOLD", redemptionsToNextTier: 9 })).toBe("9 more redemptions to Gold");
		expect(nextTierLine({ nextTier: "GOLD", redemptionsToNextTier: 1 })).toBe("1 more redemption to Gold");
	});

	it("says the top tier is reached at Diamond", () => {
		expect(nextTierLine({ nextTier: null, redemptionsToNextTier: null })).toBe("You're at the top tier. Keep redeeming to stay there.");
	});
});

describe("TierPageView", () => {
	function renderPage(page: MyTier): void {
		render(<TierPageView page={page} />, { wrapper: UiKitTestProviders });
	}

	it("leads with the tier, the way to the next one and the rules in force", () => {
		renderPage(buildPage());

		expect(screen.getByRole("heading", { name: "My tier" })).toBeDefined();
		expect(screen.getByText("Silver")).toBeDefined();
		expect(screen.getByText("9 more redemptions to Gold")).toBeDefined();
		expect(screen.getByText("Your tier comes from the rewards you redeem in the last 365 days. Up to 20 from each merchant count.")).toBeDefined();
		expect(screen.getByText("Redeem a reward at any store to start counting.")).toBeDefined();
		expect(screen.getByText("Nothing leaves your window soon.")).toBeDefined();
		expect(screen.getByText("No changes yet")).toBeDefined();
	});

	it("shows a hold, a pending warning, each merchant's counts, what leaves soon and the history", () => {
		renderPage(
			buildPage({
				holdUntil: epochMs(NOW + DAY_MS),
				demotionWarning: { toTier: "BRONZE", dueAt: epochMs(NOW + 2 * DAY_MS), redemptionsToKeep: 1 },
				merchants: [{ tenantId: CAFE, tenantName: "Brew & Bean", counted: 16, remainingUnderCap: 4 }],
				upcomingDropOffs: [{ on: epochMs(NOW + 3 * DAY_MS), count: 2 }],
				history: [{ id: "0193f2c4-0000-7000-8000-0000000000d1", fromTier: "BRONZE", toTier: "SILVER", reason: "PROMOTION", countedRedemptions: 10, occurredAt: epochMs(NOW) }],
			}),
		);

		expect(screen.getByText(/Your Silver is yours until at least/)).toBeDefined();
		expect(screen.getByText(/Redeem 1 more reward before then to keep it/)).toBeDefined();
		const merchantRow = screen.getByRole("row", { name: /Brew & Bean/ });
		expect(within(merchantRow).getByText("16")).toBeDefined();
		expect(within(merchantRow).getByText("4")).toBeDefined();
		expect(screen.getByText("−2 redemptions")).toBeDefined();
		expect(screen.getByText("Moved up to Silver")).toBeDefined();
	});
});
