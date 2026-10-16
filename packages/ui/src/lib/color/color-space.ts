/**
 * Colour spaces and conversions for the colour picker (ported from reui).
 * Channels stay in the space they were given or edited in, so the hue of a
 * grey and an OKLCH colour outside sRGB survive a round trip.
 */

/** How a value is written: what `onValueChange` emits and what the fields show. */
export type ColorPickerFormat = "hex" | "rgb" | "hsl" | "hsb" | "oklch";

/** Where channels live. HSB is `hsv` here, after the math. */
export type ColorPickerColorSpace = "rgb" | "hsl" | "hsv" | "oklch";

export type ColorPickerChannel = "hue" | "saturation" | "brightness" | "lightness" | "chroma" | "red" | "green" | "blue" | "alpha";

/** Three channel values, in the order of their space (`SPACE_CHANNELS`). */
export type ColorTriple = readonly [number, number, number];

/** A position inside a `ColorTriple`. */
export type ColorTripleIndex = 0 | 1 | 2;

/**
 * A parsed colour. rgb runs 0 to 255; hsl and hsv take hue 0 to 360 and the
 * rest 0 to 100; oklch takes lightness 0 to 100, chroma 0 to 0.4 and hue 0 to
 * 360. Alpha is 0 to 1.
 */
export interface ColorPickerColor {
	readonly space: ColorPickerColorSpace;
	readonly channels: ColorTriple;
	readonly alpha: number;
}

/** A 3×3 matrix, row by row. */
export type ColorMatrix = readonly [ColorTriple, ColorTriple, ColorTriple];

export const RGB_CHANNEL_MAX = 255;
export const HUE_MAX_DEGREES = 360;
export const PERCENT_MAX = 100;
/** The top of the OKLCH chroma channel: past every sRGB and P3 colour. */
export const OKLCH_CHROMA_MAX = 0.4;
export const ALPHA_MAX = 1;

const DEGREES_PER_HUE_SEXTANT = 60;
const HUE_SEXTANTS = 6;
const HALF_TURN_DEGREES = 180;
/** Below this the RGB channels are equal: no hue to read. */
const ACHROMATIC_DELTA = 1e-9;
/** Below this an OKLCH colour reads as grey: its hue is kept from the fallback. */
const ACHROMATIC_CHROMA = 1e-4;
/** How far a linear channel may sit outside 0..1 and still count as in sRGB. */
const GAMUT_EPSILON = 1e-4;
/** The CSS Color 4 just-noticeable difference in OKLab used by gamut mapping. */
const GAMUT_JND = 0.02;
/** Precision of the chroma binary search. */
const CHROMA_SEARCH_EPSILON = 1e-4;

/* The sRGB transfer function (IEC 61966-2-1). */
const SRGB_DECODE_THRESHOLD = 0.04045;
const SRGB_ENCODE_THRESHOLD = 0.0031308;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_SCALE = 1.055;
const SRGB_GAMMA = 2.4;

/* OKLab by Björn Ottosson, the matrices CSS Color 4 uses. */
const LINEAR_SRGB_TO_LMS: ColorMatrix = [
	[0.4122214708, 0.5363325363, 0.0514459929],
	[0.2119034982, 0.6806995451, 0.1073969566],
	[0.0883024619, 0.2817188376, 0.6299787005],
];
const LMS_TO_OKLAB: ColorMatrix = [
	[0.2104542553, 0.793617785, -0.0040720468],
	[1.9779984951, -2.428592205, 0.4505937099],
	[0.0259040371, 0.7827717662, -0.808675766],
];
const OKLAB_TO_LMS: ColorMatrix = [
	[1, 0.3963377774, 0.2158037573],
	[1, -0.1055613458, -0.0638541728],
	[1, -0.0894841775, -1.291485548],
];
const LMS_TO_LINEAR_SRGB: ColorMatrix = [
	[4.0767416621, -3.3077115913, 0.2309699292],
	[-1.2684380046, 2.6097574011, -0.3413193965],
	[-0.0041960863, -0.7034186147, 1.707614701],
];
const CUBE = 3;

