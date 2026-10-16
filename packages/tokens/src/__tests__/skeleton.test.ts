import { describe, expect, it } from "vitest";

import { CubicBezierSchema, ThemeNameSchema, ThemeRoleSchema } from "./schema";
import { SKELETON_MOTION } from "./skeleton";

describe("SKELETON_MOTION", () => {
	it("travels for part of the cycle and rests for the rest", () => {
		expect(SKELETON_MOTION.travelFraction).toBeGreaterThan(0);
		expect(SKELETON_MOTION.travelFraction).toBeLessThan(1);
	});

	it("starts the band fully off the left edge and ends it fully off the right", () => {
		expect(SKELETON_MOTION.bandStartViewport + SKELETON_MOTION.bandWidthViewport).toBeLessThanOrEqual(0);
		expect(SKELETON_MOTION.bandEndViewport).toBeGreaterThanOrEqual(1);
	});

	it("has a valid easing curve", () => {
		expect(CubicBezierSchema.safeParse(SKELETON_MOTION.sweepEasing).success).toBe(true);
	});

	it.each(ThemeNameSchema.options)("gives the %s theme a sheen from a real role at a 0–1 opacity", (theme) => {
		const sheen = SKELETON_MOTION.sheen[theme];

		expect(ThemeRoleSchema.options).toContain(sheen.role);
		expect(sheen.opacity).toBeGreaterThan(0);
		expect(sheen.opacity).toBeLessThanOrEqual(1);
	});
});
