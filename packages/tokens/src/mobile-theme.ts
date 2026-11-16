// ============================================
// mobile-theme.ts — the Expo app's own visual system, per theme (ADR 079)
// ============================================
// The web apps share one set of surfaces and re-map only their brand roles (web blue, merchant green).
// The Expo app is its own design language: a generic, neutral account app any product can rebrand.
// Its stylesheet is generated (mobile.css, every value literal), so its re-maps live here and only the
// mobile renderer applies them; the web never sees these values. Any themed role may be re-mapped
// (MobileThemeOverridesSchema); a role left out keeps the shared value (the status tones, the tiers).
//
// - light and dark: the monochrome mobile visual spec (owner, 2026-11-15), Tailwind's slate family. Light: a #f7f9fc
//   page under white surfaces, #f0f4f8 soft fills, #e2e8f0 dividers and selected rows, #172033
//   text, #606f85 secondary text (the spec's #64748b 4% deeper, the least change that keeps 4.5:1 on the soft fills —
//   owner's call, same day) and slate-800 (#1e293b) buttons that go to #0f172a while pressed. Dark: a #111827 page
//   under #1b2636 surfaces, #263548 soft fills, #334155 dividers and selected rows, #f1f5f9 text,
//   #94a3b8 secondary text and white buttons (#e2e8f0 pressed) with #0f172a labels. Links, focus and the chart series
//   keep their blues; the dark tints, shadows and the other chart series stay graphite's (GRAPHITE_DARK_THEME).
//   The roles the shared themes have no name for (pressed, selected, subtle, icon, tertiary, disabled) are component
//   colours (MOBILE_COMPONENT_COLORS).
// - nord: the owner's editor slate (the `dusk` scale) — a cool blue-grey page (#2b2d36) under lifted
//   surfaces (#303540, raised #343a47) with soft hairlines (#3b4150) — read at a glance: text #e6e9f0,
//   secondary #b8bfcb, WHITE for buttons and the active items (with dusk text), steel blue (#8aa4c8) for
//   links and focus; the status tints keep their Aurora hues.
//
// - current-dark, harbour, mocha: dark themes only the phone has (the palettes page), each a DarkPalette below
//   on top of the phone's dark theme; each pins its own status colours, so the spec's dark ones never reach it. Harbour is the one whose accent is a colour: its buttons are cornflower, not white.
//
// Colour does jobs only: blue for links, focus and the lead chart series; the shared status tones for
// state. The floating tab bar never follows these roles: it has its own colours
// (MOBILE_COMPONENT_COLORS), pinned to the look it shipped with.

import type { MobileComponentColorName, MobileComponentColors, MobileThemeOverrides } from "./schema";
import { THEMES } from "./semantic";
import { hex, oklch, paletteColor } from "./value";

/** The light page (spec `background`): only just cooler than white, so surfaces separate from it by a small step. */
const LIGHT_PAGE = hex("#f7f9fc");
/** Cards, sheets, popovers and the tab bar (spec `surface`): white, one clear step off the page. */
const LIGHT_CARD = hex("#ffffff");
/** Soft fills (spec `surface-secondary`: secondary buttons, muted chips, the logo chip): #2563eb links on them keep 4.6:1. */
const LIGHT_RAISED = hex("#f0f4f8");
/** Dividers and card edges (spec `border`), and the fill of a selected row and of the subtle primary (`surface-selected`, `primary-subtle`). */
const LIGHT_HAIRLINE = hex("#e2e8f0");
/** Field and outlined-button edges: a soft neutral grey. */
const LIGHT_FIELD = hex("#c7c7c7");
/** Checkbox and radio rings: a stronger grey than the fields, 3:1 on the cards, as a control's edge needs. */
const LIGHT_CONTROL_RING = hex("#8c8c8c");
/** Primary text (spec `text-primary`): a deep blue-slate, 13:1 or more on every light surface. */
const LIGHT_INK = hex("#172033");
/**
 * Secondary text: the spec's `text-secondary` (#64748b) 4% deeper (owner's call, 2026-11-15), the least change that
 * keeps 4.5:1 on the soft fills, where #64748b falls short (4.31:1 on #f0f4f8).
 */
