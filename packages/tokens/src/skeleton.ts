// ============================================
// skeleton.ts — the loading-skeleton motion, shared by web and mobile
// ============================================
// One highlight band sweeps the whole screen and passes over every bone in
// unison, then rests off-screen before the next pass. Web draws it in CSS
// (packages/ui `styles/components.css`, `skeleton-bone`), mobile with
// Reanimated (apps/mobile `components/skeleton.tsx`); both read these numbers,
// and a parity test keeps the CSS in step. Distances are fractions of the
// viewport width, so the sweep looks the same on a phone and a monitor.

import type { CubicBezier, ThemeName, ThemeRole } from "./schema";
import { cubicBezier } from "./value";

/** The highlight's colour in one theme: a token role, at an opacity. */
export interface SkeletonSheen {
	readonly role: ThemeRole;
	/** 0–1. */
	readonly opacity: number;
}

export interface SkeletonMotion {
	/** One full cycle — the pass plus the rest — in ms. */
	readonly sweepCycleMs: number;
	/** The share of the cycle the band spends travelling; it rests off-screen for the remainder. */
	readonly travelFraction: number;
	/** The pass's easing (CSS `ease-in-out`). */
	readonly sweepEasing: CubicBezier;
	/** The band's leading edge when a pass starts, in viewport widths (negative: off the left edge). */
	readonly bandStartViewport: number;
	/** The band's leading edge when a pass ends, in viewport widths (1: just off the right edge). */
	readonly bandEndViewport: number;
	/** The band's width in viewport widths; it fades in from and out to transparent at its edges. */
	readonly bandWidthViewport: number;
	/** How long a loading region stays invisible, so a fast load never flashes a skeleton. */
	readonly revealDelayMs: number;
	/** The region's fade-in once the delay has passed. */
	readonly revealMs: number;
	/** Per theme: light lifts the bone toward the card, dark toward the foreground — never darkening it. */
	readonly sheen: Readonly<Record<ThemeName, SkeletonSheen>>;
}

export const SKELETON_MOTION: SkeletonMotion = {
	sweepCycleMs: 2200,
	travelFraction: 0.7,
	sweepEasing: cubicBezier(0.42, 0, 0.58, 1),
	bandStartViewport: -0.4,
	bandEndViewport: 1,
	bandWidthViewport: 0.4,
	revealDelayMs: 150,
	revealMs: 240,
	sheen: {
		light: { role: "card", opacity: 0.85 },
		dark: { role: "foreground", opacity: 0.07 },
	},
};
