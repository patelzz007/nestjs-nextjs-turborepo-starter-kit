// Colour maths for the colour picker: one colour as RGBA (0–255 channels,
// 0–1 alpha), read from and written to hex, rgb(), hsl() and oklch(), and
// converted to the HSV the picker's area and hue slider move in. Also the WCAG
// contrast ratio and whether an OKLCH colour is inside sRGB. Pure functions.

/** A colour: red, green and blue 0–255, alpha 0–1. */
export interface Rgba {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
}

/** Hue 0–360, saturation and value 0–1: how the picker's area and hue slider see a colour. */
export interface Hsva {
	readonly h: number;
	readonly s: number;
	readonly v: number;
	readonly a: number;
}

/** The text forms a colour can be written in. */
export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch";

const CHANNEL_MAX = 255;
const HUE_TURN = 360;
const HUE_SECTOR = 60;
const PERCENT = 100;
const HEX_RADIX = 16;
const HEX_PAIR = 2;
const SHORT_HEX = /^#?(?<r>[\da-f])(?<g>[\da-f])(?<b>[\da-f])(?<a>[\da-f])?$/iu;
const LONG_HEX = /^#?(?<r>[\da-f]{2})(?<g>[\da-f]{2})(?<b>[\da-f]{2})(?<a>[\da-f]{2})?$/iu;
const NUMBER = String.raw`-?\d*\.?\d+`;
const RGB_TEXT = new RegExp(String.raw`^rgba?\(\s*(?<r>${NUMBER})[\s,]+(?<g>${NUMBER})[\s,]+(?<b>${NUMBER})(?:[\s,/]+(?<alpha>${NUMBER})(?<percent>%)?)?\s*\)$`, "iu");
const HSL_TEXT = new RegExp(
	String.raw`^hsla?\(\s*(?<h>${NUMBER})(?:deg)?[\s,]+(?<s>${NUMBER})%[\s,]+(?<l>${NUMBER})%(?:[\s,/]+(?<alpha>${NUMBER})(?<percent>%)?)?\s*\)$`,
	"iu",
);
const OKLCH_TEXT = new RegExp(
	String.raw`^oklch\(\s*(?<l>${NUMBER})(?<lPercent>%)?\s+(?<c>${NUMBER})\s+(?<h>${NUMBER})(?:deg)?(?:\s*/\s*(?<alpha>${NUMBER})(?<percent>%)?)?\s*\)$`,
	"iu",
);

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 0): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

function hexPair(value: number): string {
	return Math.round(clamp(value, 0, CHANNEL_MAX))
		.toString(HEX_RADIX)
		.padStart(HEX_PAIR, "0");
}

/** "#3b82f6", "#3b82f680", "3b8" → the colour; `null` when it is not hex. */
export function parseHex(text: string): Rgba | null {
	const short = SHORT_HEX.exec(text.trim())?.groups;
	const groups =
		short === undefined
			? LONG_HEX.exec(text.trim())?.groups
			: {
					r: `${short.r ?? ""}${short.r ?? ""}`,
					g: `${short.g ?? ""}${short.g ?? ""}`,
					b: `${short.b ?? ""}${short.b ?? ""}`,
					a: short.a === undefined ? undefined : `${short.a}${short.a}`,
				};
	if (groups === undefined) {
		return null;
	}
	const channel = (pair: string | undefined): number => Number.parseInt(pair ?? "0", HEX_RADIX);
	return { r: channel(groups.r), g: channel(groups.g), b: channel(groups.b), a: groups.a === undefined ? 1 : channel(groups.a) / CHANNEL_MAX };
}

/** The colour as "#rrggbb", or "#rrggbbaa" when it is see-through. */
export function toHex({ r, g, b, a }: Rgba): string {
	return `#${hexPair(r)}${hexPair(g)}${hexPair(b)}${a < 1 ? hexPair(a * CHANNEL_MAX) : ""}`;
}

function alphaOf(value: string | undefined, percent: string | undefined): number {
	if (value === undefined) {
		return 1;
	}
	return clamp(percent === undefined ? Number(value) : Number(value) / PERCENT, 0, 1);
}

