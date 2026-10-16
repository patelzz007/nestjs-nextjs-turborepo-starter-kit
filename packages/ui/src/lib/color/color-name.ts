/**
 * A language-neutral description of a colour ("dark", "vibrant", "blue"),
 * which the `colorPicker` label family turns into words for screen readers.
 * The kit holds no copy: only the classification lives here.
 */
import { PERCENT_MAX, toSpace, type ColorPickerColor } from "@workspace/ui/lib/color/color-space";

export type ColorNeutralName = "black" | "darkGray" | "gray" | "lightGray" | "white";

export type ColorHueName = "pink" | "red" | "orange" | "yellow" | "lime" | "green" | "cyan" | "skyBlue" | "blue" | "violet" | "purple" | "magenta" | "brown" | "olive";

export type ColorShade = "dark" | "light" | "normal";

export type ColorTone = "grayish" | "vibrant" | "normal";

export type ColorDescription =
	| { readonly kind: "neutral"; readonly name: ColorNeutralName }
	| { readonly kind: "chromatic"; readonly hue: ColorHueName; readonly shade: ColorShade; readonly tone: ColorTone };

/* OKLCH hue boundaries, each the upper end of its name. */
const HUE_NAMES: readonly (readonly [number, ColorHueName])[] = [
	[15, "pink"],
	[45, "red"],
	[80, "orange"],
	[120, "yellow"],
	[135, "lime"],
	[165, "green"],
	[205, "cyan"],
	[250, "skyBlue"],
	[280, "blue"],
	[300, "violet"],
	[320, "purple"],
	[345, "magenta"],
	[360, "pink"],
];

/** Below this OKLCH chroma a colour reads as a neutral. */
const NEUTRAL_CHROMA = 0.025;
const GRAYISH_CHROMA = 0.07;
const VIBRANT_CHROMA = 0.2;
/* OKLCH lightness (0..1) bands. */
const BLACK_LIGHTNESS = 0.2;
const DARK_LIGHTNESS = 0.45;
const GRAY_LIGHTNESS = 0.75;
const LIGHT_GRAY_LIGHTNESS = 0.95;
const LIGHT_SHADE_LIGHTNESS = 0.82;
/** Dark warm hues read as brown or olive below this lightness. */
const EARTH_TONE_LIGHTNESS = 0.6;
const BROWN_HUE_START = 40;
const OLIVE_HUE_START = 100;
const OLIVE_HUE_END = 135;

function neutralName(lightness: number): ColorNeutralName {
	if (lightness < BLACK_LIGHTNESS) {
		return "black";
	}
	if (lightness < DARK_LIGHTNESS) {
		return "darkGray";
	}
	if (lightness < GRAY_LIGHTNESS) {
		return "gray";
	}
	return lightness < LIGHT_GRAY_LIGHTNESS ? "lightGray" : "white";
}

function hueName(hue: number, lightness: number): ColorHueName {
	if (lightness < EARTH_TONE_LIGHTNESS && hue >= BROWN_HUE_START && hue < OLIVE_HUE_START) {
		return "brown";
	}
	if (lightness < EARTH_TONE_LIGHTNESS && hue >= OLIVE_HUE_START && hue < OLIVE_HUE_END) {
		return "olive";
	}
	const match = HUE_NAMES.find(([end]: readonly [number, ColorHueName]): boolean => hue < end);
	if (match === undefined) {
		return "pink";
	}
	const [, name] = match;
	return name;
}

/** Classifies a colour by its OKLCH lightness, chroma and hue. */
export function describeColor(color: ColorPickerColor): ColorDescription {
	const [lightness, chroma, hue] = toSpace(color, "oklch");
	const l = lightness / PERCENT_MAX;
	if (chroma < NEUTRAL_CHROMA) {
		return { kind: "neutral", name: neutralName(l) };
	}
	let tone: ColorTone = "normal";
	if (chroma < GRAYISH_CHROMA) {
		tone = "grayish";
	} else if (chroma > VIBRANT_CHROMA) {
		tone = "vibrant";
	}
	let shade: ColorShade = "normal";
	if (l < DARK_LIGHTNESS) {
		shade = "dark";
	} else if (l > LIGHT_SHADE_LIGHTNESS) {
		shade = "light";
	}
	return { kind: "chromatic", hue: hueName(hue, l), shade, tone };
}