const LIGHT_SECONDARY = hex("#606f85");
/** Default glyphs (spec `icon`): exactly the spec's slate; a glyph needs 3:1, which it keeps on every light surface. */
const LIGHT_ICON = hex("#64748b");
/** Decorative glyphs only (spec `text-tertiary`): 2.4:1, too faint for text (owner's call, 2026-11-15). */
const LIGHT_TERTIARY = hex("#94a3b8");
/** A disabled control's fill (spec `disabled`). */
const LIGHT_DISABLED = hex("#cbd5e1");
/**
 * The light theme's restrained accent blue: focus rings and the lead chart series, 3.3:1 or more on every light
 * surface, as a non-text mark needs. Too light for text, so links stay LIGHT_LINK.
 */
const LIGHT_ACCENT = hex("#3b82f6");
/** The sign-in panel's secondary text, on the slate-800 panel. */
const LIGHT_PANEL_MUTED = hex("#b4c0d0");
/** Light theme buttons and selection (spec `primary`): Tailwind's slate-800, 14:1 under their white text. */
const LIGHT_ACTION = hex("#1e293b");
/** A light solid button while it is pressed (spec `primary-pressed`): slate-900. */
const LIGHT_ACTION_PRESSED = hex("#0f172a");
/** Light status colours (spec `success`, `warning`, `danger`): Tailwind's green-600, amber-600 and red-600. */
const LIGHT_SUCCESS = hex("#16a34a");
const LIGHT_WARNING = hex("#d97706");
const LIGHT_DANGER = hex("#dc2626");
/** Dark theme links and focus: a soft clear blue, 6.8:1 on the graphite cards (#292b2f). */
const DARK_LINK = hex("#8ab4ff");
/** Light theme links and search highlights: Tailwind's blue-600, 4.6:1 or more on every light surface. */
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

/*
 * The phone's dark theme (the mobile visual spec, owner, 2026-11-15): Tailwind's slate family, by elevation.
 */
/** The page (spec `background`). */
const SLATE_PAGE = hex("#111827");
/** Cards, sheets and the tab bar (spec `surface`). */
const SLATE_CARD = hex("#1b2636");
/** Soft fills and popovers (spec `surface-secondary`, also `primary-subtle`): #94a3b8 secondary text keeps 4.8:1 on them. */
const SLATE_RAISED = hex("#263548");
/** Dividers and card edges (spec `border`), and a selected row's fill (spec `surface-selected`). */
const SLATE_HAIRLINE = hex("#334155");
/** Field, outlined-button and checkbox edges: Tailwind's slate-600, a step stronger than the dividers so a control's edge shows. */
const SLATE_CONTROL_EDGE = hex("#475569");
/** Primary text (spec `text-primary`): 9:1 or more on every dark surface. */
const SLATE_INK = hex("#f1f5f9");
/** Secondary text and default glyphs (spec `text-secondary`, `icon`): 4.8:1 or more on every dark surface but a selected row. */
const SLATE_SECONDARY = hex("#94a3b8");
/** Decorative glyphs only (spec `text-tertiary`): too faint for text. */
const SLATE_TERTIARY = hex("#64748b");
/** Buttons, selection and the tab bar's capsule (spec `primary`): white. */
const SLATE_ACTION = hex("#ffffff");
/** A dark solid button while it is pressed (spec `primary-pressed`). */
const SLATE_ACTION_PRESSED = hex("#e2e8f0");
/** The label on a white button (spec `primary-text`): slate-900, 17.9:1. */
const SLATE_ACTION_FOREGROUND = hex("#0f172a");
/** A disabled control's fill (spec `disabled`). */
const SLATE_DISABLED = hex("#475569");
/** Dark status colours (spec `success`, `warning`, `danger`): Tailwind's green-400, amber-400 and red-400. */
const SLATE_SUCCESS = hex("#4ade80");
const SLATE_WARNING = hex("#fbbf24");
const SLATE_DANGER = hex("#f87171");

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
	/** The accent while a button is pressed: one visible step dimmer. */
	readonly primaryPressed: ReturnType<typeof hex>;
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
	primaryPressed: hex("#d9d9d9"),
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
	primaryPressed: hex("#84a9f2"),
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
	primaryPressed: hex("#ddd6ce"),
	primaryForeground: hex("#201d1b"),
	link: hex("#e3b48c"),
	blue: { full: hex("#8eb0f0"), soft: hex("#424754") },
	violet: { full: hex("#c0a6f0"), soft: hex("#4d4554") },
	green: { full: hex("#7ccf9c"), soft: hex("#3e4e42") },
	yellow: { full: hex("#e9b86a"), soft: hex("#564937") },
	red: { full: hex("#ef9488"), soft: hex("#58413d") },
};

