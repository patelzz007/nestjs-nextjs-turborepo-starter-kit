// The date selector's value (components/date-selector.tsx): the phone port of
// the web kit's lib/date-selector/value.ts. A value is a period (a day, a
// month, a quarter, a half year or a year), a filter (on, before, after or
// between) and the picked period or the two ends of a range. Days are
// calendar days (`YYYY-MM-DD`), never `Date`s, so no time zone moves them.
// Formatting and typed-entry parsing take the caller's labels and day
// format, for another language. Pure, so every case is tested without
// rendering.

import type { LocalDate } from "@workspace/shared";
import { z } from "zod";

export const DateSelectorFilterTypeSchema = z.enum(["is", "before", "after", "between"]);
export const DateSelectorPeriodTypeSchema = z.enum(["day", "month", "quarter", "half-year", "year"]);

/** The granularity a date selector picks at. */
export type DateSelectorPeriodType = z.output<typeof DateSelectorPeriodTypeSchema>;

/** How the picked day or period filters: on it, before it, after it, or between two of them. */
export type DateSelectorFilterType = z.output<typeof DateSelectorFilterTypeSchema>;

export const DATE_SELECTOR_PERIOD_TYPES: readonly DateSelectorPeriodType[] = DateSelectorPeriodTypeSchema.options;
export const DATE_SELECTOR_FILTER_TYPES: readonly DateSelectorFilterType[] = DateSelectorFilterTypeSchema.options;

/** One period of a year: the year plus the period's zero-based index (month 0–11, quarter 0–3, half 0–1; 0 for a whole year). */
export interface DateSelectorPeriodPoint {
	readonly year: number;
	readonly value: number;
}

/** A date selector's value: the period, the filter, and whichever selection fields that period uses. */
export interface DateSelectorValue {
	readonly period: DateSelectorPeriodType;
	readonly operator: DateSelectorFilterType;
	readonly startDate?: LocalDate | undefined;
	readonly endDate?: LocalDate | undefined;
	readonly year?: number | undefined;
	readonly month?: number | undefined;
	readonly quarter?: number | undefined;
	readonly halfYear?: number | undefined;
	readonly rangeStart?: DateSelectorPeriodPoint | undefined;
	readonly rangeEnd?: DateSelectorPeriodPoint | undefined;
}

/** The period names formatting needs. */
export interface DateSelectorPeriodNames {
	readonly monthsShort: readonly string[];
	readonly quarters: readonly string[];
	readonly halfYears: readonly string[];
}

/** How a day is written and typed. */
export const DateSelectorDayFormatSchema = z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"]);
export type DateSelectorDayFormat = z.output<typeof DateSelectorDayFormatSchema>;
export const DEFAULT_DATE_SELECTOR_DAY_FORMAT: DateSelectorDayFormat = "dd/MM/yyyy";

/** Typed years outside this window are treated as a typo, not a value. */
export const MIN_PARSED_YEAR = 1900;
export const MAX_PARSED_YEAR = 2100;

/** Orders period points by one number: `year * factor + value` (a period index never reaches the factor). */
const PERIOD_KEY_YEAR_FACTOR = 100;
/** Joins the two ends of a range in the formatted value. */
const RANGE_SEPARATOR = " – ";
const TWO_DIGITS = 2;
const YEAR_DIGITS = 4;
const MONTHS_PER_YEAR = 12;

const YEAR_PATTERN = /^(?<year>\d{4})$/u;
const QUARTER_PATTERN = /^Q(?<quarter>[1-4])(?:\s+(?<year>\d{4}))?$/iu;
const DAY_PATTERNS: Readonly<Record<DateSelectorDayFormat, RegExp>> = {
	"dd/MM/yyyy": /^(?<day>\d{1,2})\/(?<month>\d{1,2})\/(?<year>\d{4})$/u,
	"MM/dd/yyyy": /^(?<month>\d{1,2})\/(?<day>\d{1,2})\/(?<year>\d{4})$/u,
	"yyyy-MM-dd": /^(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})$/u,
	"dd.MM.yyyy": /^(?<day>\d{1,2})\.(?<month>\d{1,2})\.(?<year>\d{4})$/u,
};

