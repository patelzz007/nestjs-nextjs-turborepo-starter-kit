// ============================================
// mobile-theme.ts — the Expo app's own visual system, per theme (ADR 079)
// ============================================
// The web apps share one set of surfaces and re-map only their brand roles (web blue, merchant green).
// The Expo app is its own design language: a generic, neutral account app any product can rebrand.
// Its stylesheet is generated (mobile.css, every value literal), so its re-maps live here and only the
// mobile renderer applies them; the web never sees these values. Any themed role may be re-mapped
// (MobileThemeOverridesSchema); a role left out keeps the shared value (the status tones, the tiers).
//
// - light: a soft grey page (gray-50), near-white surfaces (gray-10, never pure white) with hairline
//   edges (gray-200); slate instead of black (owner, 2026-11-05): slate-900 (brand-900) for text and
//   slate-800 (brand-800, the tab bar's capsule) for buttons, selection and the drawer's account card.
// - dark: graphite (owner's pick, 2026-11-05): neutral greys leaning faintly cool — page #1c1d20 <
//   cards #292b2f < raised #313337, hairlines #3a3c40 — with #f0f1f4 ink for text and buttons, #a9adb6
//   for secondary text and a soft blue (#8ab4ff) for links and focus.
// - nord: the owner's editor slate (the `dusk` scale) — a cool blue-grey page (#2b2d36) under lifted
//   surfaces (#303540, raised #343a47) with soft hairlines (#3b4150) — read at a glance: text #e6e9f0,
//   secondary #b8bfcb, WHITE for buttons and the active items (with dusk text), steel blue (#8aa4c8) for
//   links and focus; the status tints keep their Aurora hues.
//
// Colour does jobs only: blue for links, focus and the lead chart series; the shared status tones for
// state. The floating tab bar never follows these roles: it has its own colours
// (MOBILE_COMPONENT_COLORS), pinned to the look it shipped with.

import type { MobileComponentColors, MobileThemeOverrides } from "./schema";
import { hex, oklch, paletteColor } from "./value";

/** Dark theme links and focus: a soft clear blue, 6.8:1 on the graphite cards (#292b2f). */
const DARK_LINK = hex("#8ab4ff");
/** Light theme links and focus: a clear blue, 6.5:1 on the near-white surfaces. */
const LIGHT_LINK = oklch(0.5, 0.19, 262);
/** Light theme's teal and violet chart series: the third and fourth series, after blue and amber. */
const LIGHT_CHART_TEAL = oklch(0.6, 0.1, 190);
const LIGHT_CHART_VIOLET = oklch(0.55, 0.17, 295);
/** Dark theme's teal and violet chart series, lifted to read on the dark surfaces. */
const DARK_CHART_TEAL = oklch(0.72, 0.1, 190);
const DARK_CHART_VIOLET = oklch(0.7, 0.14, 295);
/** Soft depth: a faint ambient shadow and a slightly firmer key shadow (raised sheets, the toast). */
const LIGHT_SHADOW_AMBIENT = oklch(0, 0, 0, 0.05);
const LIGHT_SHADOW_KEY = oklch(0, 0, 0, 0.08);
const DARK_SHADOW_AMBIENT = oklch(0, 0, 0, 0.3);
const DARK_SHADOW_KEY = oklch(0, 0, 0, 0.5);
/*
 * Status tints (badges, alerts, toasts), calmed for the phone: a status chip sits in view for long
 * stretches, so its fill stays close to the surface under it and its text is clear without glare.
 * Light: the pale yellow at half the shared chroma (the full one read as a highlighter).
 */
const LIGHT_YELLOW_SOFT = oklch(0.96, 0.045, 92);
const LIGHT_WARNING_SOFT = oklch(0.955, 0.04, 84);
/**
 * Dark: every soft fill a step above the #292b2f graphite cards with enough chroma to read as its colour (the
 * drawer's status pills, badges, alerts), yellow the gentlest so it never turns mustard.
 */