/** HSV → RGB. */
export function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
	const chroma = v * s;
	const sector = (((h % HUE_TURN) + HUE_TURN) % HUE_TURN) / HUE_SECTOR;
	const second = chroma * (1 - Math.abs((sector % 2) - 1));
	const [r1, g1, b1] = [
		[chroma, second, 0],
		[second, chroma, 0],
		[0, chroma, second],
		[0, second, chroma],
		[second, 0, chroma],
		[chroma, 0, second],
	].at(Math.floor(sector)) ?? [0, 0, 0];
	const m = v - chroma;
	return { r: ((r1 ?? 0) + m) * CHANNEL_MAX, g: ((g1 ?? 0) + m) * CHANNEL_MAX, b: ((b1 ?? 0) + m) * CHANNEL_MAX, a };
}

/** RGB → HSV (a grey keeps hue 0). */
export function rgbToHsv({ r, g, b, a }: Rgba): Hsva {
	const [red, green, blue] = [r / CHANNEL_MAX, g / CHANNEL_MAX, b / CHANNEL_MAX];
	const max = Math.max(red, green, blue);
	const delta = max - Math.min(red, green, blue);
	let h = 0;
	if (delta > 0) {
		if (max === red) {
			h = HUE_SECTOR * (((green - blue) / delta) % 6);
		} else if (max === green) {
			h = HUE_SECTOR * ((blue - red) / delta + 2);
		} else {
			h = HUE_SECTOR * ((red - green) / delta + 4);
		}
	}
	return { h: (h + HUE_TURN) % HUE_TURN, s: max === 0 ? 0 : delta / max, v: max, a };
}

/** HSL (hue 0–360, saturation and lightness 0–1) → RGB. */
export function hslToRgb(h: number, s: number, l: number, a: number): Rgba {
	const v = l + s * Math.min(l, 1 - l);
	return hsvToRgb({ h, s: v === 0 ? 0 : 2 * (1 - l / v), v, a });
}

/** RGB → HSL. */
export function rgbToHsl(color: Rgba): { readonly h: number; readonly s: number; readonly l: number } {
	const { h, s, v } = rgbToHsv(color);
	const l = v * (1 - s / 2);
	return { h, s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l };
}

const LINEAR_THRESHOLD = 0.04045;
const LINEAR_SLOPE = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA = 2.4;

function toLinear(channel: number): number {
	const c = channel / CHANNEL_MAX;
	return c <= LINEAR_THRESHOLD ? c / LINEAR_SLOPE : ((c + GAMMA_OFFSET) / (1 + GAMMA_OFFSET)) ** GAMMA;
}

function fromLinear(value: number): number {
	const c = value <= LINEAR_THRESHOLD / LINEAR_SLOPE ? value * LINEAR_SLOPE : (1 + GAMMA_OFFSET) * value ** (1 / GAMMA) - GAMMA_OFFSET;
	return c * CHANNEL_MAX;
}

/** OKLCH: lightness 0–1, chroma, hue 0–360. */
export interface Oklch {
	readonly l: number;
	readonly c: number;
	readonly h: number;
	readonly a: number;
}