/** Which channels each space holds, in order. */
export const SPACE_CHANNELS: Readonly<Record<ColorPickerColorSpace, readonly [ColorPickerChannel, ColorPickerChannel, ColorPickerChannel]>> = {
	rgb: ["red", "green", "blue"],
	hsl: ["hue", "saturation", "lightness"],
	hsv: ["hue", "saturation", "brightness"],
	oklch: ["lightness", "chroma", "hue"],
};

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function wrapHue(hue: number): number {
	return ((hue % HUE_MAX_DEGREES) + HUE_MAX_DEGREES) % HUE_MAX_DEGREES;
}

/** A number with `digits` decimals at most, trailing zeros dropped, and never "-0". */
export function formatFixed(value: number, digits: number): string {
	return String(Number(value.toFixed(digits)) + 0);
}

export function degreesToRadians(degrees: number): number {
	return (degrees * Math.PI) / HALF_TURN_DEGREES;
}

export function radiansToDegrees(radians: number): number {
	return (radians * HALF_TURN_DEGREES) / Math.PI;
}

/** Applies `transform` to each channel, keeping the tuple shape. */
export function mapTriple(triple: ColorTriple, transform: (channel: number, index: ColorTripleIndex) => number): ColorTriple {
	const [first, second, third] = triple;
	return [transform(first, 0), transform(second, 1), transform(third, 2)];
}

/** The channel at `index`. */
export function tripleAt(triple: ColorTriple, index: ColorTripleIndex): number {
	const [first, second, third] = triple;
	if (index === 0) {
		return first;
	}
	return index === 1 ? second : third;
}

/** A copy of `triple` with `index` replaced. */
export function withTripleAt(triple: ColorTriple, index: ColorTripleIndex, value: number): ColorTriple {
	return mapTriple(triple, (channel: number, position: ColorTripleIndex): number => (position === index ? value : channel));
}

export function multiplyMatrix(matrix: ColorMatrix, vector: ColorTriple): ColorTriple {
	const [x, y, z] = vector;
	return mapTriple(vector, (_channel: number, index: ColorTripleIndex): number => {
		const [a, b, c] = matrix[index];
		return a * x + b * y + c * z;
	});
}

export function composeMatrices(outer: ColorMatrix, inner: ColorMatrix): ColorMatrix {
	const [innerFirst, innerSecond, innerThird] = inner;
	const row = (outerRow: ColorTriple): ColorTriple => {
		const [a, b, c] = outerRow;
		return mapTriple(
			outerRow,
			(_channel: number, column: ColorTripleIndex): number => a * tripleAt(innerFirst, column) + b * tripleAt(innerSecond, column) + c * tripleAt(innerThird, column),
		);
	};
	const [first, second, third] = outer;
	return [row(first), row(second), row(third)];
}

/** The index of `channel` in `space`, when the space holds it. */
export function channelIndex(space: ColorPickerColorSpace, channel: ColorPickerChannel): ColorTripleIndex | null {
	const [first, second, third] = SPACE_CHANNELS[space];
	if (first === channel) {
		return 0;
	}
	if (second === channel) {
		return 1;
	}
	return third === channel ? 2 : null;
}

export function rgbToHsv(rgb: ColorTriple, fallbackHue = 0): ColorTriple {
	const [r, g, b] = mapTriple(rgb, (channel: number): number => channel / RGB_CHANNEL_MAX);
	const max = Math.max(r, g, b);
	const delta = max - Math.min(r, g, b);
	let hue = fallbackHue;
	if (delta > ACHROMATIC_DELTA) {
		let sextant: number;
		if (max === r) {
			sextant = ((g - b) / delta) % HUE_SEXTANTS;
		} else if (max === g) {
			sextant = (b - r) / delta + 2;
		} else {
			sextant = (r - g) / delta + 4;
		}
		hue = wrapHue(sextant * DEGREES_PER_HUE_SEXTANT);
	}
	return [hue, max === 0 ? 0 : (delta / max) * PERCENT_MAX, max * PERCENT_MAX];
}

