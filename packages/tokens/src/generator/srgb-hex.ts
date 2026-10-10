// ============================================
// generator/srgb-hex.ts — a colour literal as `#rrggbb`
// ============================================
// For outputs read by software that may not understand `oklch()` — the
// favicon is fetched by search crawlers and older tab renderers. Converts
// through OKLab to linear sRGB (Björn Ottosson's published matrices), gamma
// encodes, and clamps anything outside the sRGB gamut.

import type { ColorLiteral } from "../schema";

/** Thrown for a colour that has no single sRGB value (`transparent`, `currentColor`). */
export class ColorHasNoHexError extends Error {
	public constructor(color: string) {
		super(`${color} has no #rrggbb equivalent`);
		this.name = "ColorHasNoHexError";
	}
}

const DEGREES_PER_HALF_TURN = 180;
const BYTE_MAX = 255;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_CHANNEL = 2;

/** OKLab (L, a, b) → LMS cube roots (Ottosson, "A perceptual color space for image processing"). */
const OKLAB_TO_LMS = [
	[1, 0.3963377774, 0.2158037573],
	[1, -0.1055613458, -0.0638541728],
	[1, -0.0894841775, -1.291485548],
] satisfies readonly (readonly [number, number, number])[];

/** LMS → linear sRGB. */
const LMS_TO_LINEAR_SRGB = [
	[4.0767416621, -3.3077115913, 0.2309699292],
	[-1.2684380046, 2.6097574011, -0.3413193965],
	[-0.0041960863, -0.7034186147, 1.707614701],
] satisfies readonly (readonly [number, number, number])[];

/** The sRGB transfer function's linear segment and its exponent (IEC 61966-2-1). */
const SRGB_LINEAR_LIMIT = 0.0031308;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_GAMMA = 2.4;
const SRGB_SCALE = 1.055;
const SRGB_OFFSET = 0.055;

function dot([first, second, third]: readonly [number, number, number], [x, y, z]: readonly [number, number, number]): number {
	return first * x + second * y + third * z;
}

function gammaEncode(linear: number): number {
	return linear <= SRGB_LINEAR_LIMIT ? SRGB_LINEAR_SLOPE * linear : SRGB_SCALE * linear ** (1 / SRGB_GAMMA) - SRGB_OFFSET;
}

function toByteHex(channel: number): string {
	const byte = Math.round(Math.min(1, Math.max(0, gammaEncode(channel))) * BYTE_MAX);
	return byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_CHANNEL, "0");
}

function oklchToHex(lightness: number, chroma: number, hueDegrees: number): string {
	const hue = (hueDegrees * Math.PI) / DEGREES_PER_HALF_TURN;
	const oklab: readonly [number, number, number] = [lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)];
	const [lRoot, mRoot, sRoot] = OKLAB_TO_LMS.map((row): number => dot(row, oklab));
	const lms: readonly [number, number, number] = [(lRoot ?? 0) ** 3, (mRoot ?? 0) ** 3, (sRoot ?? 0) ** 3];
	return `#${LMS_TO_LINEAR_SRGB.map((row): string => toByteHex(dot(row, lms))).join("")}`;
}

export function formatSrgbHex(color: ColorLiteral): string {
	switch (color.kind) {
		case "oklch":
			return oklchToHex(color.lightness, color.chroma, color.hue);
		case "hex":
			return color.value;
		case "keyword":
			throw new ColorHasNoHexError(color.value);
	}
}