/**
 * A palette as theme roles; the generator lays them over the dark theme, which fills in the rest (shadows, the other
 * chart series). The status colours are pinned to the shared dark theme's, so the phone's own dark status colours
 * (the spec's, 2026-11-15) never reach a palette that was tuned without them.
 */
function darkThemeOf(palette: DarkPalette): NonNullable<MobileThemeOverrides["harbour"]> {
	return {
		success: THEMES.dark.success,
		warning: THEMES.dark.warning,
		destructive: THEMES.dark.destructive,
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

/** A code block's colours, by what each piece of code is (the showcase's `text-code-<role>`). */
type CodeColors = Pick<MobileComponentColors["light"], Extract<MobileComponentColorName, `code-${string}`>>;

/**
 * GitHub light, the web's light code theme (packages/ui code-block-highlight.ts): the showcase colours each example
 * at generate time by the role of each GitHub colour, and the phone draws the role from these tokens.
 */
const GITHUB_LIGHT_CODE: CodeColors = {
	"code-plain": hex("#24292e"),
	"code-keyword": hex("#d73a49"),
	"code-function": hex("#6f42c1"),
	"code-constant": hex("#005cc5"),
	"code-string": hex("#032f62"),
	"code-comment": hex("#6a737d"),
	"code-tag": hex("#22863a"),
	"code-parameter": hex("#e36209"),
};

/** GitHub dark, the web's dark code theme: the same roles' colours, for every dark theme. */
const GITHUB_DARK_CODE: CodeColors = {
	"code-plain": hex("#e1e4e8"),
	"code-keyword": hex("#f97583"),
	"code-function": hex("#b392f0"),
	"code-constant": hex("#79b8ff"),
	"code-string": hex("#9ecbff"),
	"code-comment": hex("#6a737d"),
	"code-tag": hex("#85e89d"),
	"code-parameter": hex("#ffab70"),
};

/**
 * A palette's component colours: the tab bar (the card's pill and edge, a capsule in its accent, its secondary text
 * for the icons), and the spec's roles in the palette's own steps: a pressed button its own dimmed accent, selected
 * and subtle fills, decorative glyphs and disabled fills its hairline, glyphs its secondary text.
 */
function darkComponentColorsOf(palette: DarkPalette): MobileComponentColors["harbour"] {
	return {
		"tab-bar": palette.card,
		"tab-bar-border": palette.hairline,
		"tab-bar-active": palette.primary,
		"tab-bar-active-foreground": palette.primaryForeground,
		"tab-bar-icon": palette.muted,
		"control-ring": palette.hairline,
		"logo-tile": paletteColor("gray", "300"),
		"primary-pressed": palette.primaryPressed,
		"primary-subtle": palette.hairline,
		"surface-selected": palette.hairline,
		icon: palette.muted,
		"text-tertiary": palette.hairline,
		disabled: palette.hairline,
		...GITHUB_DARK_CODE,
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
		"primary-foreground": paletteColor("neutral", "0"),
		secondary: LIGHT_RAISED,
		"secondary-foreground": LIGHT_INK,
		muted: LIGHT_RAISED,
		"muted-foreground": LIGHT_SECONDARY,
		accent: LIGHT_RAISED,
		"accent-foreground": LIGHT_INK,
		border: LIGHT_HAIRLINE,
		input: LIGHT_FIELD,
		ring: LIGHT_ACCENT,
		"chart-1": LIGHT_ACCENT,
		"chart-2": paletteColor("warm", "500"),
		"chart-3": LIGHT_CHART_TEAL,
		"chart-4": LIGHT_CHART_VIOLET,
		"chart-5": LIGHT_CHART_SKY,
		sidebar: LIGHT_PAGE,
		"sidebar-foreground": LIGHT_INK,
		"sidebar-primary": LIGHT_ACTION,
		"sidebar-primary-foreground": paletteColor("neutral", "0"),
		"sidebar-accent": LIGHT_RAISED,
		"sidebar-accent-foreground": LIGHT_INK,
		"sidebar-border": LIGHT_HAIRLINE,
		"sidebar-ring": LIGHT_ACCENT,
		"sidebar-active": LIGHT_ACTION,
		"sidebar-active-foreground": paletteColor("neutral", "0"),
		"sidebar-active-border": LIGHT_ACTION,
		"search-mark-bg": LIGHT_LINK,
		"search-mark-fg": paletteColor("gray", "25"),
		"shadow-ambient": LIGHT_SHADOW_AMBIENT,
		"shadow-key": LIGHT_SHADOW_KEY,
		success: LIGHT_SUCCESS,
		warning: LIGHT_WARNING,
		destructive: LIGHT_DANGER,
		"warning-soft": LIGHT_WARNING_SOFT,
		"tone-yellow-soft": LIGHT_YELLOW_SOFT,
		link: LIGHT_LINK,
		"auth-panel": LIGHT_ACTION,
		"auth-panel-muted": LIGHT_PANEL_MUTED,
	},
	/* Graphite's tints, shadows and chart series; every surface, text, action and status role the spec's slate. */
	dark: {
		...GRAPHITE_DARK_THEME,
		background: SLATE_PAGE,
		foreground: SLATE_INK,
		card: SLATE_CARD,
		"card-foreground": SLATE_INK,
		popover: SLATE_RAISED,
		"popover-foreground": SLATE_INK,
		topbar: SLATE_PAGE,
		"shell-frame": SLATE_PAGE,
		"shell-panel": SLATE_PAGE,
		sheet: SLATE_CARD,
		primary: SLATE_ACTION,
		"primary-foreground": SLATE_ACTION_FOREGROUND,
		secondary: SLATE_RAISED,
		"secondary-foreground": SLATE_INK,
		muted: SLATE_RAISED,
		"muted-foreground": SLATE_SECONDARY,
		accent: SLATE_RAISED,
		"accent-foreground": SLATE_INK,
		border: SLATE_HAIRLINE,
		input: SLATE_CONTROL_EDGE,
		success: SLATE_SUCCESS,
		warning: SLATE_WARNING,
		destructive: SLATE_DANGER,
		sidebar: SLATE_PAGE,
		"sidebar-foreground": SLATE_INK,
		"sidebar-primary": SLATE_ACTION,
		"sidebar-primary-foreground": SLATE_ACTION_FOREGROUND,
		"sidebar-accent": SLATE_HAIRLINE,
		"sidebar-accent-foreground": SLATE_INK,
		"sidebar-border": SLATE_HAIRLINE,
		"sidebar-active": SLATE_ACTION,
		"sidebar-active-foreground": SLATE_ACTION_FOREGROUND,
		"sidebar-active-border": SLATE_ACTION,
		"search-mark-fg": SLATE_PAGE,
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
 * The phone's component colours, so redesigning the rest of the app never moves them by accident.
 * The floating tab bar: light and dark follow the mobile visual spec (owner, 2026-11-15) — a surface pill with a
 * border edge, a capsule in `primary` and icons in the spec's `icon` slate; Nord the editor slate's card pill and
 * hairline with a white capsule. Change them only to change the bar. `logo-tile` is the light chip under a
 * language's ORIGINAL (full-colour) logo in every theme, so a brand's own colours read whatever the surface (Rust's
 * and Markdown's are near-black). Fields have no fill of their own: they take the surface they sit on (owner,
 * 2026-11-15; packages/ui-native lib/field-surface.ts), so the spec's `surface-input` is not a token. The spec's own
 * roles: `primary-pressed` (a solid button while pressed), `primary-subtle` and `surface-selected` (subtle and
 * selected fills), `icon` (default glyphs), `text-tertiary` (decorative glyphs only, never text: too faint for
 * 4.5:1) and `disabled` (a disabled control's fill). `code-*` colour code by what it is, the web's GitHub light and
 * dark code themes (light, and every dark theme).
 */
export const MOBILE_COMPONENT_COLORS: MobileComponentColors = {
	light: {
		"tab-bar": LIGHT_CARD,
		"tab-bar-border": LIGHT_HAIRLINE,
		"tab-bar-active": LIGHT_ACTION,
		"tab-bar-active-foreground": paletteColor("neutral", "0"),
		"tab-bar-icon": LIGHT_ICON,
		"control-ring": LIGHT_CONTROL_RING,
		"logo-tile": LIGHT_RAISED,
		"primary-pressed": LIGHT_ACTION_PRESSED,
		"primary-subtle": LIGHT_HAIRLINE,
		"surface-selected": LIGHT_HAIRLINE,
		icon: LIGHT_ICON,
		"text-tertiary": LIGHT_TERTIARY,
		disabled: LIGHT_DISABLED,
		...GITHUB_LIGHT_CODE,
	},
	dark: {
		"tab-bar": SLATE_CARD,
		"tab-bar-border": SLATE_HAIRLINE,
		"tab-bar-active": SLATE_ACTION,
		"tab-bar-active-foreground": SLATE_ACTION_FOREGROUND,
		"tab-bar-icon": SLATE_SECONDARY,
		"control-ring": SLATE_CONTROL_EDGE,
		"logo-tile": paletteColor("gray", "300"),
		"primary-pressed": SLATE_ACTION_PRESSED,
		"primary-subtle": SLATE_RAISED,
		"surface-selected": SLATE_HAIRLINE,
		icon: SLATE_SECONDARY,
		"text-tertiary": SLATE_TERTIARY,
		disabled: SLATE_DISABLED,
		...GITHUB_DARK_CODE,
	},
	nord: {
		"tab-bar": paletteColor("dusk", "800"),
		"tab-bar-border": paletteColor("dusk", "700"),
		"tab-bar-active": paletteColor("neutral", "0"),
		"tab-bar-active-foreground": paletteColor("dusk", "950"),
		"tab-bar-icon": paletteColor("dusk", "200"),
		"control-ring": paletteColor("dusk", "600"),
		"logo-tile": paletteColor("dusk", "25"),
		"primary-pressed": paletteColor("dusk", "50"),
		"primary-subtle": paletteColor("dusk", "700"),
		"surface-selected": paletteColor("dusk", "700"),
		icon: paletteColor("dusk", "200"),
		"text-tertiary": paletteColor("dusk", "600"),
		disabled: paletteColor("dusk", "700"),
		...GITHUB_DARK_CODE,
	},
	"current-dark": darkComponentColorsOf(CURRENT_DARK_PALETTE),
	harbour: darkComponentColorsOf(HARBOUR_PALETTE),
	mocha: darkComponentColorsOf(MOCHA_PALETTE),
};
