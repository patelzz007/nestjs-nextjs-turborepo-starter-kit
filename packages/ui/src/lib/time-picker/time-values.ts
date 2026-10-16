/**
 * The time picker's value model: a time of day, its string value format (the
 * one `<input type="time">` uses) and the parser for what a person types.
 * Pure functions only — the components live in `components/time-picker.tsx`.
 */

/** A time of day. `hour` runs from 0 to 23 whatever the hour cycle. */
export interface TimePickerTime {
	readonly hour: number;
	readonly minute: number;
	readonly second: number;
}

/** The finest column, and the precision of the value the picker emits. */
export type TimePickerGranularity = "hour" | "minute" | "second";

export type TimePickerHourCycle = 12 | 24;

export type TimePickerPeriod = "am" | "pm";

/** Where AM/PM goes: after the time in English, before it in Chinese, Japanese and Korean. */
export type TimePickerPeriodPosition = "start" | "end";

export type TimePickerUnit = "hour" | "minute" | "second";

export type TimePickerColumnType = TimePickerUnit | "period";

/** The localized AM/PM words the typed-input parser recognises. */
export interface TimePickerPeriodLabels {
	readonly am: string;
	readonly pm: string;
}

export const HOURS_PER_DAY = 24;
/** Hours in one half of the day (AM or PM). */
export const HOURS_PER_PERIOD = 12;
export const MINUTES_PER_HOUR = 60;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
/** Every segment of the value format is written with two digits. */
export const SEGMENT_DIGITS = 2;

/** Hour, minute and second. */
const MAX_TIME_FIELDS = 3;
/** Packed digits hold at most `HHmmss`. */
const MAX_PACKED_DIGITS = 6;
/** Code point of the Arabic-Indic digit zero (U+0660). */
const ARABIC_INDIC_ZERO = 0x660;
/** Code point of the Extended Arabic-Indic (Persian) digit zero (U+06F0). */
const PERSIAN_ZERO = 0x6f0;

/** `HH:mm` or `HH:mm:ss`, with an optional fraction of a second that is dropped. */
const TIME_VALUE_PATTERN = /^\s*(?<hour>\d{1,2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:\.\d+)?)?\s*$/u;
/** A trailing `a`, `a.m.`, `p`, `pm` … typed after the digits. */
const PERIOD_SUFFIX_PATTERN = /\s*(?<letter>[ap])\.?\s*(?:m\.?)?$/u;
/** Anything left besides digits, spaces and the separators `:`, `.` and `h`. */
const UNEXPECTED_CHARACTER_PATTERN = /[^\d\s:.h]/u;
const NON_DIGIT_RUN_PATTERN = /\D+/u;
const ARABIC_INDIC_DIGIT_PATTERN = /[٠-٩]/gu;
const PERSIAN_DIGIT_PATTERN = /[۰-۹]/gu;
/** No-break space and narrow no-break space, which `Intl` puts around the period. */
const NO_BREAK_SPACE_PATTERN = /[\u{a0}\u{202f}]/gu;

/** Two-digit, zero-padded segment. */
export function padSegment(value: number): string {
	return String(value).padStart(SEGMENT_DIGITS, "0");
}

export function toSeconds(time: TimePickerTime): number {
	return time.hour * SECONDS_PER_HOUR + time.minute * SECONDS_PER_MINUTE + time.second;
}

export function periodOf(hour: number): TimePickerPeriod {
	return hour < HOURS_PER_PERIOD ? "am" : "pm";
}

/** The hour as a 12-hour clock shows it: 1 to 12. */
export function toTwelveHour(hour: number): number {
	const inPeriod = hour % HOURS_PER_PERIOD;
	return inPeriod === 0 ? HOURS_PER_PERIOD : inPeriod;
}

export function sameTime(left: TimePickerTime | null, right: TimePickerTime | null): boolean {
	if (left === null || right === null) {
		return left === right;
	}
	return toSeconds(left) === toSeconds(right);
}

function isValidTime(time: TimePickerTime): boolean {
	return time.hour < HOURS_PER_DAY && time.minute < MINUTES_PER_HOUR && time.second < SECONDS_PER_MINUTE;
}

/**
 * Reads the value format, the one `<input type="time">` uses: `HH:mm` or
 * `HH:mm:ss` in 24-hour time. A fraction of a second is dropped. Anything
 * else, `""` and `24:00` included, reads as no value.
 */
export function parseTimeValue(value: string | null | undefined): TimePickerTime | null {
	const groups = TIME_VALUE_PATTERN.exec(value ?? "")?.groups;
	if (groups === undefined) {
		return null;
	}
	const time: TimePickerTime = {
		hour: Number(groups.hour ?? ""),
		minute: Number(groups.minute ?? ""),
		second: Number(groups.second ?? "0"),
	};
	return isValidTime(time) ? time : null;
}

/** Writes the value format: `HH:mm`, or `HH:mm:ss` at `second` granularity. */
export function formatTimeValue(time: TimePickerTime, granularity: TimePickerGranularity = "minute"): string {
	const value = `${padSegment(time.hour)}:${padSegment(time.minute)}`;
	return granularity === "second" ? `${value}:${padSegment(time.second)}` : value;
}