const DARK_YELLOW_SOFT = oklch(0.34, 0.05, 85);
const DARK_BLUE_SOFT = oklch(0.34, 0.075, 255);
const DARK_GREEN_SOFT = oklch(0.34, 0.075, 150);
const DARK_RED_SOFT = oklch(0.35, 0.085, 25);
const DARK_ORANGE_SOFT = oklch(0.35, 0.075, 50);
const DARK_TEAL_SOFT = oklch(0.34, 0.06, 190);
const DARK_VIOLET_SOFT = oklch(0.35, 0.085, 295);
/** Nord: the soft fills take the Aurora / Frost hue of their tone over Polar Night (not the shared grey-browns). */
const NORD_GREEN_SOFT = oklch(0.37, 0.05, 135);
const NORD_YELLOW_SOFT = oklch(0.38, 0.045, 85);
const NORD_RED_SOFT = oklch(0.37, 0.06, 15);
const NORD_ORANGE_SOFT = oklch(0.37, 0.055, 45);
const NORD_TEAL_SOFT = oklch(0.37, 0.04, 190);
const NORD_VIOLET_SOFT = oklch(0.37, 0.05, 320);
/** Dark yellow text: a warm amber instead of the shared near-neon (still 7:1 on its fill). */
const DARK_YELLOW = oklch(0.85, 0.1, 88);
/** Dark surfaces catch a hairline of light along their top edge. */
const DARK_EDGE_HIGHLIGHT = oklch(1, 0, 0, 0.04);

/**
 * The graphite dark theme (ADR 079; your pick of five): #1c1d20 page, #292b2f cards, #f0f1f4 text, white for the
 * primary action and the active item, a soft blue for links, focus and the lead chart series. The phone's dark
 * theme, and since 2026-11-05 the admin panel's too (ADMIN_THEME_OVERRIDES): one definition, so the two never drift.
 */
export const GRAPHITE_DARK_THEME: NonNullable<MobileThemeOverrides["dark"]> = {
	background: paletteColor("graphite", "950"),
	foreground: paletteColor("graphite", "25"),
	card: paletteColor("graphite", "850"),
	"card-foreground": paletteColor("graphite", "25"),
	popover: paletteColor("graphite", "800"),
	"popover-foreground": paletteColor("graphite", "25"),
	topbar: paletteColor("graphite", "950"),
	"shell-frame": paletteColor("graphite", "975"),
	"shell-panel": paletteColor("graphite", "950"),
	sheet: paletteColor("graphite", "850"),
	primary: paletteColor("graphite", "25"),
	"primary-foreground": paletteColor("graphite", "950"),
	secondary: paletteColor("graphite", "750"),
	"secondary-foreground": paletteColor("graphite", "25"),
	muted: paletteColor("graphite", "750"),
	"muted-foreground": paletteColor("graphite", "400"),
	accent: paletteColor("graphite", "750"),
	"accent-foreground": paletteColor("graphite", "25"),
	border: paletteColor("graphite", "750"),
	input: paletteColor("graphite", "700"),
	ring: DARK_LINK,
	"chart-1": DARK_LINK,
	"chart-2": paletteColor("warm", "300"),
	"chart-3": DARK_CHART_TEAL,
	"chart-4": DARK_CHART_VIOLET,
	"chart-5": paletteColor("gray", "500"),
	sidebar: paletteColor("graphite", "950"),
	"sidebar-foreground": paletteColor("graphite", "25"),
	"sidebar-primary": paletteColor("graphite", "25"),
	"sidebar-primary-foreground": paletteColor("graphite", "950"),
	"sidebar-accent": paletteColor("graphite", "750"),
	"sidebar-accent-foreground": paletteColor("graphite", "25"),
	"sidebar-border": paletteColor("graphite", "750"),
	"sidebar-ring": DARK_LINK,
	"sidebar-active": paletteColor("graphite", "25"),
	"sidebar-active-foreground": paletteColor("graphite", "950"),
	"sidebar-active-border": paletteColor("graphite", "25"),
	"search-mark-bg": DARK_LINK,
	"search-mark-fg": paletteColor("graphite", "950"),
	"shadow-ambient": DARK_SHADOW_AMBIENT,
	"shadow-key": DARK_SHADOW_KEY,
	"edge-highlight": DARK_EDGE_HIGHLIGHT,
	"success-soft": DARK_GREEN_SOFT,
	"warning-soft": DARK_YELLOW_SOFT,
	"info-soft": DARK_BLUE_SOFT,
	"destructive-soft": DARK_RED_SOFT,
	"tone-green-soft": DARK_GREEN_SOFT,
	"tone-blue-soft": DARK_BLUE_SOFT,
	"tone-yellow": DARK_YELLOW,
	"tone-yellow-soft": DARK_YELLOW_SOFT,
	"tone-red-soft": DARK_RED_SOFT,
	"tone-orange-soft": DARK_ORANGE_SOFT,
	"tone-teal-soft": DARK_TEAL_SOFT,
	"tone-violet-soft": DARK_VIOLET_SOFT,
	link: DARK_LINK,
};

