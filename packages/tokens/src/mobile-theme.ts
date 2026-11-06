// ============================================
// mobile-theme.ts — the Expo app's own visual system, per theme (ADR 079)
// ============================================
// The web apps share one set of surfaces and re-map only their brand roles (web blue, merchant green).
// The Expo app is its own design language: a generic, neutral account app any product can rebrand.
// Its stylesheet is generated (mobile.css, every value literal), so its re-maps live here and only the
// mobile renderer applies them; the web never sees these values. Any themed role may be re-mapped
// (MobileThemeOverridesSchema); a role left out keeps the shared value (the status tones, the tiers).
//
// - light: a calm sky blue page under cards that carry the same blue, outlines in neutral grey, #2563eb
//   links; slate instead of black (owner, 2026-11-05): Tailwind's slate-800 (LIGHT_ACTION, owner, 2026-11-06) for
//   text, buttons, selection, the tab bar's capsule and the sign-in panel.
// - dark: graphite (owner's pick, 2026-11-05): neutral greys leaning faintly cool — page #1c1d20 <
//   cards #292b2f < raised #313337, hairlines #3a3c40 — with #f0f1f4 ink for text, pure white for buttons and selection (owner, 2026-11-06), #a9adb6
//   for secondary text and a soft blue (#8ab4ff) for links and focus.
// - nord: the owner's editor slate (the `dusk` scale) — a cool blue-grey page (#2b2d36) under lifted
//   surfaces (#303540, raised #343a47) with soft hairlines (#3b4150) — read at a glance: text #e6e9f0,
//   secondary #b8bfcb, WHITE for buttons and the active items (with dusk text), steel blue (#8aa4c8) for
//   links and focus; the status tints keep their Aurora hues.
//
// - current-dark, harbour, mocha: dark themes only the phone has (the palettes page), each a DarkPalette below
//   on top of graphite. Harbour is the one whose accent is a colour: its buttons are cornflower, not white.
//
// Colour does jobs only: blue for links, focus and the lead chart series; the shared status tones for
// state. The floating tab bar never follows these roles: it has its own colours
// (MOBILE_COMPONENT_COLORS), pinned to the look it shipped with.

import type { MobileComponentColors, MobileThemeOverrides } from "./schema";
import { hex, oklch, paletteColor } from "./value";

/**
 * The light theme (owner's pick, 2026-11-06, judged on the phone): a calm sky blue, leaning away from violet, which
 * Tailwind's blue-50 showed on an OLED screen. Blue lives in the surfaces and text; outlines are neutral grey.
 */
const LIGHT_PAGE = hex("#e7f3fb");
/** Cards carry the page's blue, a step lighter, so they sit in the page rather than on it. */
const LIGHT_CARD = hex("#f2f9fd");
/** Soft fills: as deep as the page can go while #2563eb links on them keep 4.5:1. */
const LIGHT_RAISED = hex("#e5f2fb");
/** Dividers and card edges: neutral grey with no blue in it (owner, 2026-11-06). */
const LIGHT_HAIRLINE = hex("#e5e5e5");
/** Field and outlined-button edges: a soft neutral grey. */
const LIGHT_FIELD = hex("#c7c7c7");
/** Checkbox and radio rings: a stronger grey than the fields, 3:1 on the cards, as a control's edge needs. */
const LIGHT_CONTROL_RING = hex("#8c8c8c");
const LIGHT_INK = hex("#1e293b");
const LIGHT_SECONDARY = hex("#3f6285");
/** The sign-in panel's secondary text, on the slate-800 panel. */
const LIGHT_PANEL_MUTED = hex("#b4c0d0");
/** Light theme buttons and selection: Tailwind's slate-800, 14:1 under their near-white text. */
const LIGHT_ACTION = hex("#1e293b");
/** Dark theme links and focus: a soft clear blue, 6.8:1 on the graphite cards (#292b2f). */
const DARK_LINK = hex("#8ab4ff");
/** Light theme links and focus: Tailwind's blue-600. */
const LIGHT_LINK = hex("#2563eb");
/** Light theme's teal and violet chart series: the third and fourth series, after blue and amber. */
const LIGHT_CHART_TEAL = oklch(0.6, 0.1, 190);
const LIGHT_CHART_VIOLET = oklch(0.55, 0.17, 295);
/** Light theme's fifth chart series: a soft blue instead of grey, 3:1 on the page and the cards. */
const LIGHT_CHART_SKY = hex("#5e8cb7");
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

