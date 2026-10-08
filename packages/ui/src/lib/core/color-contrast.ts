// WCAG 2.x contrast for the colour notations the design tokens use (`oklch(L C h)`
// and `#rrggbb`). Lets token tests prove every pairing meets its minimum instead
// of trusting a hand calculation in a comment.

import { z } from "zod";

/** WCAG 1.4.3 — normal text on its background. */
export const MIN_TEXT_CONTRAST = 4.5;

/** WCAG 1.4.11 — focus indicators, chart series and other meaningful non-text marks. */
export const MIN_NON_TEXT_CONTRAST = 3;

/** WCAG relative-luminance offset for flare (the 0.05 in `(L1 + 0.05) / (L2 + 0.05)`). */
const LUMINANCE_FLARE = 0.05;

const OKLCH_PATTERN = /^oklch\(\s*(?<lightness>[\d.]+)\s+(?<chroma>[\d.]+)\s+(?<hue>[\d.]+)\s*\)$/u;
const HEX_PATTERN = /^#(?<red>[0-9a-f]{2})(?<green>[0-9a-f]{2})(?<blue>[0-9a-f]{2})$/iu;
const HEX_RADIX = 16;
const BYTE_MAX = 255;
const DEGREES_PER_HALF_TURN = 180;

const ChannelSchema = z.coerce.number();

function clampUnit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Rec. 709 luminance of LINEAR sRGB channels, clipped to the sRGB gamut. */
function luminanceOfLinear(red: number, green: number, blue: number): number {
	return 0.2126 * clampUnit(red) + 0.7152 * clampUnit(green) + 0.0722 * clampUnit(blue);
}

/** OKLCH → OKLab → linear sRGB (Björn Ottosson's reference matrices) → luminance. */
function oklchLuminance(lightness: number, chroma: number, hueDegrees: number): number {
	const hue = (hueDegrees * Math.PI) / DEGREES_PER_HALF_TURN;
	const a = chroma * Math.cos(hue);
	const b = chroma * Math.sin(hue);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return luminanceOfLinear(
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	);
}

function srgbChannelToLinear(byte: number): number {
	const value = byte / BYTE_MAX;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (0–1) of an `oklch(L C h)` or `#rrggbb` colour. Throws on any other notation. */
export function relativeLuminance(color: string): number {
	const oklch = OKLCH_PATTERN.exec(color.trim());
	if (oklch !== null) {
		return oklchLuminance(ChannelSchema.parse(oklch.groups?.lightness), ChannelSchema.parse(oklch.groups?.chroma), ChannelSchema.parse(oklch.groups?.hue));
	}
	const hex = HEX_PATTERN.exec(color.trim());
	if (hex !== null) {
		const [red, green, blue] = [hex.groups?.red, hex.groups?.green, hex.groups?.blue].map((pair) => srgbChannelToLinear(Number.parseInt(pair ?? "", HEX_RADIX)));
		return luminanceOfLinear(red ?? 0, green ?? 0, blue ?? 0);
	}
	throw new Error(`Unsupported colour notation: ${color}`);
}

/** WCAG contrast ratio (1–21) between two colours. */
export function contrastRatio(first: string, second: string): number {
	const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((left, right) => right - left);
	return ((lighter ?? 0) + LUMINANCE_FLARE) / ((darker ?? 0) + LUMINANCE_FLARE);
}

/** The custom properties declared directly in `selector { … }` of a stylesheet, `var(--x)` references resolved against `fallback`. */
export function readCustomProperties(css: string, selector: string, fallback: ReadonlyMap<string, string> = new Map()): ReadonlyMap<string, string> {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	const block = new RegExp(`(?:^|\\n)${escaped}\\s*\\{(?<body>[^}]*)\\}`, "u").exec(css)?.groups?.body;
	if (block === undefined) {
		throw new Error(`No "${selector}" block in the stylesheet`);
	}
	const properties = new Map(fallback);
	for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/gu)) {
		const [, name, rawValue] = match;
		if (name !== undefined && rawValue !== undefined) {
			const reference = /^var\((?<name>--[\w-]+)\)$/u.exec(rawValue.trim())?.groups?.name;
			properties.set(name, reference !== undefined ? (properties.get(reference) ?? rawValue.trim()) : rawValue.trim());
		}
	}
	return properties;
}

/**
 * The tokens an app theme may re-map to carry its brand hue — actions, focus, the active nav item,
 * charts, the search highlight, the auth panel, and the sidebar's own surfaces (in dark mode each
 * app's sidebar is a deep panel tinted with its accent). Page and card surfaces, borders and text
 * are shared by every app and never overridden.
 */
