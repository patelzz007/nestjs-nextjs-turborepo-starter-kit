import type { RewardResponse, RewardStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	describeRewardStock,
	describeRewardStores,
	formatRewardEnd,
	formatRewardOffer,
	groupRewardsByStatus,
	isRewardEnded,
	LOW_STOCK_SHARE,
	REWARD_STATUS_GROUPS,
	shortStoreName,
} from "@/lib/rewards/presentation";
import { rewardFixture } from "@/test/rewards";

describe("groupRewardsByStatus", () => {
	it("orders sections live, in review, drafts, ended — and leaves out empty ones", () => {
		const rewards = [
			rewardFixture({ title: "Draft", status: "DRAFT" }),
			rewardFixture({ title: "Expired", status: "EXPIRED" }),
			rewardFixture({ title: "Live A", status: "PUBLISHED" }),
			rewardFixture({ title: "Disabled", status: "DISABLED" }),
			rewardFixture({ title: "Live B", status: "PUBLISHED" }),
		];

		const groups = groupRewardsByStatus(rewards);

		expect(groups.map((group) => group.id)).toEqual(["live", "drafts", "ended"]);
		expect(groups.map((group) => group.rewards.map((reward) => reward.title))).toEqual([["Live A", "Live B"], ["Draft"], ["Expired", "Disabled"]]);
	});

	it("puts every status in exactly one section, each with a title and tone", () => {
		const statuses: readonly RewardStatus[] = ["PUBLISHED", "PENDING_REVIEW", "DRAFT", "EXPIRED", "DISABLED"];
		const groups = groupRewardsByStatus(statuses.map((status) => rewardFixture({ status })));

		expect(groups.flatMap((group) => group.rewards)).toHaveLength(statuses.length);
		expect(REWARD_STATUS_GROUPS.map((group) => group.title)).toEqual(["Live", "In review", "Drafts", "Ended"]);
		expect(groupRewardsByStatus([])).toEqual([]);
	});

	it("treats expired and disabled rewards as ended", () => {
		expect(isRewardEnded("EXPIRED")).toBe(true);
		expect(isRewardEnded("DISABLED")).toBe(true);
		expect(isRewardEnded("PUBLISHED")).toBe(false);
		expect(isRewardEnded("DRAFT")).toBe(false);
	});
});

describe("formatRewardOffer", () => {
	it("says what the customer gets", () => {
		expect(formatRewardOffer("DISCOUNT", 10)).toBe("10% off");
		// Intl separates the currency symbol with a no-break space, so the amount never wraps away from it.
		expect(formatRewardOffer("CASHBACK", 15)).toBe("RM\u00a015 cashback");
		expect(formatRewardOffer("POINTS", 1500)).toBe("1,500 bonus points");
		expect(formatRewardOffer("BOGO", 1)).toBe("Buy one, get one");
	});

	it("reads one free item (or an unset quantity) as 'Free item' and counts several", () => {
		expect(formatRewardOffer("FREE_ITEM", 0)).toBe("Free item");
		expect(formatRewardOffer("FREE_ITEM", 1)).toBe("Free item");
		expect(formatRewardOffer("FREE_ITEM", 3)).toBe("3 free items");
	});
});

describe("store names", () => {
	it("drops the business name in front of a branch name", () => {
		expect(shortStoreName("Jonker Street Kitchen — Bukit Katil", "Jonker Street Kitchen")).toBe("Bukit Katil");
		expect(shortStoreName("Jonker Street Kitchen - Bukit Beruang", "Jonker Street Kitchen")).toBe("Bukit Beruang");
	});

	it("keeps names that do not start with the business name, or would be left empty", () => {
		expect(shortStoreName("Bukit Katil kiosk", "Jonker Street Kitchen")).toBe("Bukit Katil kiosk");
		expect(shortStoreName("Jonker Street Kitchen", "Jonker Street Kitchen")).toBe("Jonker Street Kitchen");
		expect(shortStoreName("Jonker Street Kitchen — Bukit Katil", undefined)).toBe("Jonker Street Kitchen — Bukit Katil");
	});

	it("describes where a reward can be redeemed", () => {
		expect(describeRewardStores(rewardFixture({ locationScopeType: "ALL_LOCATIONS" }))).toEqual({ label: "All stores", fullLabel: "All stores" });
		expect(describeRewardStores(rewardFixture({ locationNames: ["Jonker Street Kitchen — Bukit Katil", "Jonker Street Kitchen — Bukit Beruang"] }))).toEqual({
			label: "Bukit Katil, Bukit Beruang",
			fullLabel: "Jonker Street Kitchen — Bukit Katil, Jonker Street Kitchen — Bukit Beruang",
		});
	});

	it("counts stores when their names are not known", () => {
		const unnamed: Partial<RewardResponse> = { locationNames: undefined, locationScopeType: "SELECTED" };
		expect(describeRewardStores(rewardFixture({ ...unnamed, locationIds: ["5d2f6a1b-0c3e-4f7a-9b8c-2d1e0f3a4b5c"] })).label).toBe("1 store");
		expect(describeRewardStores(rewardFixture({ ...unnamed, locationIds: ["5d2f6a1b-0c3e-4f7a-9b8c-2d1e0f3a4b5c", "6e3a7b2c-1d4f-4a8b-8c9d-3e2f1a4b5c6d"] })).label).toBe(
			"2 stores",
		);
	});
});

describe("describeRewardStock", () => {
	it("reports what is left and how full the bar is", () => {
		expect(describeRewardStock(28, 35)).toEqual({ level: "plenty", percentLeft: 80, label: "28 of 35 left" });
	});

	it("runs low at or below the low-stock share", () => {
		const total = 100;
		expect(describeRewardStock(total * LOW_STOCK_SHARE, total).level).toBe("low");
		expect(describeRewardStock(total * LOW_STOCK_SHARE + 1, total).level).toBe("plenty");
	});

	it("is sold out with nothing left, or nothing to give", () => {
		expect(describeRewardStock(0, 50)).toEqual({ level: "out", percentLeft: 0, label: "Sold out" });
		expect(describeRewardStock(5, 0).level).toBe("out");
	});

	it("never fills the bar past full", () => {
		expect(describeRewardStock(40, 35).percentLeft).toBe(100);
	});
});

describe("formatRewardEnd", () => {
	it("says when a reward ends, and that an expired one has ended", () => {
		const reward = rewardFixture();
		expect(formatRewardEnd(reward)).toBe("Ends 14 Nov 2026");
		expect(formatRewardEnd({ ...reward, status: "EXPIRED" })).toBe("Ended 14 Nov 2026");
	});
});
