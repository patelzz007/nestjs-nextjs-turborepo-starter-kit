/**
 * Writes colours as CSS strings and measures contrast, for the colour picker
 * (ported from reui).
 */
import { isStringPrimitive } from "@workspace/shared";
import { parseColor } from "@workspace/ui/lib/color/color-parse";
import {
	ALPHA_MAX,
	clamp,
	formatFixed,
	mapTriple,
	RGB_CHANNEL_MAX,
	srgbToLinear,
	toRgb,
	toSpace,
	wrapHue,
	type ColorPickerColor,
	type ColorPickerFormat,
	type ColorTriple,
	type ColorTripleIndex,
	tripleAt,
} from "@workspace/ui/lib/color/color-space";

/** Every format, in the order the format menu lists them. */
export const COLOR_PICKER_FORMATS: readonly ColorPickerFormat[] = ["hex", "rgb", "hsl", "hsb", "oklch"];

const ALPHA_DIGITS = 2;
const PERCENT_DIGITS = 1;
/* Fine enough that hex to OKLCH and back is exact. */
const OKLCH_LIGHTNESS_DIGITS = 2;
const OKLCH_CHROMA_DIGITS = 5;
const OKLCH_HUE_DIGITS = 3;
const HEX_RADIX = 16;
const HEX_BYTE_LENGTH = 2;

/**
 * Writes a colour in a format. HEX gains a fourth byte and the others a
 * `/ alpha` only when the colour is translucent; OKLCH keeps channels outside
 * sRGB, every other format maps the colour into sRGB the way CSS does.
 */
export function formatColor(color: ColorPickerColor, format: ColorPickerFormat): string {
	const alpha = clamp(color.alpha, 0, ALPHA_MAX);
	/* Decided on the rounded alpha, so 0.996 writes no "/ 1" tail. */
	const roundedAlpha = formatFixed(alpha, ALPHA_DIGITS);
	const tail = roundedAlpha === "1" ? "" : ` / ${roundedAlpha}`;
	if (format === "hex" || format === "rgb") {
		const rgb = mapTriple(toRgb(color), (channel: number): number => Math.round(clamp(channel, 0, RGB_CHANNEL_MAX)));
		if (format === "rgb") {
			return `rgb(${rgb.join(" ")}${tail})`;
		}
		const opacity = Math.round(alpha * RGB_CHANNEL_MAX);
		const bytes = opacity < RGB_CHANNEL_MAX ? [...rgb, opacity] : [...rgb];
		return `#${bytes.map((byte: number): string => byte.toString(HEX_RADIX).padStart(HEX_BYTE_LENGTH, "0")).join("")}`;
	}
	if (format === "oklch") {
		const [l, c, h] = toSpace(color, "oklch");
		/* Chroma is never below 0, and a hue that rounds to 360 is 0. */
		const hue = formatFixed(wrapHue(Number(h.toFixed(OKLCH_HUE_DIGITS))), OKLCH_HUE_DIGITS);
		return `oklch(${formatFixed(l, OKLCH_LIGHTNESS_DIGITS)}% ${formatFixed(Math.max(0, c), OKLCH_CHROMA_DIGITS)} ${hue}${tail})`;
	}
	const [h, s, third] = toSpace(color, format === "hsl" ? "hsl" : "hsv");
	return `${format}(${formatFixed(h, PERCENT_DIGITS)} ${formatFixed(s, PERCENT_DIGITS)}% ${formatFixed(third, PERCENT_DIGITS)}%${tail})`;
}

/** What CSS paints: OKLCH as itself, so a wide-gamut screen shows it; everything else as rgb(). */
export function colorToCss(color: ColorPickerColor): string {
	return formatColor(color, color.space === "oklch" ? "oklch" : "rgb");
}

/* Rec. 709 luminance weights (WCAG 2). */
const LUMINANCE_RED = 0.2126;
const LUMINANCE_GREEN = 0.7152;
const LUMINANCE_BLUE = 0.0722;
const CONTRAST_OFFSET = 0.05;
const WHITE: ColorTriple = [RGB_CHANNEL_MAX, RGB_CHANNEL_MAX, RGB_CHANNEL_MAX];

function relativeLuminance(rgb: ColorTriple): number {
	const [r, g, b] = mapTriple(rgb, srgbToLinear);
	return LUMINANCE_RED * r + LUMINANCE_GREEN * g + LUMINANCE_BLUE * b;
}

/* A translucent colour composited onto an opaque one. */
function compositeOver(top: ColorPickerColor, bottom: ColorTriple): ColorTriple {
	return mapTriple(toRgb(top), (channel: number, index: ColorTripleIndex): number => channel * top.alpha + tripleAt(bottom, index) * (1 - top.alpha));
}

function toColor(input: string | ColorPickerColor): ColorPickerColor | null {
	return isStringPrimitive(input) ? parseColor(input) : input;
}

/**
 * The WCAG 2 contrast ratio, 1 to 21. A translucent foreground is laid over
 * the background, and a translucent background over white. `null` when either
 * colour does not parse.
 */
export function getContrastRatio(foreground: string | ColorPickerColor, background: string | ColorPickerColor): number | null {
	const front = toColor(foreground);
	const back = toColor(background);
	if (front === null || back === null) {
		return null;
	}
	const base = compositeOver(back, WHITE);
	const a = relativeLuminance(compositeOver(front, base));
	const b = relativeLuminance(base);
	return (Math.max(a, b) + CONTRAST_OFFSET) / (Math.min(a, b) + CONTRAST_OFFSET);
}

/* The relative luminance where light and dark text read about equally well (matches APCA on Tailwind's 300–700 shades). */
const FOREGROUND_SWITCH_LUMINANCE = 0.36;
/** WCAG AA for large text and icons. */
const LARGE_TEXT_MIN_CONTRAST = 3;
const DEFAULT_LIGHT_FOREGROUND = "#ffffff";
const DEFAULT_DARK_FOREGROUND = "#0a0a0a";

export interface ForegroundColorOptions {
	readonly light?: string;
	readonly dark?: string;
}

/**
 * The text colour that reads better on a background: `light` on a dark one,
 * `dark` on a light one. Light text also has to reach 3:1 by WCAG 2. A
 * translucent background is laid over white. `null` when the background does
 * not parse.
 */
export function getForegroundColor(background: string | ColorPickerColor, options: ForegroundColorOptions = {}): string | null {
	const { light = DEFAULT_LIGHT_FOREGROUND, dark = DEFAULT_DARK_FOREGROUND } = options;
	const color = toColor(background);
	if (color === null) {
		return null;
	}
	const isDarkBackground = relativeLuminance(compositeOver(color, WHITE)) < FOREGROUND_SWITCH_LUMINANCE;
	return isDarkBackground && (getContrastRatio(light, color) ?? 0) >= LARGE_TEXT_MIN_CONTRAST ? light : dark;
}
