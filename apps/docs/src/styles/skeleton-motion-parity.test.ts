import { readFileSync } from "node:fs";

import { SKELETON_MOTION } from "@workspace/tokens";
import { describe, expect, it } from "vitest";

/**
 * The docs site repeats the apps' skeleton sweep in its own stylesheet (it
 * doesn't load the UI kit's CSS). This keeps its timing and travel on
 * SKELETON_MOTION, the token the web kit and the mobile app share.
 */
const CSS = readFileSync(new URL("./global.css", import.meta.url), "utf8");

const PERCENT = 100;
const MS_PER_SECOND = 1000;
/** The gradient image is this many band-widths wide, with the band starting two band-widths in (its middle fifth). */
const IMAGE_BAND_WIDTHS = 5;
const BAND_OFFSET_BAND_WIDTHS = 2;

function vw(viewportFraction: number): string {
	return `${String(Math.round(viewportFraction * PERCENT))}vw`;
}

describe("docs skeleton sweep matches SKELETON_MOTION", () => {
	const bandOffset = SKELETON_MOTION.bandWidthViewport * BAND_OFFSET_BAND_WIDTHS;

	it("runs one cycle in sweepCycleMs", () => {
		expect(CSS).toContain(`--skeleton-sweep-duration: ${String(SKELETON_MOTION.sweepCycleMs / MS_PER_SECOND)}s;`);
		expect(CSS).toContain("animation: skeleton-sweep var(--skeleton-sweep-duration) ease-in-out infinite;");
	});

	it("travels for travelFraction of the cycle between the band's start and end", () => {
		expect(CSS).toContain(`background-position-x: ${vw(SKELETON_MOTION.bandStartViewport - bandOffset)};`);
		expect(CSS).toContain(`background-position-x: ${vw(SKELETON_MOTION.bandEndViewport - bandOffset)};`);
		expect(CSS).toMatch(new RegExp(`${String(Math.round(SKELETON_MOTION.travelFraction * PERCENT))}%,\\s*to \\{`));
	});

	it("draws a band bandWidthViewport wide", () => {
		expect(CSS).toContain(`background-size: ${vw(SKELETON_MOTION.bandWidthViewport * IMAGE_BAND_WIDTHS)} 100%;`);
	});
});
