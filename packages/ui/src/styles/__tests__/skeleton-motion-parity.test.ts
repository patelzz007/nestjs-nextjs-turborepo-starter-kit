// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SKELETON_MOTION } from "@workspace/tokens";
import { describe, expect, it } from "vitest";

/**
 * The web sweep (styles/components.css) and the mobile sweep both animate
 * SKELETON_MOTION. CSS can't import the token, so this test reads the
 * stylesheet and checks each number against it.
 */
const CSS = readFileSync(join(import.meta.dirname, "..", "components.css"), "utf8");

const PERCENT = 100;
const MS_PER_SECOND = 1000;
/** The gradient image is this many band-widths wide… */
const IMAGE_BAND_WIDTHS = 5;
/** …and the band begins this many band-widths into it (the image's middle fifth: 40%–60%). */
const BAND_OFFSET_BAND_WIDTHS = 2;

function percent(fraction: number): string {
	return `${String(Math.round(fraction * PERCENT))}%`;
}

function vw(viewportFraction: number): string {
	return `${String(Math.round(viewportFraction * PERCENT))}vw`;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("skeleton sweep CSS matches SKELETON_MOTION", () => {
	const band = SKELETON_MOTION.bandWidthViewport;
	const bandOffset = band * BAND_OFFSET_BAND_WIDTHS;

	it("runs one cycle in sweepCycleMs, eased ease-in-out", () => {
		expect(CSS).toContain(`--skeleton-sweep-duration: ${String(SKELETON_MOTION.sweepCycleMs / MS_PER_SECOND)}s;`);
		const { x1, y1, x2, y2 } = SKELETON_MOTION.sweepEasing;
		// CSS `ease-in-out` is exactly cubic-bezier(0.42, 0, 0.58, 1).
		expect([x1, y1, x2, y2]).toStrictEqual([0.42, 0, 0.58, 1]);
		expect(CSS).toContain("animation: skeleton-sweep var(--skeleton-sweep-duration) ease-in-out infinite;");
	});

	it("travels for travelFraction of the cycle, from bandStart to bandEnd", () => {
		const keyframes = new RegExp(
			`@keyframes skeleton-sweep \\{\\s*from \\{\\s*background-position-x: ${escapeRegExp(vw(SKELETON_MOTION.bandStartViewport - bandOffset))};\\s*\\}\\s*${escapeRegExp(percent(SKELETON_MOTION.travelFraction))},\\s*to \\{\\s*background-position-x: ${escapeRegExp(vw(SKELETON_MOTION.bandEndViewport - bandOffset))};`,
		);
		expect(CSS).toMatch(keyframes);
	});

	it("draws a band bandWidthViewport wide", () => {
		expect(CSS).toContain(`background-size: ${vw(band * IMAGE_BAND_WIDTHS)} 100%;`);
		expect(CSS).toContain("linear-gradient(100deg, transparent 40%, var(--skeleton-sheen) 50%, transparent 60%)");
	});

	it("reveals the region after revealDelayMs, over revealMs", () => {
		expect(CSS).toContain(`--skeleton-reveal-delay: ${String(SKELETON_MOTION.revealDelayMs)}ms;`);
		expect(CSS).toContain(`--skeleton-reveal-duration: ${String(SKELETON_MOTION.revealMs)}ms;`);
	});

	it("tints the sheen per theme from the token role and opacity", () => {
		const { light, dark } = SKELETON_MOTION.sheen;
		expect(CSS).toContain(`--skeleton-sheen: color-mix(in oklch, var(--${light.role}) ${percent(light.opacity)}, transparent);`);
		expect(CSS).toContain(`--skeleton-sheen: color-mix(in oklch, var(--${dark.role}) ${percent(dark.opacity)}, transparent);`);
	});
});
