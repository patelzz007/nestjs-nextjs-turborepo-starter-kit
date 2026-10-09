// ============================================
// layout.ts — stacking layers and web-chrome sizes
// ============================================
// Web app-shell values (sidebar widths, content max widths, the switch control's
// geometry). The mobile output does not carry them: they size web chrome that
// the mobile app does not have.

import type { Layout } from "./schema";
import { px, rem, sizeToken, stackLevel } from "./value";

export const LAYOUT: Layout = {
	stackLevels: {
		"z-overlay": stackLevel(50),
		"z-popover": stackLevel(50),
		"z-toast": stackLevel(60),
		"z-sidebar": stackLevel(10),
		"z-sidebar-rail": stackLevel(20),
		/* Sticky in-flow headers (e.g. an accordion trigger pinned to its scroller). */
		"z-sticky": stackLevel(10),
	},
	sizes: {
		"sidebar-width": rem(20),
		"sidebar-width-mobile": rem(20),
		"sidebar-width-icon": rem(3),
		"max-width-8xl": rem(88),
		"max-width-9xl": rem(96),
		"max-width-10xl": rem(104),
		"panel-content-max-width": sizeToken("max-width-10xl"),
		/* Pulls a <kbd> hint flush with the input-group edge. */
		"input-group-kbd-nudge": rem(-0.15),
		/* Stroke of the dashed chart-tooltip series indicator (between border and border-2). */
		"chart-indicator-dashed-width": px(1.5),
		"switch-height": px(18.4),
		"switch-width": px(32),
		"switch-height-sm": px(14),
		"switch-width-sm": px(24),
		"switch-thumb-size": px(16),
		"switch-thumb-size-sm": px(12),
		/* Gap the checked thumb keeps from the track's end edge. */
		"switch-thumb-inset": px(2),
	},
};