/** A tone on the phone's own themes: the colour, and its soft tint (the colour at 22% over the theme's card). */
interface DarkTone {
	readonly full: ReturnType<typeof hex>;
	readonly soft: ReturnType<typeof hex>;
}

/** One of the phone's own dark palettes (the palettes page): the surfaces, text, accent and tones it sets. */
interface DarkPalette {
	readonly page: ReturnType<typeof hex>;
	readonly card: ReturnType<typeof hex>;
	readonly raised: ReturnType<typeof hex>;
	readonly hairline: ReturnType<typeof hex>;
	readonly ink: ReturnType<typeof hex>;
	readonly muted: ReturnType<typeof hex>;
	readonly primary: ReturnType<typeof hex>;
	readonly primaryForeground: ReturnType<typeof hex>;
	readonly link: ReturnType<typeof hex>;
	readonly blue: DarkTone;
	readonly violet: DarkTone;
	readonly green: DarkTone;
	readonly yellow: DarkTone;
	readonly red: DarkTone;
}

/** Current Dark: the pure greys the phone shipped before graphite. */
const CURRENT_DARK_PALETTE: DarkPalette = {
	page: hex("#1d1d1d"),
	card: hex("#2b2b2b"),
	raised: hex("#333333"),
	hairline: hex("#393939"),
	ink: hex("#f5f5f5"),
	muted: hex("#a4a4a4"),
	primary: hex("#f5f5f5"),
	primaryForeground: hex("#1d1d1d"),
	link: hex("#7ab0ff"),
	blue: { full: hex("#7aa7ff"), soft: hex("#3c465a") },
	violet: { full: hex("#b49cff"), soft: hex("#49445a") },
	green: { full: hex("#62cf96"), soft: hex("#374f43") },
	yellow: { full: hex("#e9b45c"), soft: hex("#554936") },
	red: { full: hex("#f08a8a"), soft: hex("#564040") },
};

/** Harbour: a deep blue slate with a cornflower accent, the one palette whose accent is a colour. */
const HARBOUR_PALETTE: DarkPalette = {
	page: hex("#1a2030"),
	card: hex("#252d3f"),
	raised: hex("#2d3547"),
	hairline: hex("#363e50"),
	ink: hex("#e9eef8"),
	muted: hex("#a5b0c6"),
	primary: hex("#9bbcff"),
	primaryForeground: hex("#121a2b"),
	link: hex("#9bbcff"),
	blue: { full: hex("#9bbcff"), soft: hex("#3f4c69") },
	violet: { full: hex("#bba8ff"), soft: hex("#464869") },
	green: { full: hex("#6fd3a6"), soft: hex("#355256") },
	yellow: { full: hex("#eebd6c"), soft: hex("#514d49") },
	red: { full: hex("#f39494"), soft: hex("#524452") },
};

/** Mocha: greys warmed toward coffee, the hue kept low so it never turns amber. */
const MOCHA_PALETTE: DarkPalette = {
	page: hex("#201d1b"),
	card: hex("#2d2a28"),
	raised: hex("#353230"),
	hairline: hex("#3e3b39"),
	ink: hex("#f4efe9"),
	muted: hex("#b5ada4"),
	primary: hex("#f4efe9"),
	primaryForeground: hex("#201d1b"),
	link: hex("#e3b48c"),
	blue: { full: hex("#8eb0f0"), soft: hex("#424754") },
	violet: { full: hex("#c0a6f0"), soft: hex("#4d4554") },
	green: { full: hex("#7ccf9c"), soft: hex("#3e4e42") },
	yellow: { full: hex("#e9b86a"), soft: hex("#564937") },
	red: { full: hex("#ef9488"), soft: hex("#58413d") },
};

