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
import { colorToken, hex, oklch, paletteColor, TRANSPARENT } from "./value";

/*
 * Light theme — layered: a cool #F1F4F9 canvas (`background`, neutral-50)
 * shared by the page and topbar; the sidebar sits a half step lighter
 * (neutral-40, same cool cast) so the navigation reads as its own panel yet
 * blends in; near-white cards (neutral-25, the canvas's cool hue — never pure
 * white) and white popovers lift off it. Cards and popovers carry one
 * soft ink-tinted shadow (`shadow-*`), never a grey `rgba(0,0,0,.1)`. The
 * active nav row is a solid accent pill (slate here; web blue and merchant
 * green in their themes).
 */
export const LIGHT_THEME: Theme = {
	background: paletteColor("neutral", "50"),
	foreground: paletteColor("neutral", "900"),
	card: paletteColor("neutral", "25"),
	"card-foreground": paletteColor("neutral", "900"),
	popover: paletteColor("neutral", "0"),
	"popover-foreground": paletteColor("neutral", "900"),
	/* The app-shell topbar — same canvas as the page in light, the page surface in dark. */
	topbar: paletteColor("neutral", "50"),
	/*
	 * An inset app shell (admin, app shell 3): the frame the sidebar sits on, and the floating page
	 * panel beside it. Light: no pure white in the chrome — the frame is the sidebar's half-step tone
	 * (#F5F7FB), the same cool hue as the #F1F4F9 canvas of the panel, so the two blend and the panel's
	 * soft border marks the edge; cards are the near-white neutral-25.
	 */
	"shell-frame": paletteColor("neutral", "40"),
	"shell-panel": paletteColor("neutral", "50"),
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
	/* ReUI's `focus` status (badge `focus` variants): a violet, distinct from `info` blue. */
	focus: oklch(0.606, 0.25, 292.717),
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
	/* Shell dividers (sidebar footer, topbar edge): one step past the card border, so chrome reads as quieter structure than content edges — never a dark rule on the canvas. */
	"sidebar-border": paletteColor("neutral", "300"),
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
	/* The auth screens' brand panel: deep slate with a slate gradient (web and merchant re-map the hue). */
	"auth-panel": paletteColor("brand", "950"),
	"auth-panel-muted": paletteColor("brand", "300"),
	"auth-brand-from": paletteColor("brand", "600"),
	"auth-brand-to": paletteColor("brand", "800"),
	/* Links: the accent, as text (AA on every surface a link sits on). */
	link: paletteColor("brand", "800"),
};

/*
 * Dark theme — cool ink: every surface carries the same faint blue-black cast
 * (hue 258), with elevation by lightness. The sidebar, page and topbar share one
 * neutral surface (ink-850); cards lift off it (ink-750); popovers and menus
 * float above cards (ink-700). Borders use a darker step (ink-650) for clear
 * chrome dividers. Accent colour is reserved for the active nav pill and actions
 * (slate on admin; web and merchant re-map their pill to blue / green). An inset
 * shell's frame steps below the page surface (ink-950). No drop
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
	/* Inset shell, dark: the frame steps down below the page surface; the panel is the page surface, cards lift off it. */
	"shell-frame": paletteColor("ink", "950"),
	"shell-panel": paletteColor("ink", "850"),
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
	focus: oklch(0.702, 0.183, 293.541),
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
	/* Shell dividers share the card border's step: on the ink-850 shell a lighter step read as a bright rule. */
	"sidebar-border": paletteColor("ink", "650"),
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
	/* The auth screens' brand panel: deep slate with a slate gradient (web and merchant re-map the hue). */
	"auth-panel": paletteColor("brand", "950"),
	"auth-panel-muted": paletteColor("brand", "300"),
	"auth-brand-from": paletteColor("brand", "600"),
	"auth-brand-to": paletteColor("brand", "800"),
	link: paletteColor("brand", "100"),
};