/** One sortable number per period point. */
export function periodKey(point: DateSelectorPeriodPoint): number {
	return point.year * PERIOD_KEY_YEAR_FACTOR + point.value;
}

/** Whether `point` lies within `[start, end]` (inclusive); false without both ends. */
export function isPeriodInRange(point: DateSelectorPeriodPoint, start: DateSelectorPeriodPoint | undefined, end: DateSelectorPeriodPoint | undefined): boolean {
	if (start === undefined || end === undefined) {
		return false;
	}
	const key = periodKey(point);
	return key >= periodKey(start) && key <= periodKey(end);
}

/** The next range after picking `point`: a fresh start, or the other end (swapped when it comes first). */
export function nextPeriodRange(value: DateSelectorValue, point: DateSelectorPeriodPoint): DateSelectorValue {
	const { rangeStart, rangeEnd } = value;
	if (rangeStart === undefined || rangeEnd !== undefined) {
		return { ...value, rangeStart: point, rangeEnd: undefined };
	}
	if (periodKey(point) < periodKey(rangeStart)) {
		return { ...value, rangeStart: point, rangeEnd: rangeStart };
	}
	return { ...value, rangeEnd: point };
}

/** The value with `point` picked as the one period (not a range). */
export function withPeriodPoint(value: DateSelectorValue, point: DateSelectorPeriodPoint): DateSelectorValue {
	switch (value.period) {
		case "month":
			return { ...value, year: point.year, month: point.value };
		case "quarter":
			return { ...value, year: point.year, quarter: point.value };
		case "half-year":
			return { ...value, year: point.year, halfYear: point.value };
		case "day":
		case "year":
			return { ...value, year: point.year };
		default:
			return assertNeverPeriod(value.period);
	}
}

/** The picked period of a single (not range) value, if any. */
export function pickedPeriodIndex(value: DateSelectorValue): number | undefined {
	switch (value.period) {
		case "month":
			return value.month;
		case "quarter":
			return value.quarter;
		case "half-year":
			return value.halfYear;
		case "day":
		case "year":
			return value.year === undefined ? undefined : 0;
		default:
			return assertNeverPeriod(value.period);
	}
}

/** The value with nothing picked: only its period and filter kept. */
export function clearedDateSelectorValue(value: DateSelectorValue): DateSelectorValue {
	return { period: value.period, operator: value.operator };
}

/** The years a period grid lists: `minYear`…`maxYear`, both included. */
export function yearsBetween(minYear: number, maxYear: number): readonly number[] {
	return Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_year: undefined, offset: number): number => minYear + offset);
}

function pad(value: number, digits: number): string {
	return String(value).padStart(digits, "0");
}

/** A calendar day written in `dayFormat`. */
export function formatSelectorDay(day: LocalDate, dayFormat: DateSelectorDayFormat): string {
	const [year = "", month = "", date = ""] = day.split("-");
	switch (dayFormat) {
		case "dd/MM/yyyy":
			return `${date}/${month}/${year}`;
		case "MM/dd/yyyy":
			return `${month}/${date}/${year}`;
		case "dd.MM.yyyy":
			return `${date}.${month}.${year}`;
		case "yyyy-MM-dd":
			return day;
		default:
			return assertNeverFormat(dayFormat);
	}
}

function periodName(names: readonly string[], index: number): string {
	return names.at(index) ?? "";
}

function formatNamedPeriod(value: DateSelectorValue, index: number | undefined, names: readonly string[]): string {
	const { year, rangeStart, rangeEnd } = value;
	if (rangeStart !== undefined && rangeEnd !== undefined) {
		return `${periodName(names, rangeStart.value)} ${String(rangeStart.year)}${RANGE_SEPARATOR}${periodName(names, rangeEnd.value)} ${String(rangeEnd.year)}`;
	}
	return year !== undefined && index !== undefined ? `${periodName(names, index)} ${String(year)}` : "";
}

