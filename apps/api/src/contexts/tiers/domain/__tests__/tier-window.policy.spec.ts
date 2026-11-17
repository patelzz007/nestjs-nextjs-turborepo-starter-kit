import { DEFAULT_TIER_RULES, epochMs, MS_PER_DAY, type EpochMs, type TierRules } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { countedAt, dropOffsAfter, firstMomentBelow, merchantCountsAt, tierAt, windowMs, type CountedRedemption } from "../policies/tier-window.policy";

const START = 1_800_000_000_000;
const CAFE = "0193f2c4-0000-7000-8000-00000000c001";
const BAKERY = "0193f2c4-0000-7000-8000-00000000c002";
const SALON = "0193f2c4-0000-7000-8000-00000000c003";
const RULES: TierRules = DEFAULT_TIER_RULES;

function day(offset: number): EpochMs {
	return epochMs(START + offset * MS_PER_DAY);
}

function redeemed(tenantId: string, count: number, onDay: number): CountedRedemption[] {
	return Array.from({ length: count }, (): CountedRedemption => ({ tenantId, redeemedAt: day(onDay) }));
}

describe("counted redemptions", () => {
	it("counts at most perMerchantCap from one merchant, and every merchant's up to it", () => {
		const redemptions = [...redeemed(CAFE, 25, 0), ...redeemed(BAKERY, 3, 0)];
		expect(countedAt(redemptions, day(1), RULES)).toBe(23);
		expect(tierAt(redemptions, day(1), RULES)).toBe("SILVER");
	});

	it("needs three merchants for Diamond under the defaults: one store reaches Silver at most", () => {
		expect(tierAt(redeemed(CAFE, 100, 0), day(1), RULES)).toBe("SILVER");
		expect(tierAt([...redeemed(CAFE, 20, 0), ...redeemed(BAKERY, 20, 0)], day(1), RULES)).toBe("GOLD");
		expect(tierAt([...redeemed(CAFE, 20, 0), ...redeemed(BAKERY, 20, 0), ...redeemed(SALON, 10, 0)], day(1), RULES)).toBe("DIAMOND");
	});

	it("keeps a redemption in the window until a full window has passed, then lets it go", () => {
		const redemptions = redeemed(CAFE, 1, 0);
		expect(countedAt(redemptions, day(0), RULES)).toBe(1);
		expect(countedAt(redemptions, epochMs(day(0) + windowMs(RULES) - 1), RULES)).toBe(1);
		expect(countedAt(redemptions, epochMs(day(0) + windowMs(RULES)), RULES)).toBe(0);
	});

	it("ignores a redemption after the moment asked about", () => {
		expect(countedAt(redeemed(CAFE, 3, 5), day(4), RULES)).toBe(0);
	});
});

describe("merchantCountsAt", () => {
	it("lists each merchant's counted redemptions and how many more still count, most counted first", () => {
		const redemptions = [...redeemed(BAKERY, 4, 0), ...redeemed(CAFE, 30, 0)];
		expect(merchantCountsAt(redemptions, day(1), RULES)).toStrictEqual([
			{ tenantId: CAFE, counted: 20, remainingUnderCap: 0 },
			{ tenantId: BAKERY, counted: 4, remainingUnderCap: 16 },
		]);
	});
});

describe("firstMomentBelow", () => {
	it("finds when the redemptions holding a tier leave the window", () => {
		const redemptions = [...redeemed(CAFE, 9, 0), ...redeemed(BAKERY, 1, 10)];
		expect(firstMomentBelow(redemptions, "SILVER", day(20), RULES)).toBe(epochMs(day(0) + windowMs(RULES)));
	});

	it("answers the starting moment when the tier is already lost, and null for Bronze", () => {
		expect(firstMomentBelow(redeemed(CAFE, 3, 0), "SILVER", day(1), RULES)).toBe(day(1));
		expect(firstMomentBelow([], "BRONZE", day(1), RULES)).toBeNull();
	});

	it("looks past capped redemptions whose leaving does not change the count", () => {
		const redemptions = [...redeemed(CAFE, 5, 0), ...redeemed(CAFE, 20, 30)];
		expect(firstMomentBelow(redemptions, "SILVER", day(40), RULES)).toBe(epochMs(day(30) + windowMs(RULES)));
	});
});

describe("dropOffsAfter", () => {
	it("gives each moment the count drops, with how much, soonest first", () => {
		const redemptions = [...redeemed(CAFE, 2, 0), ...redeemed(BAKERY, 1, 3)];
		expect(dropOffsAfter(redemptions, day(10), RULES)).toStrictEqual([
			{ at: epochMs(day(0) + windowMs(RULES)), count: 2 },
			{ at: epochMs(day(3) + windowMs(RULES)), count: 1 },
		]);
	});

	it("leaves out a moment whose leaving redemption was over the cap", () => {
		const shortCap: TierRules = { ...RULES, perMerchantCap: 1 };
		const redemptions = [...redeemed(CAFE, 1, 0), ...redeemed(CAFE, 1, 5)];
		expect(dropOffsAfter(redemptions, day(10), shortCap)).toStrictEqual([{ at: epochMs(day(5) + windowMs(shortCap)), count: 1 }]);
	});
});