/*
 * Nord theme (nordtheme.com) — a third, dark theme. Surfaces are Nord's Polar
 * Night with elevation by lightness: page, topbar and sidebar nord0, cards
 * nord1, popovers nord2, an inset shell's frame a step below nord0. Text is Snow
 * Storm (nord6 headings and body, a dimmed nord4 for secondary text). The
 * accent is Frost blue, filled VIVID (palette `vivid-9`: nord9 with ~1.9× the
 * colour — Nord's pastels read as disabled on a button); web re-maps it to
 * vivid-8 (frost cyan) and merchant to vivid-14 (aurora green), in
 * `.nord .<app>-app` in each app's theme.
 * Status colours and charts are Aurora.
 *
 * Nord's own accents are not all legible as TEXT on its dark surfaces (Aurora
 * red #bf616a is 3.05:1 on nord0). Wherever a token is text, the Nord hue is
 * lightened toward nord6 by the least amount that reaches WCAG AA on its fill
 * (`hex()` values below, each named after the Nord colour it comes from); fills,
 * charts and status marks keep the published colours.
 */
export const NORD_THEME: Theme = {
	background: paletteColor("nord", "0"),
	foreground: paletteColor("nord", "6"),
	card: paletteColor("nord", "1"),
	"card-foreground": paletteColor("nord", "6"),
	popover: paletteColor("nord", "2"),
	"popover-foreground": paletteColor("nord", "6"),
	topbar: paletteColor("nord", "0"),
	/* nord0 darkened 15% toward black: the inset shell's frame sits below the page, as in the dark theme. */
	"shell-frame": hex("#272c36"),
	"shell-panel": paletteColor("nord", "0"),
	primary: paletteColor("vivid", "9"),
	"primary-foreground": paletteColor("nord", "0"),
	secondary: paletteColor("nord", "2"),
	"secondary-foreground": paletteColor("nord", "6"),
	muted: paletteColor("nord", "2"),
	/* nord4 dimmed toward nord3 until 4.7:1 on nord2 — quieter than body text, still AA on every surface. */
	"muted-foreground": hex("#b9c0cd"),
	accent: paletteColor("nord", "2"),
	"accent-foreground": paletteColor("nord", "6"),
	destructive: paletteColor("nord", "11"),
	success: paletteColor("nord", "14"),
	warning: paletteColor("nord", "13"),
	info: paletteColor("nord", "10"),
	focus: paletteColor("nord", "15"),
	/* Soft fills: 20% of the Aurora / Frost colour over nord0. */
	"destructive-soft": hex("#4b3d48"),
	"success-soft": hex("#45504f"),
	"warning-soft": hex("#54524f"),
	"info-soft": hex("#384356"),
	/* Tones: text (the Nord colour, lightened toward nord6 only as far as AA needs) on its 20% soft fill. */
	"tone-green": hex("#b2c8a1"),
	"tone-green-soft": hex("#45504f"),
	"tone-blue": hex("#a8bdd3"),
	"tone-blue-soft": hex("#3f4a5a"),
	"tone-yellow": paletteColor("nord", "13"),
	"tone-yellow-soft": hex("#54524f"),
	"tone-red": hex("#d4a2a9"),
	"tone-red-soft": hex("#4b3d48"),
	"tone-orange": hex("#dbafa2"),
	"tone-orange-soft": hex("#4e454a"),
	"tone-teal": hex("#a3c7c8"),
	"tone-teal-soft": hex("#414f59"),
	"tone-violet": hex("#c8b1c7"),
	"tone-violet-soft": hex("#494656"),
	"tier-bronze": hex("#dbafa2"),
	"tier-bronze-soft": hex("#4e454a"),
	"tier-silver": paletteColor("nord", "4"),
	"tier-silver-soft": hex("#505662"),
	"tier-gold": paletteColor("nord", "13"),
	"tier-gold-soft": hex("#54524f"),
	"tier-platinum": hex("#c8b1c7"),
	"tier-platinum-soft": hex("#494656"),
	reward: colorToken("tier-gold"),
	"reward-soft": colorToken("tier-gold-soft"),
	"reward-solid": paletteColor("nord", "13"),
	"reward-solid-foreground": paletteColor("nord", "0"),
	border: paletteColor("nord", "3"),
	/* nord3 lifted 10% toward nord4: inputs read a step firmer than borders. */
	input: hex("#5a6477"),
	ring: paletteColor("vivid", "9"),
	/* Frost blue, Aurora orange (hue, not just lightness, apart), Frost teal, Aurora yellow, Aurora purple — all ≥ 3:1 on cards and popovers. */
	"chart-1": paletteColor("vivid", "9"),
	"chart-2": paletteColor("nord", "12"),
	"chart-3": paletteColor("nord", "7"),
	"chart-4": paletteColor("nord", "13"),
	"chart-5": paletteColor("nord", "15"),
	sidebar: paletteColor("nord", "0"),
	"sidebar-foreground": paletteColor("nord", "4"),
	"sidebar-primary": paletteColor("vivid", "9"),
	"sidebar-primary-foreground": paletteColor("nord", "0"),
	"sidebar-accent": paletteColor("nord", "1"),
	"sidebar-accent-foreground": paletteColor("nord", "6"),
	"sidebar-border": paletteColor("nord", "2"),
	"sidebar-ring": paletteColor("vivid", "9"),
	/* Active nav row: a solid vivid Frost pill with Polar Night text (web / merchant re-map the hue). */
	"sidebar-active": paletteColor("vivid", "9"),
	"sidebar-active-foreground": paletteColor("nord", "0"),
	"sidebar-active-border": paletteColor("vivid", "9"),
	"search-mark-bg": paletteColor("nord", "13"),
	"search-mark-fg": paletteColor("nord", "0"),
	"shadow-ambient": oklch(0, 0, 0, 0.25),
	"shadow-key": oklch(0, 0, 0, 0.45),
	"edge-highlight": oklch(1, 0, 0, 0.04),
	/* The auth screens' brand panel: a Polar Night card, Snow Storm secondary text, a Frost gradient. */
	"auth-panel": paletteColor("nord", "1"),
	"auth-panel-muted": paletteColor("nord", "4"),
	"auth-brand-from": paletteColor("vivid", "9"),
	"auth-brand-to": paletteColor("nord", "10"),
	/* Links: Frost cyan nord8 lightened 12% toward nord6 — AA on every Nord surface (4.64:1 on nord2 and up), and never the near-white of body text. */
	link: hex("#94c6d4"),
};

