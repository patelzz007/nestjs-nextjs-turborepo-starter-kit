// ============================================
// tailwind-theme.ts — the Tailwind v4 `@theme inline` mapping
// ============================================
// Turns tokens into utilities: `--color-card: var(--card)` gives `bg-card`,
// `--z-index-toast: var(--z-toast)` gives `z-toast`, and so on. The web output
// writes all of it; the mobile output writes the colour utilities and the
// radius scale (the rest maps web chrome).

import { RADIUS_SCALE } from "./radius";
import type { ColorTokenName, Shadow, ShadowLayer, TailwindTheme } from "./schema";
import { colorToken } from "./value";

/** A drop-shadow layer at x = 0 (every layer in the scale is vertical). */
function dropLayer(offsetY: number, blur: number, spread: number, color: ColorTokenName): ShadowLayer {
	return { isInset: false, offsetX: 0, offsetY, blur, spread, color: colorToken(color) };
}

/*
 * Elevation. Every shadow reads the two theme colours `--shadow-ambient` and
 * `--shadow-key`, so one swap per theme restyles the whole scale. Light mode:
 * soft, ink-tinted. Dark mode: near-invisible on small shadows (depth comes
 * from lightness), deep on floating layers (`shadow-md` and up). Cards use
 * `shadow-sm inset-shadow-edge`; `inset-shadow-edge` is the faint top-edge
 * highlight cards get in dark mode (transparent in light).
 */
const SHADOWS: readonly Shadow[] = [
	{ name: "shadow-2xs", layers: [dropLayer(1, 0, 0, "shadow-ambient")] },
	{ name: "shadow-xs", layers: [dropLayer(1, 2, 0, "shadow-ambient")] },
	{ name: "shadow-sm", layers: [dropLayer(1, 3, 0, "shadow-ambient"), dropLayer(1, 2, -1, "shadow-ambient")] },
	{ name: "shadow-md", layers: [dropLayer(4, 8, -2, "shadow-ambient"), dropLayer(2, 4, -2, "shadow-ambient")] },
	{ name: "shadow-lg", layers: [dropLayer(12, 20, -4, "shadow-key"), dropLayer(4, 8, -4, "shadow-ambient")] },
	{ name: "shadow-xl", layers: [dropLayer(20, 28, -6, "shadow-key"), dropLayer(8, 12, -6, "shadow-ambient")] },
	{ name: "shadow-2xl", layers: [dropLayer(28, 56, -12, "shadow-key")] },
	{ name: "inset-shadow-edge", layers: [{ isInset: true, offsetX: 0, offsetY: 1, blur: 0, spread: 0, color: colorToken("edge-highlight") }] },
];

export const TAILWIND_THEME: TailwindTheme = {
	aliases: [
		{ name: "z-index-overlay", token: "z-overlay" },
		{ name: "z-index-popover", token: "z-popover" },
		{ name: "z-index-toast", token: "z-toast" },
		{ name: "z-index-sidebar", token: "z-sidebar" },
		{ name: "z-index-sidebar-rail", token: "z-sidebar-rail" },
		{ name: "z-index-sticky", token: "z-sticky" },
		{ name: "sidebar-width", token: "sidebar-width" },
		{ name: "sidebar-width-mobile", token: "sidebar-width-mobile" },
		{ name: "sidebar-width-icon", token: "sidebar-width-icon" },
		{ name: "font-button", token: "font-button" },
		{ name: "max-width-8xl", token: "max-width-8xl" },
		{ name: "max-width-9xl", token: "max-width-9xl" },
		{ name: "max-width-10xl", token: "max-width-10xl" },
	],
	colors: [
		"auth-panel",
		"auth-panel-muted",
		"auth-panel-foreground",
		"auth-brand-from",
		"auth-brand-to",
		"print-foreground",
		"print-border",
		"print-header-bg",
		"print-row-alt",
		"qr-background",
		"qr-foreground",
		"background",
		"foreground",
		"card",
		"card-foreground",
		"popover",
		"popover-foreground",
		"primary",
		"primary-foreground",
		"secondary",
		"secondary-foreground",
		"muted",
		"muted-foreground",
		"accent",
		"accent-foreground",
		"destructive",
		"success",
		"warning",
		"info",
		"destructive-soft",
		"success-soft",
		"warning-soft",
		"info-soft",
		"success-foreground",
		"warning-foreground",
		"info-foreground",
		"destructive-foreground",
		"invert",
		"invert-foreground",
		"status-foreground",
		"scrim",
		"tone-green",
		"tone-green-soft",
		"tone-blue",
		"tone-blue-soft",
		"tone-yellow",
		"tone-yellow-soft",
		"tone-red",
		"tone-red-soft",
		"tone-orange",
		"tone-orange-soft",
		"tone-teal",
		"tone-teal-soft",
		"tone-violet",
		"tone-violet-soft",
		"topbar",
		"tier-bronze",
		"tier-bronze-soft",
		"tier-silver",
		"tier-silver-soft",
		"tier-gold",
		"tier-gold-soft",
		"tier-platinum",
		"tier-platinum-soft",
		"reward",
		"reward-soft",
		"reward-solid",
		"reward-solid-foreground",
		"border",
		"input",
		"ring",
		"chart-1",
		"chart-2",
		"chart-3",
		"chart-4",
		"chart-5",
		"sidebar",
		"sidebar-foreground",
		"sidebar-primary",
		"sidebar-primary-foreground",
		"sidebar-accent",
		"sidebar-accent-foreground",
		"sidebar-border",
		"sidebar-ring",
		"sidebar-active",
		"sidebar-active-foreground",
		"sidebar-active-border",
	],
	shadows: SHADOWS,
	radiusScale: RADIUS_SCALE,
	fonts: ["font-sans", "font-heading"],
};