function digitFrom(zeroCodePoint: number): (digit: string) => string {
	return (digit: string): string => String((digit.codePointAt(0) ?? zeroCodePoint) - zeroCodePoint);
}

/** NFKC folds full-width digits and colons; Arabic-Indic and Persian digits need their own map. */
export function normalizeTyped(text: string): string {
	return text
		.normalize("NFKC")
		.replace(ARABIC_INDIC_DIGIT_PATTERN, digitFrom(ARABIC_INDIC_ZERO))
		.replace(PERSIAN_DIGIT_PATTERN, digitFrom(PERSIAN_ZERO))
		.replace(NO_BREAK_SPACE_PATTERN, " ")
		.toLowerCase();
}

export interface ParseTimeInputOptions {
	readonly hourCycle?: TimePickerHourCycle | undefined;
	/** The period a 12-hour time typed without one takes. Defaults to `am`. */
	readonly period?: TimePickerPeriod | undefined;
	/** Localized AM/PM words recognised on either side of the time. */
	readonly labels?: TimePickerPeriodLabels | undefined;
}

interface TypedPeriod {
	readonly period: TimePickerPeriod | undefined;
	readonly rest: string;
}

/** Takes a localized period word, or a trailing `a`/`p` suffix, off the typed text. */
function extractPeriod(source: string, labels: TimePickerPeriodLabels | undefined): TypedPeriod {
	if (labels !== undefined) {
		/* Localized labels first, PM before AM: a lone "a" would also match inside "am". */
		const candidates: readonly (readonly [label: string, period: TimePickerPeriod])[] = [
			[labels.pm, "pm"],
			[labels.am, "am"],
		];
		for (const [label, period] of candidates) {
			const needle = normalizeTyped(label).trim();
			if (needle !== "" && source.includes(needle)) {
				return { period, rest: source.replace(needle, " ").trim() };
			}
		}
	}
	const suffix = PERIOD_SUFFIX_PATTERN.exec(source);
	if (suffix === null) {
		return { period: undefined, rest: source };
	}
	return { period: suffix.groups?.letter === "a" ? "am" : "pm", rest: source.slice(0, suffix.index) };
}

/** Splits packed digits — `930`, `0930`, `93015`, `093015` — into hour, minute and second. */
function unpackDigits(digits: string): string[] | null {
	if (digits.length > MAX_PACKED_DIGITS) {
		return null;
	}
	const hourLength = digits.length % SEGMENT_DIGITS === 1 ? 1 : SEGMENT_DIGITS;
	const fields = [digits.slice(0, hourLength)];
	for (let index = hourLength; index < digits.length; index += SEGMENT_DIGITS) {
		fields.push(digits.slice(index, index + SEGMENT_DIGITS));
	}
	return fields;
}

function splitFields(source: string): string[] | null {
	const parts = source.split(NON_DIGIT_RUN_PATTERN).filter((part: string): boolean => part !== "");
	const [only] = parts;
	if (parts.length === 1 && only !== undefined && only.length > SEGMENT_DIGITS) {
		return unpackDigits(only);
	}
	return parts;
}

/**
 * Reads what a person types into `TimePickerInput`: `9`, `930`, `0930`,
 * `9:30`, `14.30`, `14h30`, `2:30 pm`, `2p`, a localized period on either
 * side, and full-width, Arabic-Indic or Persian digits. A 12-hour time typed
 * without a period takes `period`.
 */
export function parseTimeInput(text: string, options: ParseTimeInputOptions = {}): TimePickerTime | null {
	const { period: typedPeriod, rest } = extractPeriod(normalizeTyped(text).trim(), options.labels);
	if (UNEXPECTED_CHARACTER_PATTERN.test(rest)) {
		return null;
	}
	const fields = splitFields(rest);
	if (fields === null || fields.length === 0 || fields.length > MAX_TIME_FIELDS) {
		return null;
	}
	const [hourField, minuteField = "0", secondField = "0"] = fields;
	if (hourField === undefined) {
		return null;
	}
	if (fields.slice(1).some((field: string): boolean => field.length !== SEGMENT_DIGITS)) {
		return null;
	}
	const typedHour = Number(hourField);
	const minute = Number(minuteField);
	const second = Number(secondField);
	if (minute >= MINUTES_PER_HOUR || second >= SECONDS_PER_MINUTE) {
		return null;
	}
	const fitsTwelveHour = typedHour >= 1 && typedHour <= HOURS_PER_PERIOD;
	const period = typedPeriod ?? (options.hourCycle === 12 && fitsTwelveHour ? (options.period ?? "am") : undefined);
	if (period === undefined) {
		return typedHour < HOURS_PER_DAY ? { hour: typedHour, minute, second } : null;
	}
	if (!fitsTwelveHour) {
		return null;
	}
	return { hour: (typedHour % HOURS_PER_PERIOD) + (period === "pm" ? HOURS_PER_PERIOD : 0), minute, second };
}