/* Sextant offsets of the red, green and blue channels in the HSV formula. */
const HSV_RED_OFFSET = 5;
const HSV_GREEN_OFFSET = 3;
const HSV_BLUE_OFFSET = 1;
const HSV_PLATEAU = 4;

export function hsvToRgb(hsv: ColorTriple): ColorTriple {
	const [hue, saturation, brightness] = hsv;
	const s = saturation / PERCENT_MAX;
	const v = brightness / PERCENT_MAX;
	const channel = (offset: number): number => {
		const k = (offset + hue / DEGREES_PER_HUE_SEXTANT) % HUE_SEXTANTS;
		return (v - v * s * Math.max(0, Math.min(k, HSV_PLATEAU - k, 1))) * RGB_CHANNEL_MAX;
	};
	return [channel(HSV_RED_OFFSET), channel(HSV_GREEN_OFFSET), channel(HSV_BLUE_OFFSET)];
}

/* HSL and HSB share a hue, carried over as is, so a grey keeps it. */
export function hsvToHsl(hsv: ColorTriple): ColorTriple {
	const [hue, saturation, brightness] = hsv;
	const s = saturation / PERCENT_MAX;
	const v = brightness / PERCENT_MAX;
	const l = v * (1 - s / 2);
	const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
	return [hue, sl * PERCENT_MAX, l * PERCENT_MAX];
}

export function hslToHsv(hsl: ColorTriple): ColorTriple {
	const [hue, saturation, lightness] = hsl;
	const s = saturation / PERCENT_MAX;
	const l = lightness / PERCENT_MAX;
	const v = l + s * Math.min(l, 1 - l);
	return [hue, v === 0 ? 0 : 2 * (1 - l / v) * PERCENT_MAX, v * PERCENT_MAX];
}

