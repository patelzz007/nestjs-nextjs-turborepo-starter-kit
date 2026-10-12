import { SKELETON_MOTION } from "@workspace/tokens";

import { sweepBandLeft, sweepBandWidth, sweepSheen } from "./skeleton-sweep";

/** A phone-sized window, in points. */
const WINDOW_WIDTH = 400;

describe("sweepBandLeft", () => {
	it("starts the pass with the band fully off the left edge", () => {
		expect(sweepBandLeft(0, WINDOW_WIDTH)).toBe(SKELETON_MOTION.bandStartViewport * WINDOW_WIDTH);
		expect(sweepBandLeft(0, WINDOW_WIDTH) + sweepBandWidth(WINDOW_WIDTH)).toBeLessThanOrEqual(0);
	});

	it("ends the pass off the right edge", () => {
		expect(sweepBandLeft(1, WINDOW_WIDTH)).toBeCloseTo(SKELETON_MOTION.bandEndViewport * WINDOW_WIDTH);
	});

	it("is halfway across the band's journey halfway through the pass", () => {
		const halfway = ((SKELETON_MOTION.bandStartViewport + SKELETON_MOTION.bandEndViewport) / 2) * WINDOW_WIDTH;

		expect(sweepBandLeft(0.5, WINDOW_WIDTH)).toBeCloseTo(halfway);
	});
});

describe("sweepBandWidth", () => {
	it("is bandWidthViewport of the window", () => {
		expect(sweepBandWidth(WINDOW_WIDTH)).toBe(SKELETON_MOTION.bandWidthViewport * WINDOW_WIDTH);
	});
});

describe("sweepSheen", () => {
	it("lifts toward the card in light and the foreground in dark, as on the web", () => {
		expect(sweepSheen("light")).toStrictEqual(SKELETON_MOTION.sheen.light);
		expect(sweepSheen("dark")).toStrictEqual(SKELETON_MOTION.sheen.dark);
	});
});