export const MOBILE_THEME_OVERRIDES: MobileThemeOverrides = {
	light: {
		background: paletteColor("gray", "50"),
		foreground: paletteColor("brand", "900"),
		card: paletteColor("gray", "10"),
		"card-foreground": paletteColor("brand", "900"),
		popover: paletteColor("gray", "10"),
		"popover-foreground": paletteColor("brand", "900"),
		topbar: paletteColor("gray", "50"),
		"shell-frame": paletteColor("gray", "50"),
		"shell-panel": paletteColor("gray", "50"),
		sheet: paletteColor("gray", "10"),
		primary: paletteColor("brand", "800"),
		"primary-foreground": paletteColor("gray", "25"),
		secondary: paletteColor("gray", "100"),
		"secondary-foreground": paletteColor("brand", "900"),
		muted: paletteColor("gray", "100"),
		"muted-foreground": paletteColor("gray", "600"),
		accent: paletteColor("gray", "100"),
		"accent-foreground": paletteColor("brand", "900"),
		border: paletteColor("gray", "200"),
		input: paletteColor("gray", "300"),
		ring: LIGHT_LINK,
		"chart-1": LIGHT_LINK,
		"chart-2": paletteColor("warm", "500"),
		"chart-3": LIGHT_CHART_TEAL,
		"chart-4": LIGHT_CHART_VIOLET,
		"chart-5": paletteColor("gray", "500"),
		sidebar: paletteColor("gray", "50"),
		"sidebar-foreground": paletteColor("brand", "900"),
		"sidebar-primary": paletteColor("brand", "800"),
		"sidebar-primary-foreground": paletteColor("gray", "25"),
		"sidebar-accent": paletteColor("gray", "100"),
		"sidebar-accent-foreground": paletteColor("brand", "900"),
		"sidebar-border": paletteColor("gray", "200"),
		"sidebar-ring": LIGHT_LINK,
		"sidebar-active": paletteColor("brand", "800"),
		"sidebar-active-foreground": paletteColor("gray", "25"),
		"sidebar-active-border": paletteColor("brand", "800"),
		"search-mark-bg": LIGHT_LINK,
		"search-mark-fg": paletteColor("gray", "25"),
		"shadow-ambient": LIGHT_SHADOW_AMBIENT,
		"shadow-key": LIGHT_SHADOW_KEY,
		"warning-soft": LIGHT_WARNING_SOFT,
		"tone-yellow-soft": LIGHT_YELLOW_SOFT,
		link: LIGHT_LINK,
	},
	dark: GRAPHITE_DARK_THEME,
	nord: {
		background: paletteColor("dusk", "900"),
		foreground: paletteColor("dusk", "25"),
		card: paletteColor("dusk", "800"),
		"card-foreground": paletteColor("dusk", "25"),
		popover: paletteColor("dusk", "750"),
		"popover-foreground": paletteColor("dusk", "25"),
		topbar: paletteColor("dusk", "900"),
		"shell-frame": paletteColor("dusk", "950"),
		"shell-panel": paletteColor("dusk", "900"),
		sheet: paletteColor("dusk", "800"),
		primary: paletteColor("neutral", "0"),
		"primary-foreground": paletteColor("dusk", "950"),
		secondary: paletteColor("dusk", "700"),
		"secondary-foreground": paletteColor("dusk", "25"),
		muted: paletteColor("dusk", "750"),
		"muted-foreground": paletteColor("dusk", "200"),
		accent: paletteColor("dusk", "750"),
		"accent-foreground": paletteColor("dusk", "25"),
		border: paletteColor("dusk", "700"),
		input: paletteColor("dusk", "600"),
		ring: paletteColor("dusk", "accent"),
		link: paletteColor("dusk", "accent-link"),
		"chart-1": paletteColor("dusk", "accent"),
		sidebar: paletteColor("dusk", "900"),
		"sidebar-foreground": paletteColor("dusk", "25"),
		"sidebar-primary": paletteColor("neutral", "0"),
		"sidebar-primary-foreground": paletteColor("dusk", "950"),
		"sidebar-accent": paletteColor("dusk", "750"),
		"sidebar-accent-foreground": paletteColor("dusk", "25"),
		"sidebar-border": paletteColor("dusk", "700"),
		"sidebar-ring": paletteColor("dusk", "accent"),
		"sidebar-active": paletteColor("neutral", "0"),
		"sidebar-active-foreground": paletteColor("dusk", "950"),
		"sidebar-active-border": paletteColor("neutral", "0"),
		"search-mark-bg": paletteColor("dusk", "accent"),
		"search-mark-fg": paletteColor("dusk", "950"),
		"success-soft": NORD_GREEN_SOFT,
		"warning-soft": NORD_YELLOW_SOFT,
		"info-soft": paletteColor("dusk", "accent-soft"),
		"destructive-soft": NORD_RED_SOFT,
		"tone-green-soft": NORD_GREEN_SOFT,
		"tone-blue-soft": paletteColor("dusk", "accent-soft"),
		"tone-yellow-soft": NORD_YELLOW_SOFT,
		"tone-red-soft": NORD_RED_SOFT,
		"tone-orange-soft": NORD_ORANGE_SOFT,
		"tone-teal-soft": NORD_TEAL_SOFT,
		"tone-violet-soft": NORD_VIOLET_SOFT,
	},
};

