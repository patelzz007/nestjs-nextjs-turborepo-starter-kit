// A GitHub label's own colour (data from GitHub, not a design token) and the
// text colour that stays readable on it. Pure.

/** Relative luminance above which dark text contrasts more than light text. */
const LIGHT_BACKGROUND_LUMINANCE = 0.45;

/** WCAG 2 relative luminance: the sRGB transfer function and the channel weights. */
const SRGB = { linearThreshold: 0.039_28, linearDivisor: 12.92, offset: 0.055, scale: 1.055, gamma: 2.4 };
const LUMINANCE_WEIGHTS = { red: 0.2126, green: 0.7152, blue: 0.0722 };

const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const HEX_PAIR_LENGTH = 2;
const CHANNEL_STARTS = { red: 0, green: 2, blue: 4 };

const DARK_TEXT = "#000000";
const LIGHT_TEXT = "#ffffff";

/** sRGB channel → linear light. */
function linear(channel: number): number {
	const value = channel / CHANNEL_MAX;
	return value <= SRGB.linearThreshold ? value / SRGB.linearDivisor : ((value + SRGB.offset) / SRGB.scale) ** SRGB.gamma;
}

function channelOf(hex: string, start: number): number {
	return Number.parseInt(hex.slice(start, start + HEX_PAIR_LENGTH), HEX_RADIX);
}

/** The WCAG relative luminance of a six-digit hex colour, 0 (black) to 1 (white). */
export function relativeLuminance(color: string): number {
	return (
		LUMINANCE_WEIGHTS.red * linear(channelOf(color, CHANNEL_STARTS.red)) +
		LUMINANCE_WEIGHTS.green * linear(channelOf(color, CHANNEL_STARTS.green)) +
		LUMINANCE_WEIGHTS.blue * linear(channelOf(color, CHANNEL_STARTS.blue))
	);
}

export interface LabelColors {
	readonly background: string;
	readonly text: string;
}

/** `a2eeef` → its background and black or white text, whichever contrasts more. */
export function labelColors(color: string): LabelColors {
	return { background: `#${color}`, text: relativeLuminance(color) > LIGHT_BACKGROUND_LUMINANCE ? DARK_TEXT : LIGHT_TEXT };
}