/** A palette as theme roles; the generator lays them over the dark theme, which fills in the rest (shadows, the other chart series). */
function darkThemeOf(palette: DarkPalette): NonNullable<MobileThemeOverrides["harbour"]> {
	return {
		background: palette.page,
		foreground: palette.ink,
		card: palette.card,
		"card-foreground": palette.ink,
		popover: palette.raised,
		"popover-foreground": palette.ink,
		topbar: palette.page,
		"shell-frame": palette.page,
		"shell-panel": palette.page,
		sheet: palette.card,
		primary: palette.primary,
		"primary-foreground": palette.primaryForeground,
		secondary: palette.hairline,
		"secondary-foreground": palette.ink,
		muted: palette.hairline,
		"muted-foreground": palette.muted,
		accent: palette.hairline,
		"accent-foreground": palette.ink,
		border: palette.hairline,
		input: palette.hairline,
		ring: palette.link,
		"chart-1": palette.link,
		sidebar: palette.page,
		"sidebar-foreground": palette.ink,
		"sidebar-primary": palette.primary,
		"sidebar-primary-foreground": palette.primaryForeground,
		"sidebar-accent": palette.hairline,
		"sidebar-accent-foreground": palette.ink,
		"sidebar-border": palette.hairline,
		"sidebar-ring": palette.link,
		"sidebar-active": palette.primary,
		"sidebar-active-foreground": palette.primaryForeground,
		"sidebar-active-border": palette.primary,
		"search-mark-bg": palette.link,
		"search-mark-fg": palette.page,
		"auth-panel": palette.page,
		"auth-panel-muted": palette.muted,
		"auth-brand-from": palette.hairline,
		"auth-brand-to": palette.raised,
		"success-soft": palette.green.soft,
		"warning-soft": palette.yellow.soft,
		"info-soft": palette.blue.soft,
		"destructive-soft": palette.red.soft,
		"tone-green": palette.green.full,
		"tone-green-soft": palette.green.soft,
		"tone-blue": palette.blue.full,
		"tone-blue-soft": palette.blue.soft,
		"tone-yellow": palette.yellow.full,
		"tone-yellow-soft": palette.yellow.soft,
		"tone-red": palette.red.full,
		"tone-red-soft": palette.red.soft,
		"tone-violet": palette.violet.full,
		"tone-violet-soft": palette.violet.soft,
		link: palette.link,
	};
}

/** A palette's tab bar: the card's pill and edge, a capsule in its accent, its secondary text for the icons. */
function darkTabBarOf(palette: DarkPalette): MobileComponentColors["harbour"] {
	return {
		"tab-bar": palette.card,
		"tab-bar-border": palette.hairline,
		"tab-bar-active": palette.primary,
		"tab-bar-active-foreground": palette.primaryForeground,
		"tab-bar-icon": palette.muted,
		"control-ring": palette.hairline,
		"logo-tile": paletteColor("gray", "300"),
	};
}

