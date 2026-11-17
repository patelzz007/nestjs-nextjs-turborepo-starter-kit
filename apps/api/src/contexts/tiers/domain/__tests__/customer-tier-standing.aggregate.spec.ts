import { DEFAULT_TIER_RULES, epochMs, MS_PER_DAY, type EpochMs, type TierRules } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { CustomerTierStanding, type CustomerTierStandingState, type DemotionWarning } from "../aggregates/customer-tier-standing.aggregate";
import { CustomerTierDemoted, CustomerTierDemotionWarned, CustomerTierPromoted } from "../events/tier.events";
import { windowMs, type CountedRedemption } from "../policies/tier-window.policy";

const START = 1_800_000_000_000;
const USER = "0193f2c4-0000-7000-8000-0000000000a1";
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

/** The day the redemptions made on `onDay` leave the window. */
function leaves(onDay: number): EpochMs {
	return epochMs(day(onDay) + windowMs(RULES));
}

function standing(state: Partial<CustomerTierStandingState>): CustomerTierStanding {
	return CustomerTierStanding.rehydrate({
		userId: USER,
		tier: "BRONZE",
		countedRedemptions: 0,
		promotedAt: null,
		holdUntil: null,
		warning: null,
		evaluatedAt: day(0),
		...state,
	});
}

describe("promotion", () => {
	it("promotes a new customer the moment their redemptions reach Silver, with a 90-day hold", () => {
		const customer = CustomerTierStanding.fresh(USER);
		customer.afterRedemption(redeemed(CAFE, 10, 0), RULES, day(0));

		expect(customer.snapshot()).toMatchObject({ tier: "SILVER", countedRedemptions: 10, promotedAt: day(0), holdUntil: day(90), warning: null, evaluatedAt: day(0) });
		expect(customer.changes()).toStrictEqual([{ fromTier: "BRONZE", toTier: "SILVER", reason: "PROMOTION", countedRedemptions: 10, occurredAt: day(0) }]);
		expect(customer.pullEvents()).toStrictEqual([new CustomerTierPromoted(day(0), USER, "BRONZE", "SILVER", day(90))]);
	});

	it("jumps straight to the highest tier reached, as one change", () => {
		const customer = CustomerTierStanding.fresh(USER);
		customer.afterRedemption([...redeemed(CAFE, 20, 0), ...redeemed(BAKERY, 6, 0)], RULES, day(0));

		expect(customer.snapshot().tier).toBe("GOLD");
		expect(customer.changes()).toHaveLength(1);
	});

	it("counts no more than 20 from one merchant, so one store alone reaches Silver at most", () => {
		const customer = CustomerTierStanding.fresh(USER);
		customer.afterRedemption(redeemed(CAFE, 40, 0), RULES, day(0));

		expect(customer.snapshot()).toMatchObject({ tier: "SILVER", countedRedemptions: 20 });
	});

	it("starts a fresh hold when a customer reaches a higher tier during a hold", () => {
		const customer = standing({ tier: "SILVER", promotedAt: day(0), holdUntil: day(90) });
		customer.afterRedemption([...redeemed(CAFE, 20, 0), ...redeemed(BAKERY, 5, 30)], RULES, day(30));

		expect(customer.snapshot()).toMatchObject({ tier: "GOLD", promotedAt: day(30), holdUntil: day(120) });
	});

	it("does nothing when the customer stays at their tier", () => {
		const customer = standing({ tier: "SILVER", holdUntil: day(90) });
		customer.afterRedemption(redeemed(CAFE, 12, 0), RULES, day(1));

		expect(customer.snapshot()).toMatchObject({ tier: "SILVER", countedRedemptions: 12, evaluatedAt: day(1) });
		expect(customer.changes()).toStrictEqual([]);
		expect(customer.pullEvents()).toStrictEqual([]);
	});

	it("is also caught by the nightly review when the redemption's own evaluation was missed", () => {
		const customer = CustomerTierStanding.fresh(USER);
		customer.review(redeemed(CAFE, 10, 0), RULES, day(1));

		expect(customer.snapshot()).toMatchObject({ tier: "SILVER", holdUntil: day(91) });
	});
});

