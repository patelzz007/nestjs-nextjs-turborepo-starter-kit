/**
 * Reading and writing one channel as field text, for the colour picker's
 * channel inputs (ported from reui).
 */
import { formatColor } from "@workspace/ui/lib/color/color-format";
import { parseColor } from "@workspace/ui/lib/color/color-parse";
import {
	ALPHA_MAX,
	channelRange,
	clamp,
	formatFixed,
	HUE_MAX_DEGREES,
	PERCENT_MAX,
	radiansToDegrees,
	readChannel,
	withChannel,
	wrapHue,
	type ColorPickerChannel,
	type ColorPickerColor,
	type ColorPickerColorSpace,
} from "@workspace/ui/lib/color/color-space";

/** A field's channel: a colour channel, or `"hex"` for the six hex digits. */
export type ColorFieldChannel = ColorPickerChannel | "hex";

const FIELD_NUMBER_PATTERN = /^(?<value>[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))\s*(?<unit>%|°|deg|grad|rad|turn)?$/u;
const HEX_DIGITS_PATTERN = /^[\da-f]+$/iu;
const LEADING_HASH_PATTERN = /^#/u;
const DECIMAL_COMMA = ",";
const GRADIANS_TO_DEGREES = 0.9;
/** Hex digit counts that carry their own alpha (`#rgba`, `#rrggbbaa`). */
const SHORT_HEX_WITH_ALPHA_LENGTH = 4;
const LONG_HEX_WITH_ALPHA_LENGTH = 8;
const CHROMA_TEXT_DIGITS = 3;
const OKLCH_TEXT_DIGITS = 1;

/** A channel's text in a field: six hex digits, a percentage, a rounded number. */
export function channelText(color: ColorPickerColor, space: ColorPickerColorSpace, channel: ColorFieldChannel): string {
	if (channel === "hex") {
		return formatColor({ ...color, alpha: ALPHA_MAX }, "hex")
			.slice(1)
			.toUpperCase();
	}
	if (channel === "alpha") {
		return `${String(Math.round(color.alpha * PERCENT_MAX))}%`;
	}
	const value = readChannel(color, space, channel);
	if (channel === "chroma") {
		return formatFixed(value, CHROMA_TEXT_DIGITS);
	}
	return space === "oklch" ? formatFixed(value, OKLCH_TEXT_DIGITS) : String(Math.round(value));
}

function readHexText(text: string, color: ColorPickerColor): ColorPickerColor | null {
	const digits = text.trim().replace(LEADING_HASH_PATTERN, "");
	const parsed = HEX_DIGITS_PATTERN.test(digits) ? parseColor(digits) : null;
	if (parsed === null) {
		return null;
	}
	/* Hex keeps the current opacity unless it carries its own. */
	return digits.length === SHORT_HEX_WITH_ALPHA_LENGTH || digits.length === LONG_HEX_WITH_ALPHA_LENGTH ? parsed : { ...parsed, alpha: color.alpha };
}

function angleToDegrees(value: number, unit: string | undefined): number {
	switch (unit) {
		case "rad":
			return radiansToDegrees(value);
		case "grad":
			return value * GRADIANS_TO_DEGREES;
		case "turn":
			return value * HUE_MAX_DEGREES;
		default:
			return value;
	}
}

/**
 * A typed channel. A number takes a comma decimal; % is a share of the
 * channel's range, as in CSS (50% red is 127.5, 50% chroma 0.2), and a hue
 * takes an angle unit and wraps, so -30 is 330. Anything else is `null`.
 */
export function readChannelText(text: string, color: ColorPickerColor, space: ColorPickerColorSpace, channel: ColorFieldChannel): ColorPickerColor | null {
	if (channel === "hex") {
		return readHexText(text, color);
	}
	const groups = FIELD_NUMBER_PATTERN.exec(text.trim().toLowerCase())?.groups;
	if (groups?.value === undefined) {
		return null;
	}
	const value = Number(groups.value.replace(DECIMAL_COMMA, "."));
	const unit = groups.unit;
	if (!Number.isFinite(value)) {
		return null;
	}
	if (channel === "hue") {
		return unit === "%" ? null : withChannel(color, space, channel, wrapHue(angleToDegrees(value, unit)));
	}
	if (unit !== undefined && unit !== "%") {
		return null;
	}
	if (channel === "alpha") {
		return { ...color, alpha: clamp(value / PERCENT_MAX, 0, ALPHA_MAX) };
	}
	const { max } = channelRange(space, channel);
	const scaled = unit === "%" ? (value * max) / PERCENT_MAX : value;
	return withChannel(color, space, channel, clamp(scaled, 0, max));
}
