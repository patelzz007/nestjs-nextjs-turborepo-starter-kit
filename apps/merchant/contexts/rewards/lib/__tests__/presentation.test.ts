import type { RewardResponse, RewardStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	defaultRewardStatusGroupId,
	describeRewardStock,
	describeRewardStores,
	formatRewardEnd,
	groupStatusCounts,
	isRewardEnded,
	LOW_STOCK_SHARE,
	REWARD_STATUS_GROUPS,
	RewardStatusGroupIdSchema,
	shortStoreName,
	statusesOfGroup,
} from "@/contexts/rewards/lib/presentation";
import { rewardFixture } from "@/test/rewards";

/** Per-status counts as the catalog summary answers them (every status present). */
function counts(partial: Partial<Record<RewardStatus, number>>): Record<RewardStatus, number> {
	return { PUBLISHED: 0, PENDING_REVIEW: 0, DRAFT: 0, EXPIRED: 0, DISABLED: 0, ...partial };
}

describe("defaultRewardStatusGroupId", () => {
	it("opens on live rewards when there are any", () => {
		expect(defaultRewardStatusGroupId(groupStatusCounts(counts({ DRAFT: 1, PUBLISHED: 1 })))).toBe("live");
	});

	it("opens on the first group with rewards when nothing is live", () => {
		expect(defaultRewardStatusGroupId(groupStatusCounts(counts({ EXPIRED: 1, PENDING_REVIEW: 1 })))).toBe("review");
		expect(defaultRewardStatusGroupId(groupStatusCounts(counts({ DISABLED: 1 })))).toBe("ended");
	});

	it("opens on live for an empty catalog", () => {
		expect(defaultRewardStatusGroupId(groupStatusCounts(counts({})))).toBe("live");
	});
});

describe("groupStatusCounts / statusesOfGroup", () => {
	it("orders the groups live, in review, drafts, ended — keeping empty ones, since each is a tab — and sums each group's statuses", () => {
		const groups = groupStatusCounts(counts({ DRAFT: 1, EXPIRED: 1, PUBLISHED: 2, DISABLED: 1 }));

		expect(groups.map((group) => [group.id, group.count])).toEqual([
			["live", 2],
			["review", 0],
			["drafts", 1],
			["ended", 2],
		]);
	});

	it("puts every status in exactly one group, each with a title and tone", () => {
		const statuses: readonly RewardStatus[] = ["PUBLISHED", "PENDING_REVIEW", "DRAFT", "EXPIRED", "DISABLED"];

		expect(RewardStatusGroupIdSchema.options.flatMap((groupId) => statusesOfGroup(groupId)).sort()).toEqual([...statuses].sort());
		expect(statusesOfGroup("ended")).toEqual(["EXPIRED", "DISABLED"]);
		expect(REWARD_STATUS_GROUPS.map((group) => group.title)).toEqual(["Live", "In review", "Drafts", "Ended"]);
	});

	it("declares one URL value per group, in display order", () => {
		expect(REWARD_STATUS_GROUPS.map((group) => group.id)).toEqual(RewardStatusGroupIdSchema.options);
	});

	it("treats expired and disabled rewards as ended", () => {
		expect(isRewardEnded("EXPIRED")).toBe(true);
		expect(isRewardEnded("DISABLED")).toBe(true);
		expect(isRewardEnded("PUBLISHED")).toBe(false);
		expect(isRewardEnded("DRAFT")).toBe(false);
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
