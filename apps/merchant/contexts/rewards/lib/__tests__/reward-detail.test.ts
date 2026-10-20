import { epochMs, RewardStatusSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { describeRewardStatusNote, formatClaimLimitCount, formatRewardClaimLimit, formatRewardMinimumSpend, formatRewardRunDates } from "@/contexts/rewards/lib/reward-detail";
import { REWARD_FIXTURE_EXPIRY_MS } from "@/test/rewards";

/** 1 Nov 2026, 00:00 UTC. */
const START_MS = 1_793_491_200_000;

describe("describeRewardStatusNote", () => {
	it.each(RewardStatusSchema.options)("explains what %s means in one sentence", (status) => {
		const note = describeRewardStatusNote(status);

		expect(note.length).toBeGreaterThan(0);
		expect(note.endsWith(".")).toBe(true);
	});

	it("tells the merchant a draft is private until submitted", () => {
		expect(describeRewardStatusNote("DRAFT")).toContain("Only your team can see this draft");
	});
});

describe("formatRewardRunDates", () => {
	it("gives the start and end of a scheduled reward", () => {
		expect(formatRewardRunDates({ startDate: epochMs(START_MS), expiryDate: epochMs(REWARD_FIXTURE_EXPIRY_MS) })).toBe("1 Nov 2026 – 14 Nov 2026");
	});

	it("gives only the end of a reward that starts when it goes live", () => {
		expect(formatRewardRunDates({ startDate: null, expiryDate: epochMs(REWARD_FIXTURE_EXPIRY_MS) })).toBe("Until 14 Nov 2026");
	});
});

describe("claim limits", () => {
	it("words one claim as once and more as a ceiling", () => {
		expect(formatClaimLimitCount(1)).toBe("Once");
		expect(formatClaimLimitCount(3)).toBe("Up to 3 times");
	});

	it("reads the reward's rule, or no limit without one", () => {
		expect(formatRewardClaimLimit({ maxUsePerUser: 5 })).toBe("Up to 5 times");
		expect(formatRewardClaimLimit({})).toBe("No limit");
		expect(formatRewardClaimLimit(null)).toBe("No limit");
	});
});

describe("formatRewardMinimumSpend", () => {
	it("shows the minimum spend in ringgit", () => {
		expect(formatRewardMinimumSpend({ minSpendMyr: 30 })).toMatch(/^RM\s?30\.00$/u);
	});

	it("says none when the reward needs no spend", () => {
		expect(formatRewardMinimumSpend({ maxUsePerUser: 1 })).toBe("None");
		expect(formatRewardMinimumSpend(null)).toBe("None");
	});
});