/** RGB → OKLCH (Björn Ottosson's OKLab, in polar form). */
export function rgbToOklch(color: Rgba): Oklch {
	const [r, g, b] = [toLinear(color.r), toLinear(color.g), toLinear(color.b)];
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const lab = [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
	const [lightness = 0, labA = 0, labB = 0] = lab;
	const chroma = Math.hypot(labA, labB);
	return { l: lightness, c: chroma, h: (Math.atan2(labB, labA) * (HUE_TURN / 2 / Math.PI) + HUE_TURN) % HUE_TURN, a: color.a };
}

/** The linear sRGB channels of an OKLCH colour (outside 0–1 when it is outside sRGB). */
function oklchToLinear({ l, c, h }: Oklch): readonly [number, number, number] {
	const radians = (h * Math.PI) / (HUE_TURN / 2);
	const [labA, labB] = [c * Math.cos(radians), c * Math.sin(radians)];
	const lCube = (l + 0.3963377774 * labA + 0.2158037573 * labB) ** 3;
	const mCube = (l - 0.1055613458 * labA - 0.0638541728 * labB) ** 3;
	const sCube = (l - 0.0894841775 * labA - 1.291485548 * labB) ** 3;
	return [
		4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
		-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
		-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
	];
}

/** How far a channel may stray outside 0–1 and still count as inside sRGB (rounding). */
const GAMUT_EPSILON = 0.0005;

/** Whether an OKLCH colour can be shown in sRGB at all. */
export function isInSrgb(color: Oklch): boolean {
	return oklchToLinear(color).every((channel: number): boolean => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);
}

/** OKLCH → RGB, clipped into sRGB. */
export function oklchToRgb(color: Oklch): Rgba {
	const [r, g, b] = oklchToLinear(color);
	return { r: clamp(fromLinear(r), 0, CHANNEL_MAX), g: clamp(fromLinear(g), 0, CHANNEL_MAX), b: clamp(fromLinear(b), 0, CHANNEL_MAX), a: color.a };
}

/** Any of the four text forms → the colour; `null` when the text is none of them. */
export function parseColor(text: string): Rgba | null {
	const trimmed = text.trim();
	const rgb = RGB_TEXT.exec(trimmed)?.groups;
	if (rgb !== undefined) {
		return { r: clamp(Number(rgb.r), 0, CHANNEL_MAX), g: clamp(Number(rgb.g), 0, CHANNEL_MAX), b: clamp(Number(rgb.b), 0, CHANNEL_MAX), a: alphaOf(rgb.alpha, rgb.percent) };
	}
	const hsl = HSL_TEXT.exec(trimmed)?.groups;
	if (hsl !== undefined) {
		return hslToRgb(Number(hsl.h), clamp(Number(hsl.s) / PERCENT, 0, 1), clamp(Number(hsl.l) / PERCENT, 0, 1), alphaOf(hsl.alpha, hsl.percent));
	}
	const oklch = OKLCH_TEXT.exec(trimmed)?.groups;
	if (oklch !== undefined) {
		const lightness = oklch.lPercent === undefined ? Number(oklch.l) : Number(oklch.l) / PERCENT;
		return oklchToRgb({ l: lightness, c: Number(oklch.c), h: Number(oklch.h), a: alphaOf(oklch.alpha, oklch.percent) });
	}
	return parseHex(trimmed);
}

const OKLCH_LIGHTNESS_DECIMALS = 3;
const OKLCH_CHROMA_DECIMALS = 3;
const ALPHA_DECIMALS = 2;

/** The colour written in `format`. */
export function formatColor(color: Rgba, format: ColorFormat): string {
	const alpha = color.a < 1 ? round(color.a, ALPHA_DECIMALS) : null;
	switch (format) {
		case "hex":
			return toHex(color);
		case "rgb":
			return alpha === null
				? `rgb(${String(round(color.r))}, ${String(round(color.g))}, ${String(round(color.b))})`
				: `rgba(${String(round(color.r))}, ${String(round(color.g))}, ${String(round(color.b))}, ${String(alpha)})`;
		case "hsl": {
			const { h, s, l } = rgbToHsl(color);
			const body = `${String(round(h))}, ${String(round(s * PERCENT))}%, ${String(round(l * PERCENT))}%`;
			return alpha === null ? `hsl(${body})` : `hsla(${body}, ${String(alpha)})`;
		}
		case "oklch": {
			const { l, c, h } = rgbToOklch(color);
			const body = `${String(round(l, OKLCH_LIGHTNESS_DECIMALS))} ${String(round(c, OKLCH_CHROMA_DECIMALS))} ${String(round(h))}`;
			return alpha === null ? `oklch(${body})` : `oklch(${body} / ${String(alpha)})`;
		}
	}
}

const LUMINANCE_WEIGHTS: readonly [number, number, number] = [0.2126, 0.7152, 0.0722];
const CONTRAST_OFFSET = 0.05;

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgba): number {
	const [wr, wg, wb] = LUMINANCE_WEIGHTS;
	return wr * toLinear(r) + wg * toLinear(g) + wb * toLinear(b);
}

/** The WCAG contrast ratio of two colours, 1 to 21. */
export function contrastRatio(first: Rgba, second: Rgba): number {
	const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((x: number, y: number): number => y - x);
	return ((lighter ?? 0) + CONTRAST_OFFSET) / ((darker ?? 0) + CONTRAST_OFFSET);
}
