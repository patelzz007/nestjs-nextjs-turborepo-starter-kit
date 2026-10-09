// ============================================
// palette.ts — the palette primitives (`--palette-<scale>-<step>`)
// ============================================
// The raw colour scales, shared by every app and the docs site. Components
// NEVER read these — they read the semantic tokens (semantic.ts: `--background`,
// `--primary`, …), which map onto these steps per theme. A rebrand edits a
// scale here, then runs `pnpm tokens:generate`.
//
// Every neutral carries the same faint cool cast (hue 258, "ink"), so light and
// dark read as one family and every brand accent sits on it cleanly.
//
// - neutral: the light theme. 0 = card white, 40 = the sidebar panel (a half
//   step above the canvas, same cool cast), 50 = the cool #F1F4F9 canvas (page,
//   topbar), 100 = nav / ghost hover on that canvas and fills inside a card (one
//   clear step below the canvas), 200/300 = borders/inputs, 600 = secondary
//   text, 900 = ink text.
// - ink: the dark theme, by elevation — 950 the deepest chrome, 900 the page,
//   800 cards, 750 popovers, 700/650 borders and in-card fills, 400 secondary
//   text, 50 headings.
// - brand: slate — the default accent (admin, docs) and the starter kit's
//   neutral brand. 960/975 are the deep sidebar tones of the dark theme.
// - blue (web) / green (merchant): app accent hues. Each app re-maps only its
//   brand tokens onto its hue (each app's `app/<name>-theme.css`). 960/975 are
//   that app's deep sidebar tones in dark mode.
// - warm: kopi amber, the charts' warm counter-colour to the accent.

import type { Palette } from "./schema";
import { hex, oklch } from "./value";

export const PALETTE: Palette = {
	neutral: {
		"0": oklch(1, 0, 0),
		"25": oklch(0.985, 0.003, 258),
		"40": hex("#f5f7fb"),
		"50": hex("#f1f4f9"),
		"100": oklch(0.935, 0.009, 258),
		"200": oklch(0.915, 0.008, 258),
		"300": oklch(0.86, 0.01, 258),
		"400": oklch(0.72, 0.013, 258),
		"500": oklch(0.58, 0.015, 258),
		"600": oklch(0.5, 0.016, 258),
		"700": oklch(0.41, 0.017, 258),
		"800": oklch(0.33, 0.018, 258),
		"900": oklch(0.24, 0.02, 258),
	},
	ink: {
		"50": oklch(0.965, 0.004, 258),
		"100": oklch(0.93, 0.006, 258),
		"200": oklch(0.86, 0.009, 258),
		"300": oklch(0.79, 0.011, 258),
		"400": oklch(0.74, 0.013, 258),
		"500": oklch(0.55, 0.016, 258),
		"600": oklch(0.4, 0.018, 258),
		"650": oklch(0.36, 0.018, 258),
		"700": oklch(0.32, 0.018, 258),
		"750": oklch(0.275, 0.017, 258),
		"800": oklch(0.24, 0.016, 258),
		"850": oklch(0.225, 0.015, 258),
		"900": oklch(0.205, 0.014, 258),
		"950": oklch(0.18, 0.013, 258),
	},
	brand: {
		"50": oklch(0.97, 0.01, 257),
		"100": oklch(0.94, 0.018, 257),
		"200": oklch(0.88, 0.028, 257),
		"300": oklch(0.8, 0.036, 257),
		"400": oklch(0.71, 0.044, 257),
		"500": oklch(0.6, 0.05, 257),
		"600": oklch(0.5, 0.055, 257),
		"700": oklch(0.41, 0.055, 257),
		"800": oklch(0.33, 0.05, 257),
		"900": oklch(0.27, 0.042, 257),
		"950": oklch(0.22, 0.035, 257),
		"960": oklch(0.205, 0.028, 257),
		"975": oklch(0.185, 0.022, 257),
	},
	warm: {
		"300": oklch(0.8, 0.12, 72),
		"500": oklch(0.62, 0.13, 62),
		"700": oklch(0.48, 0.1, 52),
	},
	blue: {
		"50": oklch(0.97, 0.016, 255),
		"100": oklch(0.94, 0.034, 255),
		"200": oklch(0.88, 0.062, 255),
		"300": oklch(0.8, 0.1, 255),
		"400": oklch(0.71, 0.13, 255),
		"500": oklch(0.62, 0.16, 255),
		"600": oklch(0.53, 0.17, 255),
		"700": oklch(0.46, 0.15, 255),
		"800": oklch(0.39, 0.12, 255),
		"900": oklch(0.3, 0.09, 255),
		"950": oklch(0.25, 0.065, 256),
		"960": oklch(0.22, 0.05, 257),
		"975": oklch(0.195, 0.04, 258),
	},
	green: {
		"50": oklch(0.97, 0.022, 160),
		"100": oklch(0.94, 0.045, 160),
		"200": oklch(0.88, 0.075, 160),
		"300": oklch(0.8, 0.11, 160),
		"400": oklch(0.72, 0.13, 160),
		"500": oklch(0.6, 0.13, 160),
		"600": oklch(0.5, 0.12, 160),
		"700": oklch(0.44, 0.105, 160),
		"800": oklch(0.37, 0.085, 160),
		"900": oklch(0.3, 0.065, 161),
		"950": oklch(0.25, 0.05, 162),
		"960": oklch(0.22, 0.04, 163),
		"975": oklch(0.195, 0.032, 165),
	},
};
