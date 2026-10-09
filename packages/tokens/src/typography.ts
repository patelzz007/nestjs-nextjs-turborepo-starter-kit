// ============================================
// typography.ts — font roles and the app-shell type sizes
// ============================================
// Only what the web already defines. Font FAMILIES are loaded by each app
// (packages/ui src/fonts → `--font-sans`, `--font-heading`); the tokens here
// only say which family each role uses.

import type { Typography } from "./schema";
import { fontVariable, rem } from "./value";

export const TYPOGRAPHY: Typography = {
	/* Buttons use the UI face; sidebar nav and headings use Bricolage Grotesque (`--font-heading`). */
	fonts: {
		"font-button": fontVariable("font-sans"),
		"font-sidebar": fontVariable("font-heading"),
	},
	/*
	 * App-shell chrome type: sidebar captions and section labels, badge sizes,
	 * <kbd> shortcut hints, uppercase overline group labels, the smallest meta
	 * text (palette footer keys, section badges), scope chips, the toast
	 * countdown, and the calendar weekday header / week-number column (between
	 * text-xs and text-sm).
	 */
	sizes: {
		"text-sidebar-caption": rem(0.6875),
		"text-sidebar-section": rem(0.8125),
		"text-badge-xs": rem(0.6),
		"text-badge-sm": rem(0.625),
		"text-kbd": rem(0.625),
		"text-overline": rem(0.625),
		"text-micro": rem(0.5625),
		"text-chip": rem(0.6875),
		"text-toast-countdown": rem(0.625),
		"text-calendar-caption": rem(0.8),
	},
};
