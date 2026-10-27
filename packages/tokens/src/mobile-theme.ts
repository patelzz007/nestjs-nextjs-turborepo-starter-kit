// ============================================
// mobile-theme.ts — the Expo app's own brand re-maps, per theme
// ============================================
// Each web app re-maps its brand roles in `apps/<name>/app/<name>-theme.css`
// (web blue, merchant green). The Expo app's stylesheet is generated
// (mobile.css, every value literal), so its re-maps live here and only the
// mobile renderer applies them. Only brand roles can be re-mapped
// (AppBrandRoleSchema); surfaces, borders and text stay shared.

import type { AppThemeOverrides } from "./schema";
import { paletteColor } from "./value";

export const MOBILE_THEME_OVERRIDES: AppThemeOverrides = {
	/*
	 * Nord: buttons, switches, focus and the active tab are Snow Storm (nord6) with Polar Night text,
	 * not the shared vivid Frost blue — a near-white accent on the Polar Night surfaces (10.8:1).
	 */
	nord: {
		primary: paletteColor("nord", "6"),
		"primary-foreground": paletteColor("nord", "0"),
		ring: paletteColor("nord", "6"),
		"sidebar-primary": paletteColor("nord", "6"),
		"sidebar-primary-foreground": paletteColor("nord", "0"),
		"sidebar-ring": paletteColor("nord", "6"),
		"sidebar-active": paletteColor("nord", "6"),
		"sidebar-active-foreground": paletteColor("nord", "0"),
		"sidebar-active-border": paletteColor("nord", "6"),
	},
};