export const APP_BRAND_TOKENS: readonly string[] = [
	"--primary",
	"--primary-foreground",
	"--ring",
	"--sidebar",
	"--sidebar-accent",
	"--sidebar-border",
	"--sidebar-primary",
	"--sidebar-primary-foreground",
	"--sidebar-ring",
	"--sidebar-active",
	"--sidebar-active-foreground",
	"--sidebar-active-border",
	"--search-mark-bg",
	"--search-mark-fg",
	"--chart-1",
	"--chart-2",
	"--chart-3",
	"--chart-4",
	"--chart-5",
	"--auth-panel",
	"--auth-panel-muted",
	"--auth-brand-from",
	"--auth-brand-to",
];

/** Surfaces a focus ring or a chart can sit on. */
const RING_SURFACES: readonly string[] = ["--background", "--card", "--popover", "--muted", "--sidebar"];
const CHART_SERIES: readonly string[] = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const CHART_SURFACES: readonly string[] = ["--card", "--popover"];
const MUTED_TEXT_SURFACES: readonly string[] = ["--background", "--card", "--muted", "--sidebar"];
/** Surfaces sidebar nav labels sit on — the chrome itself and a hovered row. */
const SIDEBAR_TEXT_SURFACES: readonly string[] = ["--sidebar", "--sidebar-accent"];
/** The tone palette: each `--tone-X` is text on its own `--tone-X-soft` fill (Badge tone variants). */
const TONES: readonly string[] = ["green", "blue", "yellow", "red", "orange", "teal", "violet"];
/** Reward tiers: each `--tier-X` is text on its own `--tier-X-soft` fill (tier badges, membership cards). */
const TIERS: readonly string[] = ["bronze", "silver", "gold", "platinum"];
/** Body text on each surface it is set on. */
const SURFACE_TEXT: readonly (readonly [string, string])[] = [
	["--foreground", "--background"],
	["--foreground", "--topbar"],
	["--card-foreground", "--card"],
	["--popover-foreground", "--popover"],
];

interface TokenPairing {
	readonly foreground: string;
	readonly background: string;
	readonly minimum: number;
}

/** Every pairing the design system promises (WCAG 1.4.3 text, 1.4.11 non-text). */
const THEME_PAIRINGS: readonly TokenPairing[] = [
	...RING_SURFACES.map((background): TokenPairing => ({ foreground: "--ring", background, minimum: MIN_NON_TEXT_CONTRAST })),
	{ foreground: "--sidebar-ring", background: "--sidebar", minimum: MIN_NON_TEXT_CONTRAST },
	{ foreground: "--sidebar-ring", background: "--sidebar-accent", minimum: MIN_NON_TEXT_CONTRAST },
	...CHART_SERIES.flatMap((foreground) => CHART_SURFACES.map((background): TokenPairing => ({ foreground, background, minimum: MIN_NON_TEXT_CONTRAST }))),
	{ foreground: "--search-mark-bg", background: "--sidebar", minimum: MIN_NON_TEXT_CONTRAST },
	{ foreground: "--search-mark-fg", background: "--search-mark-bg", minimum: MIN_TEXT_CONTRAST },
	...MUTED_TEXT_SURFACES.map((background): TokenPairing => ({ foreground: "--muted-foreground", background, minimum: MIN_TEXT_CONTRAST })),
	...SIDEBAR_TEXT_SURFACES.map((background): TokenPairing => ({ foreground: "--sidebar-foreground", background, minimum: MIN_TEXT_CONTRAST })),
	{ foreground: "--sidebar-primary-foreground", background: "--sidebar-primary", minimum: MIN_TEXT_CONTRAST },
	{ foreground: "--sidebar-active-foreground", background: "--sidebar-active", minimum: MIN_TEXT_CONTRAST },
	...TONES.map((tone): TokenPairing => ({ foreground: `--tone-${tone}`, background: `--tone-${tone}-soft`, minimum: MIN_TEXT_CONTRAST })),
	...SURFACE_TEXT.map(([foreground, background]): TokenPairing => ({ foreground, background, minimum: MIN_TEXT_CONTRAST })),
	...TIERS.map((tier): TokenPairing => ({ foreground: `--tier-${tier}`, background: `--tier-${tier}-soft`, minimum: MIN_TEXT_CONTRAST })),
	{ foreground: "--reward", background: "--reward-soft", minimum: MIN_TEXT_CONTRAST },
	{ foreground: "--reward-solid-foreground", background: "--reward-solid", minimum: MIN_TEXT_CONTRAST },
];

function themeToken(theme: ReadonlyMap<string, string>, name: string): string {
	const value = theme.get(name);
	if (value === undefined) {
		throw new Error(`Token ${name} is not declared`);
	}
	return value;
}

/** The token pairings of a resolved theme that miss their WCAG minimum, as readable lines (empty = compliant). */
export function findContrastViolations(theme: ReadonlyMap<string, string>): readonly string[] {
	return THEME_PAIRINGS.flatMap(({ foreground, background, minimum }): string[] => {
		const ratio = contrastRatio(themeToken(theme, foreground), themeToken(theme, background));
		return ratio >= minimum ? [] : [`${foreground} on ${background}: ${ratio.toFixed(2)}:1 < ${String(minimum)}:1`];
	});
}