/** Every theme. Adding a theme name to `ThemeNameSchema` makes this a compile error until the theme exists. */
export const THEMES: Themes = {
	light: LIGHT_THEME,
	dark: DARK_THEME,
	nord: NORD_THEME,
};

/** Colour tokens declared once for every theme (the web writes them in `:root` only). */
export const SHARED_COLORS: SharedColors = {
	/* Text on the auth screens' brand panel (the panel itself is themed). */
	"auth-panel-foreground": paletteColor("neutral", "0"),
	/* The app's launch screen (the Expo app's native splash and its in-app hand-off, the app icon): slate in every theme, so launching looks the same in light and dark. */
	splash: paletteColor("brand", "800"),
	"splash-foreground": paletteColor("neutral", "0"),
	"print-foreground": oklch(0.21, 0.034, 264.665),
	"print-border": oklch(0.928, 0.006, 264.531),
	"print-header-bg": oklch(0.967, 0.003, 264.542),
	"print-row-alt": oklch(0.985, 0.002, 247.839),
	/* QR codes stay pure black on white in every theme — scanners need maximum contrast. */
	"qr-background": oklch(1, 0, 0),
	"qr-foreground": oklch(0, 0, 0),
	/*
	 * Search matches drawn over a document page (the PDF viewer). A rendered page is white in every
	 * theme, so the highlighter is the same yellow in every theme too, painted with multiply blending:
	 * the white paper turns yellow and the black print stays black. The match on show is the
	 * stronger yellow; the others are paler.
	 */
	"document-match": oklch(0.95, 0.11, 100),
	"document-match-active": oklch(0.89, 0.18, 97),
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
	"focus-foreground": colorToken("tone-violet"),
	"destructive-foreground": colorToken("tone-red"),
	invert: colorToken("foreground"),
	"invert-foreground": colorToken("background"),
	"status-foreground": oklch(0.985, 0, 0),
	/* Modal backdrop tint — black in both themes, so a backdrop dims the page in dark mode too. */
	scrim: oklch(0, 0, 0),
	/* Text and controls drawn over the scrim or a live camera feed (the QR scanner) — white in both themes. */
	"scrim-foreground": oklch(1, 0, 0),
};
