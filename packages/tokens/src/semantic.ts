// ============================================
// semantic.ts — semantic colour tokens per theme
// ============================================
// Every colour here maps onto a palette primitive (palette.ts) or is a tuned
// semantic value (status, tone, tier). Components read only these tokens.
// Both themes are typed `Theme` — a record over the ONE role list in schema.ts
// (`ThemeRoleSchema`) — so a theme that misses a role does not compile.
//
// The `--<role>` names are the web's existing variable names; app themes
// (`apps/*/app/*-theme.css`) re-map only their brand and sidebar tokens
// (`APP_BRAND_TOKENS` in packages/ui color-contrast.ts, enforced by each app's
// theme test). Every text pair meets WCAG AA and every ring / chart series /
// search highlight meets the 3:1 non-text minimum on every surface
// (packages/ui src/styles/tokens-contrast.test.ts).

import type { SharedColors, Theme, Themes } from "./schema";
import { colorToken, oklch, paletteColor, TRANSPARENT } from "./value";

/*
 * Light theme — layered: a cool #F1F4F9 canvas (`background`, neutral-50)
 * shared by the page and topbar; the sidebar sits a half step lighter
 * (neutral-40, same cool cast) so the navigation reads as its own panel yet
 * blends in; white cards and popovers lift off it. Cards and popovers carry one
 * soft ink-tinted shadow (`shadow-*`), never a grey `rgba(0,0,0,.1)`. The
 * active nav row is a solid accent pill (slate here; web blue and merchant
 * green in their themes).
 */
export const LIGHT_THEME: Theme = {
	background: paletteColor("neutral", "50"),
	foreground: paletteColor("neutral", "900"),
	card: paletteColor("neutral", "0"),
	"card-foreground": paletteColor("neutral", "900"),
	popover: paletteColor("neutral", "0"),
	"popover-foreground": paletteColor("neutral", "900"),
	/* The app-shell topbar — same canvas as the page in light, the page surface in dark. */
	topbar: paletteColor("neutral", "50"),
	primary: paletteColor("brand", "800"),
	"primary-foreground": paletteColor("neutral", "0"),
	secondary: paletteColor("neutral", "100"),
	"secondary-foreground": paletteColor("neutral", "900"),
	muted: paletteColor("neutral", "100"),
	"muted-foreground": paletteColor("neutral", "600"),
	accent: paletteColor("neutral", "100"),
	"accent-foreground": paletteColor("neutral", "900"),
	destructive: oklch(0.577, 0.245, 27.325),
	success: oklch(0.627, 0.17, 149.214),
	warning: oklch(0.723, 0.148, 71.953),
	info: oklch(0.623, 0.146, 252.062),
	"destructive-soft": oklch(0.93, 0.04, 27),
	"success-soft": oklch(0.92, 0.05, 149),
	"warning-soft": oklch(0.94, 0.05, 84),
	"info-soft": oklch(0.92, 0.04, 250),
	/*
	 * Tone palette — categorical chips and badges (method, status, device…).
	 * Each tone is a text colour on its own soft fill; every pair meets WCAG AA
	 * text contrast (4.5:1) in both themes.
	 */
	"tone-green": oklch(0.44, 0.12, 150),
	"tone-green-soft": oklch(0.95, 0.05, 150),
	"tone-blue": oklch(0.46, 0.16, 258),
	"tone-blue-soft": oklch(0.94, 0.04, 250),
	"tone-yellow": oklch(0.46, 0.1, 80),
	"tone-yellow-soft": oklch(0.96, 0.08, 98),
	"tone-red": oklch(0.49, 0.19, 27),
	"tone-red-soft": oklch(0.94, 0.04, 25),
	"tone-orange": oklch(0.49, 0.14, 48),
	"tone-orange-soft": oklch(0.95, 0.05, 60),
	"tone-teal": oklch(0.45, 0.08, 190),
	"tone-teal-soft": oklch(0.95, 0.04, 185),
	"tone-violet": oklch(0.47, 0.18, 295),
	"tone-violet-soft": oklch(0.95, 0.04, 295),
	/*
	 * Reward tiers — the one place the rewards domain lives in the shared
	 * tokens (a non-rewards product built on this kit simply never reads them).
	 * Each `tier-X` is text on its own `tier-X-soft` fill, AA in both themes.
	 * Platinum carries a lavender cast so it never reads as a second silver.
	 * `reward` is the generic "points" colour (gold); `reward-solid` is the
	 * celebratory fill for "you earned it" moments, with
	 * `reward-solid-foreground` text on it.
	 */
	"tier-bronze": oklch(0.47, 0.11, 50),
	"tier-bronze-soft": oklch(0.95, 0.035, 55),
	"tier-silver": oklch(0.45, 0.02, 258),
	"tier-silver-soft": oklch(0.95, 0.008, 258),
	"tier-gold": oklch(0.47, 0.1, 80),
	"tier-gold-soft": oklch(0.95, 0.06, 90),
	"tier-platinum": oklch(0.45, 0.07, 290),
	"tier-platinum-soft": oklch(0.95, 0.025, 290),
	reward: colorToken("tier-gold"),
	"reward-soft": colorToken("tier-gold-soft"),
	"reward-solid": oklch(0.8, 0.15, 82),
	"reward-solid-foreground": oklch(0.28, 0.05, 70),
	border: paletteColor("neutral", "200"),
	input: paletteColor("neutral", "300"),
	/* Non-text contrast (WCAG 1.4.11, ≥ 3:1 on every surface). */
	ring: paletteColor("brand", "600"),
	/*
	 * Chart series — deep slate, a kopi-amber counter-colour, mid slate, deep
	 * amber and grey. Slots 1↔2 (the pair two-series charts use) differ in hue,
	 * not just lightness. Every slot is ≥ 3:1 on cards and popovers; the chart
	 * primitives still add a dash + marker (lines) and a hatch (bars) per slot so
	 * colour never carries identity alone — packages/ui lib/charts/chart-encodings.ts.
	 */
	"chart-1": paletteColor("brand", "800"),
	"chart-2": paletteColor("warm", "500"),
	"chart-3": paletteColor("brand", "500"),
	"chart-4": paletteColor("warm", "700"),
	"chart-5": paletteColor("neutral", "600"),
	/* A half step lighter than the canvas — noticeable, but it blends with the content. */
	sidebar: paletteColor("neutral", "40"),
	"sidebar-foreground": paletteColor("neutral", "800"),
	"sidebar-primary": paletteColor("brand", "800"),
	"sidebar-primary-foreground": paletteColor("neutral", "0"),
	"sidebar-accent": paletteColor("neutral", "100"),
	"sidebar-accent-foreground": paletteColor("neutral", "900"),
	"sidebar-border": paletteColor("neutral", "400"),
	"sidebar-ring": paletteColor("brand", "600"),
	/* Active nav row: a solid slate pill — row, hairline and icon chip read as one shape with white text. */
	"sidebar-active": paletteColor("brand", "800"),
	"sidebar-active-foreground": paletteColor("neutral", "0"),
	"sidebar-active-border": paletteColor("brand", "800"),
	/* The match highlight stands out from the sidebar (≥ 3:1) and its text reads on it (≥ 4.5:1). */
	"search-mark-bg": paletteColor("brand", "600"),
	"search-mark-fg": paletteColor("neutral", "0"),
	/*
	 * Elevation. The `shadow-*` scale (tailwind-theme.ts) reads these two
	 * colours, so one swap per theme restyles every shadow while
	 * `shadow-<color>/N` modifiers keep working. Light: ink-tinted, soft.
	 * `edge-highlight` is the dark theme's top-edge light on cards
	 * (`inset-shadow-edge`); none in light.
	 */
	"shadow-ambient": oklch(0.24, 0.02, 258, 0.06),
	"shadow-key": oklch(0.24, 0.02, 258, 0.1),
	"edge-highlight": TRANSPARENT,
};