describe("demotion warning", () => {
	it("never warns or demotes just after a redemption: that waits for the nightly review", () => {
		const customer = standing({ tier: "GOLD", holdUntil: day(0) });
		customer.afterRedemption(redeemed(CAFE, 1, 200), RULES, day(200));

		expect(customer.snapshot()).toMatchObject({ tier: "GOLD", warning: null });
		expect(customer.pullEvents()).toStrictEqual([]);
	});

	it("waits while the demotion is more than 14 days away, even past the hold", () => {
		const customer = standing({ tier: "SILVER", holdUntil: day(90) });
		customer.review(redeemed(CAFE, 10, 0), RULES, day(100));

		expect(customer.snapshot().warning).toBeNull();
	});

	it("warns 14 days before the redemptions holding the tier leave the window", () => {
		const customer = standing({ tier: "SILVER", holdUntil: day(90) });
		const redemptions = redeemed(CAFE, 10, 0);
		const night = epochMs(leaves(0) - 14 * MS_PER_DAY);
		customer.review(redemptions, RULES, night);

		const due = epochMs(night + 14 * MS_PER_DAY);
		expect(customer.snapshot().warning).toStrictEqual({ toTier: "BRONZE", dueAt: due, warnedAt: night });
		expect(customer.pullEvents()).toStrictEqual([new CustomerTierDemotionWarned(night, USER, "SILVER", "BRONZE", due, 10)]);
	});

	it("warns 14 days before the tier hold ends when the customer has already fallen short", () => {
		const customer = standing({ tier: "GOLD", promotedAt: day(0), holdUntil: day(90) });
		const redemptions = [...redeemed(CAFE, 12, 50)];

		customer.review(redemptions, RULES, day(60));
		expect(customer.snapshot().warning).toBeNull();

		customer.review(redemptions, RULES, day(76));
		expect(customer.snapshot().warning).toStrictEqual({ toTier: "SILVER", dueAt: day(90), warnedAt: day(76) });
	});

	it("gives the full 14 days when the rules change and the customer is short at once", () => {
		const customer = standing({ tier: "GOLD", holdUntil: day(10) });
		const raised: TierRules = { ...RULES, goldThreshold: 40, diamondThreshold: 60 };

		customer.review([...redeemed(CAFE, 20, 0), ...redeemed(BAKERY, 10, 0)], raised, day(20));

		expect(customer.snapshot()).toMatchObject({ tier: "GOLD", warning: { toTier: "SILVER", dueAt: day(34) } });
	});

	it("never warns a Bronze customer", () => {
		const customer = standing({ tier: "BRONZE" });
		customer.review([], RULES, day(500));

		expect(customer.snapshot().warning).toBeNull();
	});

	it("withdraws the warning as soon as redemptions keep the customer's tier", () => {
		const customer = standing({ tier: "SILVER", holdUntil: day(90), warning: { toTier: "BRONZE", dueAt: day(375), warnedAt: day(361) } });
		customer.afterRedemption([...redeemed(CAFE, 10, 10), ...redeemed(BAKERY, 10, 365)], RULES, day(365));

		expect(customer.snapshot().warning).toBeNull();
		expect(customer.snapshot().tier).toBe("SILVER");
	});

	it("keeps the warning when a redemption is not enough to keep the tier", () => {
		const warning: DemotionWarning = { toTier: "BRONZE", dueAt: day(375), warnedAt: day(361) };
		const customer = standing({ tier: "SILVER", holdUntil: day(90), warning });
		customer.afterRedemption([...redeemed(CAFE, 10, 10), ...redeemed(BAKERY, 1, 365)], RULES, day(365));

		expect(customer.snapshot().warning).toStrictEqual(warning);
	});

	it("keeps a warning that is still needed until it falls due", () => {
		const warning: DemotionWarning = { toTier: "BRONZE", dueAt: day(375), warnedAt: day(361) };
		const customer = standing({ tier: "SILVER", holdUntil: day(90), warning });
		customer.review(redeemed(CAFE, 10, 10), RULES, day(366));

		expect(customer.snapshot().warning).toStrictEqual(warning);
		expect(customer.pullEvents()).toStrictEqual([]);
	});
});

describe("demotion", () => {
	it("drops straight to the tier earned when the warning falls due: Diamond to Silver in one step", () => {
		const customer = standing({ tier: "DIAMOND", holdUntil: day(90), warning: { toTier: "GOLD", dueAt: day(400), warnedAt: day(386) } });
		customer.review([...redeemed(CAFE, 12, 200)], RULES, day(400));

		expect(customer.snapshot()).toMatchObject({ tier: "SILVER", warning: null, holdUntil: day(90) });
		expect(customer.changes()).toStrictEqual([{ fromTier: "DIAMOND", toTier: "SILVER", reason: "DEMOTION", countedRedemptions: 12, occurredAt: day(400) }]);
		expect(customer.pullEvents()).toStrictEqual([new CustomerTierDemoted(day(400), USER, "DIAMOND", "SILVER")]);
	});

	it("keeps the tier when the customer earned it back by the time the warning fell due", () => {
		const customer = standing({ tier: "SILVER", holdUntil: day(90), warning: { toTier: "BRONZE", dueAt: day(400), warnedAt: day(386) } });
		customer.review(redeemed(SALON, 10, 399), RULES, day(400));

		expect(customer.snapshot()).toMatchObject({ tier: "SILVER", warning: null });
		expect(customer.changes()).toStrictEqual([]);
	});

	it("never demotes inside a tier hold", () => {
		const customer = standing({ tier: "GOLD", holdUntil: day(100), warning: { toTier: "SILVER", dueAt: day(95), warnedAt: day(81) } });
		customer.review(redeemed(CAFE, 12, 50), RULES, day(96));

		expect(customer.snapshot().tier).toBe("GOLD");
	});

	it("never demotes without a warning first", () => {
		const customer = standing({ tier: "GOLD", holdUntil: day(0) });
		customer.review([], RULES, day(500));

		expect(customer.snapshot().tier).toBe("GOLD");
		expect(customer.snapshot().warning).not.toBeNull();
	});
});