export const MOBILE_THEME_OVERRIDES: MobileThemeOverrides = {
	light: {
		background: LIGHT_PAGE,
		foreground: LIGHT_INK,
		card: LIGHT_CARD,
		"card-foreground": LIGHT_INK,
		popover: LIGHT_CARD,
		"popover-foreground": LIGHT_INK,
		topbar: LIGHT_PAGE,
		"shell-frame": LIGHT_PAGE,
		"shell-panel": LIGHT_PAGE,
		sheet: LIGHT_CARD,
		primary: LIGHT_ACTION,
		"primary-foreground": paletteColor("gray", "25"),
		secondary: LIGHT_RAISED,
		"secondary-foreground": LIGHT_INK,
		muted: LIGHT_RAISED,
		"muted-foreground": LIGHT_SECONDARY,
		accent: LIGHT_RAISED,
		"accent-foreground": LIGHT_INK,
		border: LIGHT_HAIRLINE,
		input: LIGHT_FIELD,
		ring: LIGHT_LINK,
		"chart-1": LIGHT_LINK,
		"chart-2": paletteColor("warm", "500"),
		"chart-3": LIGHT_CHART_TEAL,
		"chart-4": LIGHT_CHART_VIOLET,
		"chart-5": LIGHT_CHART_SKY,
		sidebar: LIGHT_PAGE,
		"sidebar-foreground": LIGHT_INK,
		"sidebar-primary": LIGHT_ACTION,
		"sidebar-primary-foreground": paletteColor("gray", "25"),
		"sidebar-accent": LIGHT_RAISED,
		"sidebar-accent-foreground": LIGHT_INK,
		"sidebar-border": LIGHT_HAIRLINE,
		"sidebar-ring": LIGHT_LINK,
		"sidebar-active": LIGHT_ACTION,
		"sidebar-active-foreground": paletteColor("gray", "25"),
		"sidebar-active-border": LIGHT_ACTION,
		"search-mark-bg": LIGHT_LINK,
		"search-mark-fg": paletteColor("gray", "25"),
		"shadow-ambient": LIGHT_SHADOW_AMBIENT,
		"shadow-key": LIGHT_SHADOW_KEY,
		"warning-soft": LIGHT_WARNING_SOFT,
		"tone-yellow-soft": LIGHT_YELLOW_SOFT,
		link: LIGHT_LINK,
		"auth-panel": LIGHT_ACTION,
		"auth-panel-muted": LIGHT_PANEL_MUTED,
	},
	dark: {
		...GRAPHITE_DARK_THEME,
		primary: paletteColor("neutral", "0"),
		"sidebar-primary": paletteColor("neutral", "0"),
		"sidebar-active": paletteColor("neutral", "0"),
		"sidebar-active-border": paletteColor("neutral", "0"),
	},
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
	"current-dark": darkThemeOf(CURRENT_DARK_PALETTE),
	harbour: darkThemeOf(HARBOUR_PALETTE),
	mocha: darkThemeOf(MOCHA_PALETTE),
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
		"tab-bar": LIGHT_CARD,
		"tab-bar-border": LIGHT_HAIRLINE,
		"tab-bar-active": LIGHT_ACTION,
		"tab-bar-active-foreground": paletteColor("neutral", "0"),
		"tab-bar-icon": LIGHT_SECONDARY,
		"control-ring": LIGHT_CONTROL_RING,
		"logo-tile": LIGHT_RAISED,
	},
	dark: {
		"tab-bar": paletteColor("graphite", "850"),
		"tab-bar-border": paletteColor("graphite", "750"),
		"tab-bar-active": paletteColor("neutral", "0"),
		"tab-bar-active-foreground": paletteColor("graphite", "950"),
		"tab-bar-icon": paletteColor("graphite", "400"),
		"control-ring": paletteColor("graphite", "700"),
		"logo-tile": paletteColor("gray", "300"),
	},
	nord: {
		"tab-bar": paletteColor("dusk", "800"),
		"tab-bar-border": paletteColor("dusk", "700"),
		"tab-bar-active": paletteColor("neutral", "0"),
		"tab-bar-active-foreground": paletteColor("dusk", "950"),
		"tab-bar-icon": paletteColor("dusk", "200"),
		"control-ring": paletteColor("dusk", "600"),
		"logo-tile": paletteColor("dusk", "25"),
	},
	"current-dark": darkTabBarOf(CURRENT_DARK_PALETTE),
	harbour: darkTabBarOf(HARBOUR_PALETTE),
	mocha: darkTabBarOf(MOCHA_PALETTE),
};