/**
 * The floating tab bar's own colours, so redesigning the rest of the app never moves it by accident.
 * Light keeps the bar exactly as it shipped (the shared card, border, slate capsule and muted icons). Dark
 * and Nord follow their mobile surfaces (owner's call, 2026-11-05): dark a #292b2f pill with a #3a3c40 edge
 * and a #f0f1f4 capsule; Nord the editor slate's card pill and hairline with a white capsule. Change them
 * only to change the bar. `logo-tile` is the light chip under a language's ORIGINAL (full-colour) logo in
 * every theme, so a brand's own colours read whatever the surface (Rust's and Markdown's are near-black).
 */
export const MOBILE_COMPONENT_COLORS: MobileComponentColors = {
	light: {
		"tab-bar": paletteColor("neutral", "25"),
		"tab-bar-border": paletteColor("neutral", "200"),
		"tab-bar-active": paletteColor("brand", "800"),
		"tab-bar-active-foreground": paletteColor("neutral", "0"),
		"tab-bar-icon": paletteColor("neutral", "600"),
		"logo-tile": paletteColor("gray", "100"),
	},
	dark: {
		"tab-bar": paletteColor("graphite", "850"),
		"tab-bar-border": paletteColor("graphite", "750"),
		"tab-bar-active": paletteColor("graphite", "25"),
		"tab-bar-active-foreground": paletteColor("graphite", "950"),
		"tab-bar-icon": paletteColor("graphite", "400"),
		"logo-tile": paletteColor("gray", "300"),
	},
	nord: {
		"tab-bar": paletteColor("dusk", "800"),
		"tab-bar-border": paletteColor("dusk", "700"),
		"tab-bar-active": paletteColor("neutral", "0"),
		"tab-bar-active-foreground": paletteColor("dusk", "950"),
		"tab-bar-icon": paletteColor("dusk", "200"),
		"logo-tile": paletteColor("dusk", "25"),
	},
};