/** An sRGB channel (0 to 255) to linear light (0 to 1). */
export function srgbToLinear(channel: number): number {
	const c = channel / RGB_CHANNEL_MAX;
	return c <= SRGB_DECODE_THRESHOLD ? c / SRGB_LINEAR_SLOPE : ((c + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_GAMMA;
}

/** Linear light (0 to 1) to an sRGB channel (0 to 255). */
export function linearToSrgb(channel: number): number {
	return RGB_CHANNEL_MAX * (channel <= SRGB_ENCODE_THRESHOLD ? SRGB_LINEAR_SLOPE * channel : SRGB_SCALE * channel ** (1 / SRGB_GAMMA) - SRGB_OFFSET);
}

/** sRGB's curve on a 0..1 channel, carried past 0 and 1 by symmetry, as `color()` allows. */
export function decodeSrgbUnit(value: number): number {
	const size = Math.abs(value);
	return Math.sign(value) * (size <= SRGB_DECODE_THRESHOLD ? size / SRGB_LINEAR_SLOPE : ((size + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_GAMMA);
}

/** Linear sRGB in, unbounded, so a wide-gamut colour converts without clipping. */
export function linearToOklab(linear: ColorTriple): ColorTriple {
	return multiplyMatrix(LMS_TO_OKLAB, mapTriple(multiplyMatrix(LINEAR_SRGB_TO_LMS, linear), Math.cbrt));
}

/** OKLab to OKLCH in the picker's units: L 0 to 100. */
export function oklabToOklch(oklab: ColorTriple, fallbackHue = 0): ColorTriple {
	const [lightness, a, b] = oklab;
	const chroma = Math.sqrt(a * a + b * b);
	const hue = chroma < ACHROMATIC_CHROMA ? fallbackHue : wrapHue(radiansToDegrees(Math.atan2(b, a)));
	return [lightness * PERCENT_MAX, chroma, hue];
}

export function rgbToOklch(rgb: ColorTriple, fallbackHue = 0): ColorTriple {
	return oklabToOklch(linearToOklab(mapTriple(rgb, srgbToLinear)), fallbackHue);
}

/** A colour kept as OKLCH from linear sRGB, so nothing is clipped until a format needs sRGB. */
export function linearSrgbToOklch(linear: ColorTriple): ColorTriple {
	return oklabToOklch(linearToOklab(linear));
}

export function oklchToLinear(oklch: ColorTriple): ColorTriple {
	const [lightness, chroma, hue] = oklch;
	const angle = degreesToRadians(hue);
	const oklab: ColorTriple = [lightness / PERCENT_MAX, chroma * Math.cos(angle), chroma * Math.sin(angle)];
	return multiplyMatrix(
		LMS_TO_LINEAR_SRGB,
		mapTriple(multiplyMatrix(OKLAB_TO_LMS, oklab), (channel: number): number => channel ** CUBE),
	);
}

function isLinearInSrgb(linear: ColorTriple): boolean {
	return linear.every((channel: number): boolean => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);
}

function clipLinear(linear: ColorTriple): ColorTriple {
	return mapTriple(linear, (channel: number): number => clamp(channel, 0, 1));
}

/* How far a clipped colour lands from the OKLCH it stands for, in OKLab. */
function clipError(clipped: ColorTriple, target: ColorTriple): number {
	const [l, a, b] = linearToOklab(clipped);
	const [lightness, chroma, hue] = target;
	const angle = degreesToRadians(hue);
	return Math.hypot(l - lightness / PERCENT_MAX, a - chroma * Math.cos(angle), b - chroma * Math.sin(angle));
}

function encodeLinear(linear: ColorTriple): ColorTriple {
	return mapTriple(linear, linearToSrgb);
}

const WHITE_RGB: ColorTriple = [RGB_CHANNEL_MAX, RGB_CHANNEL_MAX, RGB_CHANNEL_MAX];
const BLACK_RGB: ColorTriple = [0, 0, 0];

/*
 * CSS Color 4 gamut mapping: lower chroma at the same lightness and hue until
 * clipping the rest moves the colour less than a just-noticeable difference,
 * then clip.
 */
export function oklchToRgb(oklch: ColorTriple): ColorTriple {
	const [lightness, chroma, hue] = oklch;
	if (lightness >= PERCENT_MAX) {
		return WHITE_RGB;
	}
	if (lightness <= 0) {
		return BLACK_RGB;
	}
	const target: ColorTriple = [lightness, Math.max(0, chroma), hue];
	const origin = oklchToLinear(target);
	if (isLinearInSrgb(origin)) {
		return encodeLinear(clipLinear(origin));
	}
	let clipped = clipLinear(origin);
	if (clipError(clipped, target) < GAMUT_JND) {
		return encodeLinear(clipped);
	}
	let low = 0;
	let high = Math.max(0, chroma);
	let lowInGamut = true;
	while (high - low > CHROMA_SEARCH_EPSILON) {
		const mid = (low + high) / 2;
		const current: ColorTriple = [lightness, mid, hue];
		const linear = oklchToLinear(current);
		if (lowInGamut && isLinearInSrgb(linear)) {
			low = mid;
			continue;
		}
		clipped = clipLinear(linear);
		const error = clipError(clipped, current);
		if (error < GAMUT_JND) {
			if (GAMUT_JND - error < CHROMA_SEARCH_EPSILON) {
				break;
			}
			lowInGamut = false;
			low = mid;
		} else {
			high = mid;
		}
	}
	return encodeLinear(clipped);
}

/** A colour as sRGB channels (0 to 255, unclamped for wide-gamut inputs mapped in). */
export function toRgb(color: ColorPickerColor): ColorTriple {
	const { space, channels } = color;
	switch (space) {
		case "rgb":
			return channels;
		case "hsv":
			return hsvToRgb(channels);
		case "hsl":
			return hsvToRgb(hslToHsv(channels));
		case "oklch":
			return oklchToRgb(channels);
	}
}

/** The hue a colour carries, used when a conversion lands on a grey. */
function carriedHue(color: ColorPickerColor): number {
	const [first, , third] = color.channels;
	if (color.space === "rgb") {
		return 0;
	}
	return color.space === "oklch" ? third : first;
}

/** A colour's channels in another space. */
export function toSpace(color: ColorPickerColor, space: ColorPickerColorSpace): ColorTriple {
	const { space: from, channels } = color;
	if (from === space) {
		return channels;
	}
	if (from === "hsv" && space === "hsl") {
		return hsvToHsl(channels);
	}
	if (from === "hsl" && space === "hsv") {
		return hslToHsv(channels);
	}
	const rgb = toRgb(color);
	const hue = carriedHue(color);
	switch (space) {
		case "rgb":
			return rgb;
		case "hsv":
			return rgbToHsv(rgb, hue);
		case "hsl":
			return hsvToHsl(rgbToHsv(rgb, hue));
		case "oklch":
			return rgbToOklch(rgb, hue);
	}
}

/** Whether a colour fits sRGB. OKLCH can reach past it; the picker then maps it into sRGB the way CSS does. */
export function isColorInSrgb(color: ColorPickerColor): boolean {
	return color.space !== "oklch" || isLinearInSrgb(oklchToLinear(color.channels));
}

/* -------------------------------- Channels -------------------------------- */

const DEFAULT_CHANNEL_SPACE: Readonly<Record<ColorPickerChannel, ColorPickerColorSpace>> = {
	hue: "hsv",
	saturation: "hsv",
	brightness: "hsv",
	lightness: "hsl",
	chroma: "oklch",
	red: "rgb",
	green: "rgb",
	blue: "rgb",
	alpha: "rgb",
};

/** The space a channel is read in: `space` when it holds the channel, else the channel's own. */
export function resolveChannelSpace(channel: ColorPickerChannel, space: ColorPickerColorSpace | undefined): ColorPickerColorSpace {
	if (channel !== "alpha" && space !== undefined && channelIndex(space, channel) !== null) {
		return space;
	}
	return DEFAULT_CHANNEL_SPACE[channel];
}

export interface ChannelRange {
	readonly max: number;
	readonly step: number;
}

const ALPHA_STEP = 0.01;
const CHROMA_STEP = 0.004;
const UNIT_STEP = 1;

export function channelRange(space: ColorPickerColorSpace, channel: ColorPickerChannel): ChannelRange {
	if (channel === "alpha") {
		return { max: ALPHA_MAX, step: ALPHA_STEP };
	}
	if (channel === "hue") {
		return { max: HUE_MAX_DEGREES, step: UNIT_STEP };
	}
	if (channel === "chroma") {
		return { max: OKLCH_CHROMA_MAX, step: CHROMA_STEP };
	}
	return { max: space === "rgb" ? RGB_CHANNEL_MAX : PERCENT_MAX, step: UNIT_STEP };
}

export function readChannel(color: ColorPickerColor, space: ColorPickerColorSpace, channel: ColorPickerChannel): number {
	if (channel === "alpha") {
		return color.alpha;
	}
	const index = channelIndex(space, channel);
	return index === null ? 0 : tripleAt(toSpace(color, space), index);
}

export function withChannel(color: ColorPickerColor, space: ColorPickerColorSpace, channel: ColorPickerChannel, value: number): ColorPickerColor {
	if (channel === "alpha") {
		return { ...color, alpha: clamp(value, 0, ALPHA_MAX) };
	}
	const index = channelIndex(space, channel);
	const channels = toSpace(color, space);
	return { space, channels: index === null ? channels : withTripleAt(channels, index, value), alpha: color.alpha };
}

/** Rounds `value` to the nearest multiple of `step`. */
export function snapToStep(value: number, step: number): number {
	const SNAP_DIGITS = 4;
	return Number((Math.round(value / step) * step).toFixed(SNAP_DIGITS));
}
