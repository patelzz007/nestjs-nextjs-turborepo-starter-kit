import { describe, expect, it } from "vitest";

import { dampingRatioOf, SIDEBAR_SPRING } from "../motion";

describe("SIDEBAR_SPRING", () => {
	it("is critically damped or more, so the sidebar never overshoots and wobbles back", () => {
		expect(dampingRatioOf(SIDEBAR_SPRING)).toBeGreaterThanOrEqual(1);
	});

	it("measures the damping ratio of a spring", () => {
		expect(dampingRatioOf({ type: "spring", stiffness: 100, damping: 20, mass: 1 })).toBe(1);
		expect(dampingRatioOf({ type: "spring", stiffness: 100, damping: 10, mass: 1 })).toBe(0.5);
	});
});
