import { ReduceMotion } from "react-native-reanimated";

import { PANEL_SPRING, PULSE, SCAN_LINE_MOTION, SCANNER_SHEET_MOTION, SELECTION_SPRING } from "../motion";

describe("SELECTION_SPRING", () => {
	it("follows the OS Reduce Motion setting", () => {
		expect(SELECTION_SPRING.reduceMotion).toBe(ReduceMotion.System);
	});

	it("never overshoots, so layout driven by it moves in one direction only", () => {
		expect(SELECTION_SPRING.dampingRatio).toBe(1);
		expect(SELECTION_SPRING.overshootClamping).toBe(true);
	});

	it("is quick enough to feel direct", () => {
		expect(SELECTION_SPRING.duration).toBeLessThanOrEqual(400);
	});
});

describe("PANEL_SPRING", () => {
	it("follows Reduce Motion and never bounces past the edge", () => {
		expect(PANEL_SPRING.reduceMotion).toBe(ReduceMotion.System);
		expect(PANEL_SPRING.dampingRatio).toBe(1);
		expect(PANEL_SPRING.overshootClamping).toBe(true);
	});
});

describe("PULSE", () => {
	it("matches Tailwind's animate-pulse on the web: a 2 s cycle down to half opacity", () => {
		expect(PULSE.cycleMs).toBe(2000);
		expect(PULSE.minOpacity).toBe(0.5);
	});

	it("eases like cubic-bezier(0.4, 0, 0.6, 1): slow at both ends, symmetric", () => {
		expect(PULSE.easing(0)).toBeCloseTo(0);
		expect(PULSE.easing(1)).toBeCloseTo(1);
		expect(PULSE.easing(0.5)).toBeCloseTo(0.5);
		expect(PULSE.easing(0.1)).toBeLessThan(0.1);
	});
});

describe("SCANNER_SHEET_MOTION", () => {
	it("follows Reduce Motion, and leaves quicker than it arrives", () => {
		expect(SCANNER_SHEET_MOTION.enter.reduceMotion).toBe(ReduceMotion.System);
		expect(SCANNER_SHEET_MOTION.exit.reduceMotion).toBe(ReduceMotion.System);
		expect(SCANNER_SHEET_MOTION.exit.duration).toBeLessThan(SCANNER_SHEET_MOTION.enter.duration);
	});

	it("accelerates away when leaving: slow off the mark, fast at the end", () => {
		expect(SCANNER_SHEET_MOTION.exit.easing(0.5)).toBeLessThan(0.5);
	});
});

describe("SCAN_LINE_MOTION", () => {
	it("follows Reduce Motion and eases symmetrically at both edges of the window", () => {
		expect(SCAN_LINE_MOTION.reduceMotion).toBe(ReduceMotion.System);
		expect(SCAN_LINE_MOTION.easing(0.5)).toBeCloseTo(0.5);
		expect(SCAN_LINE_MOTION.easing(0.1)).toBeLessThan(0.1);
	});
});
