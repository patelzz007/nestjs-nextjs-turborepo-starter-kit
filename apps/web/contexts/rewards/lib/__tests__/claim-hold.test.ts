import { describe, expect, it } from "vitest";

import { formatHoldTime, holdSecondsLeft, showsClaimFlow } from "../claim-hold";

describe("holdSecondsLeft", () => {
	it("rounds up so the clock shows 0:00 only when the hold has ended", () => {
		expect(holdSecondsLeft(10_500, 10_000)).toBe(1);
		expect(holdSecondsLeft(10_000, 10_000)).toBe(0);
	});

	it("never goes below zero", () => {
		expect(holdSecondsLeft(10_000, 20_000)).toBe(0);
	});
});

describe("formatHoldTime", () => {
	it("pads the seconds", () => {
		expect(formatHoldTime(245)).toBe("4:05");
		expect(formatHoldTime(0)).toBe("0:00");
	});
});

describe("showsClaimFlow", () => {
	it("keeps the flow open for the customer holding the last unit, and closed for everyone else", () => {
		expect(showsClaimFlow(false, true)).toBe(true);
		expect(showsClaimFlow(false, false)).toBe(false);
		expect(showsClaimFlow(true, false)).toBe(true);
	});
});
