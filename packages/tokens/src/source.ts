// ============================================
// source.ts — the complete token source the generator reads
// ============================================

import { LAYOUT } from "./layout";
import { MOTION } from "./motion";
import { PALETTE } from "./palette";
import { RADIUS } from "./radius";
import type { TokenSource } from "./schema";
import { SHARED_COLORS, THEMES } from "./semantic";
import { TAILWIND_THEME } from "./tailwind-theme";
import { TYPOGRAPHY } from "./typography";

export const TOKEN_SOURCE: TokenSource = {
	palette: PALETTE,
	themes: THEMES,
	sharedColors: SHARED_COLORS,
	radius: RADIUS,
	typography: TYPOGRAPHY,
	layout: LAYOUT,
	motion: MOTION,
	tailwindTheme: TAILWIND_THEME,
};