/*
 * Dark theme — cool ink: every surface carries the same faint blue-black cast
 * (hue 258), with elevation by lightness. The sidebar, page and topbar share one
 * neutral surface (ink-850); cards lift off it (ink-750); popovers and menus
 * float above cards (ink-700). Borders use a darker step (ink-650) for clear
 * chrome dividers. Accent colour is reserved for the active nav pill and actions
 * (slate on admin; web and merchant re-map their pill to blue / green). No drop
 * shadows to speak of — depth comes from lightness plus a faint top-edge
 * highlight on cards; only floating layers keep a deep shadow.
 */
export const DARK_THEME: Theme = {
	background: paletteColor("ink", "850"),
	foreground: paletteColor("ink", "50"),
	card: paletteColor("ink", "750"),
	"card-foreground": paletteColor("ink", "50"),
	popover: paletteColor("ink", "700"),
	"popover-foreground": paletteColor("ink", "50"),
	topbar: paletteColor("ink", "850"),
	primary: paletteColor("brand", "100"),
	"primary-foreground": paletteColor("brand", "950"),
	secondary: paletteColor("ink", "700"),
	"secondary-foreground": paletteColor("ink", "50"),
	muted: paletteColor("ink", "700"),
	"muted-foreground": paletteColor("ink", "400"),
	accent: paletteColor("ink", "700"),
	"accent-foreground": paletteColor("ink", "50"),
	destructive: oklch(0.704, 0.191, 22.216),
	success: oklch(0.723, 0.219, 149.579),
	warning: oklch(0.828, 0.189, 84.429),
	info: oklch(0.685, 0.169, 237.323),
	"destructive-soft": oklch(0.33, 0.06, 27),
	"success-soft": oklch(0.33, 0.05, 149),
	"warning-soft": oklch(0.34, 0.05, 84),
	"info-soft": oklch(0.33, 0.05, 250),
	"tone-green": oklch(0.86, 0.13, 150),
	"tone-green-soft": oklch(0.34, 0.06, 150),
	"tone-blue": oklch(0.84, 0.09, 250),
	"tone-blue-soft": oklch(0.34, 0.07, 255),
	"tone-yellow": oklch(0.89, 0.13, 95),
	"tone-yellow-soft": oklch(0.36, 0.06, 90),
	"tone-red": oklch(0.84, 0.09, 22),
	"tone-red-soft": oklch(0.35, 0.08, 25),
	"tone-orange": oklch(0.86, 0.1, 60),
	"tone-orange-soft": oklch(0.36, 0.07, 50),
	"tone-teal": oklch(0.87, 0.09, 185),
	"tone-teal-soft": oklch(0.34, 0.05, 190),
	"tone-violet": oklch(0.85, 0.09, 295),
	"tone-violet-soft": oklch(0.35, 0.08, 295),
	"tier-bronze": oklch(0.83, 0.09, 55),
	"tier-bronze-soft": oklch(0.33, 0.05, 50),
	"tier-silver": oklch(0.85, 0.015, 258),
	"tier-silver-soft": oklch(0.33, 0.015, 258),
	"tier-gold": oklch(0.87, 0.13, 88),
	"tier-gold-soft": oklch(0.33, 0.06, 85),
	"tier-platinum": oklch(0.85, 0.05, 290),
	"tier-platinum-soft": oklch(0.33, 0.04, 290),
	reward: colorToken("tier-gold"),
	"reward-soft": colorToken("tier-gold-soft"),
	"reward-solid": oklch(0.82, 0.15, 84),
	"reward-solid-foreground": oklch(0.26, 0.05, 70),
	border: paletteColor("ink", "650"),
	input: paletteColor("ink", "600"),
	ring: paletteColor("brand", "300"),
	"chart-1": paletteColor("brand", "200"),
	"chart-2": paletteColor("warm", "300"),
	"chart-3": paletteColor("brand", "400"),
	"chart-4": paletteColor("warm", "500"),
	"chart-5": paletteColor("ink", "400"),
	sidebar: paletteColor("ink", "850"),
	"sidebar-foreground": paletteColor("ink", "200"),
	"sidebar-primary": paletteColor("brand", "600"),
	"sidebar-primary-foreground": paletteColor("neutral", "0"),
	"sidebar-accent": paletteColor("ink", "750"),
	"sidebar-accent-foreground": paletteColor("ink", "50"),
	"sidebar-border": paletteColor("ink", "600"),
	"sidebar-ring": paletteColor("brand", "300"),
	/* Active nav row: solid slate pill (web / merchant re-map to blue / green in their themes). */
	"sidebar-active": paletteColor("brand", "600"),
	"sidebar-active-foreground": paletteColor("neutral", "0"),
	"sidebar-active-border": paletteColor("brand", "600"),
	"search-mark-bg": paletteColor("warm", "300"),
	"search-mark-fg": paletteColor("ink", "950"),
	"shadow-ambient": oklch(0, 0, 0, 0.25),
	"shadow-key": oklch(0, 0, 0, 0.45),
	"edge-highlight": oklch(1, 0, 0, 0.05),
};