/** The text of a value (`15/11/2026`, `Q1 2026 – Q3 2026`, `2024`); empty when nothing is picked. */
export function formatDateSelectorValue(
	value: DateSelectorValue,
	names: DateSelectorPeriodNames,
	dayFormat: DateSelectorDayFormat = DEFAULT_DATE_SELECTOR_DAY_FORMAT,
): string {
	switch (value.period) {
		case "day": {
			const { startDate, endDate } = value;
			if (startDate !== undefined && endDate !== undefined) {
				return `${formatSelectorDay(startDate, dayFormat)}${RANGE_SEPARATOR}${formatSelectorDay(endDate, dayFormat)}`;
			}
			return startDate === undefined ? "" : formatSelectorDay(startDate, dayFormat);
		}
		case "month":
			return formatNamedPeriod(value, value.month, names.monthsShort);
		case "quarter":
			return formatNamedPeriod(value, value.quarter, names.quarters);
		case "half-year":
			return formatNamedPeriod(value, value.halfYear, names.halfYears);
		case "year": {
			const { year, rangeStart, rangeEnd } = value;
			if (rangeStart !== undefined && rangeEnd !== undefined) {
				return `${String(rangeStart.year)}${RANGE_SEPARATOR}${String(rangeEnd.year)}`;
			}
			return year === undefined ? "" : String(year);
		}
		default:
			return assertNeverPeriod(value.period);
	}
}

function isParsableYear(year: number): boolean {
	return year >= MIN_PARSED_YEAR && year <= MAX_PARSED_YEAR;
}

/** The days in a month (the 0th day of the next month is this month's last). */
function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseDay(text: string, dayFormat: DateSelectorDayFormat): LocalDate | null {
	const groups = DAY_PATTERNS[dayFormat].exec(text)?.groups;
	if (groups === undefined) {
		return null;
	}
	const year = Number(groups.year);
	const month = Number(groups.month);
	const day = Number(groups.day);
	if (!isParsableYear(year) || month < 1 || month > MONTHS_PER_YEAR || day < 1 || day > daysInMonth(year, month)) {
		return null;
	}
	return `${pad(year, YEAR_DIGITS)}-${pad(month, TWO_DIGITS)}-${pad(day, TWO_DIGITS)}`;
}

export interface ParseDateSelectorInputOptions {
	readonly operator: DateSelectorFilterType;
	/** The formats a typed day is read in, the display format first. */
	readonly dayFormats: readonly DateSelectorDayFormat[];
	/** Today: a bare quarter (`Q2`) is in this year. */
	readonly today: LocalDate;
}

/** Reads typed text — a year (`2025`), a quarter (`Q4`, `Q1 2025`) or a day in one of `dayFormats` — into a value; `null` when it is none of them. */
export function parseDateSelectorInput(text: string, { operator, dayFormats, today }: ParseDateSelectorInputOptions): DateSelectorValue | null {
	const trimmed = text.trim();
	if (trimmed === "") {
		return null;
	}
	const yearText = YEAR_PATTERN.exec(trimmed)?.groups?.year;
	if (yearText !== undefined && isParsableYear(Number(yearText))) {
		return { period: "year", operator, year: Number(yearText) };
	}
	const quarterGroups = QUARTER_PATTERN.exec(trimmed)?.groups;
	if (quarterGroups?.quarter !== undefined) {
		const year = quarterGroups.year === undefined ? Number(today.slice(0, YEAR_DIGITS)) : Number(quarterGroups.year);
		if (isParsableYear(year)) {
			return { period: "quarter", operator, year, quarter: Number(quarterGroups.quarter) - 1 };
		}
	}
	for (const dayFormat of dayFormats) {
		const day = parseDay(trimmed, dayFormat);
		if (day !== null) {
			return { period: "day", operator, startDate: day };
		}
	}
	return null;
}

function assertNeverPeriod(value: never): never {
	throw new Error(`Unhandled date selector period: ${String(value)}`);
}

function assertNeverFormat(value: never): never {
	throw new Error(`Unhandled day format: ${String(value)}`);
}
