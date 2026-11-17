import { describe, expect, it } from "vitest";

import { hasTierMark, isRewardLockedFor, viewerTierOf } from "../reward-tier-lock";

const GOLD_REWARD = { minimumTier: "GOLD" } satisfies { minimumTier: "GOLD" };
const OPEN_REWARD = { minimumTier: "BRONZE" } satisfies { minimumTier: "BRONZE" };

describe("viewerTierOf", () => {
	it("is the viewer's tier while tiers are on, and nothing while they are off or unknown", () => {
		expect(viewerTierOf({ enabled: true, viewerTier: "SILVER" })).toBe("SILVER");
		expect(viewerTierOf({ enabled: false })).toBeNull();
		expect(viewerTierOf(undefined)).toBeNull();
	});
});

describe("isRewardLockedFor", () => {
	it("locks a reward above the viewer's tier, and only then", () => {
		expect(isRewardLockedFor(GOLD_REWARD, "SILVER")).toBe(true);
		expect(isRewardLockedFor(GOLD_REWARD, "GOLD")).toBe(false);
		expect(isRewardLockedFor(GOLD_REWARD, "DIAMOND")).toBe(false);
		expect(isRewardLockedFor(OPEN_REWARD, "BRONZE")).toBe(false);
	});

	it("never locks while tiers are off", () => {
		expect(isRewardLockedFor(GOLD_REWARD, null)).toBe(false);
	});
});

describe("hasTierMark", () => {
	it("marks rewards above the entry tier while tiers are on", () => {
		expect(hasTierMark(GOLD_REWARD, "DIAMOND")).toBe(true);
		expect(hasTierMark(OPEN_REWARD, "BRONZE")).toBe(false);
		expect(hasTierMark(GOLD_REWARD, null)).toBe(false);
	});
});