/** Every theme. Adding a theme name to `ThemeNameSchema` makes this a compile error until the theme exists. */
export const THEMES: Themes = {
	light: LIGHT_THEME,
	dark: DARK_THEME,
};

/** Colour tokens declared once for every theme (the web writes them in `:root` only). */
export const SHARED_COLORS: SharedColors = {
	/* Auth screens' brand panel. */
	"auth-panel": paletteColor("brand", "950"),
	"auth-panel-muted": paletteColor("brand", "300"),
	"auth-panel-foreground": paletteColor("neutral", "0"),
	"auth-brand-from": paletteColor("brand", "600"),
	"auth-brand-to": paletteColor("brand", "800"),
	"print-foreground": oklch(0.21, 0.034, 264.665),
	"print-border": oklch(0.928, 0.006, 264.531),
	"print-header-bg": oklch(0.967, 0.003, 264.542),
	"print-row-alt": oklch(0.985, 0.002, 247.839),
	/* QR codes stay pure black on white in every theme — scanners need maximum contrast. */
	"qr-background": oklch(1, 0, 0),
	"qr-foreground": oklch(0, 0, 0),
	/*
	 * ReUI status contract (badge, alert): `<status>-foreground` is the text
	 * colour on a light `<status>` tint — aliased to the tone palette, so it
	 * inherits its AA contrast and its dark-theme values. `invert` is the theme's
	 * own foreground/background swapped. `status-foreground` is the text on a
	 * solid status fill, the same in both themes.
	 */
	"success-foreground": colorToken("tone-green"),
	"warning-foreground": colorToken("tone-yellow"),
	"info-foreground": colorToken("tone-blue"),
	"destructive-foreground": colorToken("tone-red"),
	invert: colorToken("foreground"),
	"invert-foreground": colorToken("background"),
	"status-foreground": oklch(0.985, 0, 0),
	/* Modal backdrop tint — black in both themes, so a backdrop dims the page in dark mode too. */
	scrim: oklch(0, 0, 0),
};
