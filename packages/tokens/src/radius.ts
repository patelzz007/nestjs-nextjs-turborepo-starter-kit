// ============================================
// radius.ts — corner radii
// ============================================
// Radius follows hierarchy: 4px tags (`rounded-sm`), 6px controls — buttons,
// inputs, menu rows (`rounded-md`), 10px cards and popovers (`rounded-lg`),
// 14px dialogs and sheets (`rounded-xl`), and `rounded-full` for pills and
// avatars. Every step is a multiple of the one base radius, so changing
// `--radius` rescales the whole system.

import type { Radius, RadiusScale } from "./schema";
import { rem } from "./value";

/** The base radius (`--radius`, 10px) — `rounded-lg`. */
export const RADIUS: Radius = {
	radius: rem(0.625),
};

/** Each Tailwind radius step as a multiple of `--radius`. */
export const RADIUS_SCALE: RadiusScale = {
	sm: 0.4,
	md: 0.6,
	lg: 1,
	xl: 1.4,
	"2xl": 1.8,
	"3xl": 2.2,
	"4xl": 2.6,
};
