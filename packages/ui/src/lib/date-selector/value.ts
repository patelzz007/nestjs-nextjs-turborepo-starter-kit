import { format, isSameMonth, isValid, parse } from "date-fns";

/** The granularity a date selector picks at. */
export type DateSelectorPeriodType = "day" | "month" | "quarter" | "half-year" | "year";

/** How the picked date / period filters: on it, before it, after it, or between two of them. */
export type DateSelectorFilterType = "is" | "before" | "after" | "between";

/** One period of a year: the year plus the period's zero-based index (month 0–11, quarter 0–3, half 0–1; 0 for a whole year). */
export interface DateSelectorPeriodPoint {
	readonly year: number;
	readonly value: number;
}

/** A date selector's value — the period, the filter operator, and whichever selection fields that period uses. */
export interface DateSelectorValue {
	readonly period: DateSelectorPeriodType;
	readonly operator: DateSelectorFilterType;
	readonly startDate?: Date | undefined;
	readonly endDate?: Date | undefined;
	readonly year?: number | undefined;
	readonly month?: number | undefined;
	readonly quarter?: number | undefined;
	readonly halfYear?: number | undefined;
	readonly rangeStart?: DateSelectorPeriodPoint | undefined;
	readonly rangeEnd?: DateSelectorPeriodPoint | undefined;
}

/** The period names `formatDateValue` needs (a subset of the date selector's labels). */
export interface DateSelectorPeriodNames {
	readonly monthsShort: readonly string[];
	readonly quarters: readonly string[];
	readonly halfYears: readonly string[];
}

/** Where a calendar month sits against today's month. */
export type DateSelectorMonthPosition = "current" | "future" | "past";

/** date-fns pattern for a day when the caller passes none. */
export const DEFAULT_DAY_DATE_FORMAT = "MM/dd/yyyy";

/** Day formats tried after the caller's own when parsing typed text. */
export const FALLBACK_DAY_DATE_FORMATS: readonly string[] = ["dd/MM/yyyy", "yyyy-MM-dd", "MM-dd-yyyy", "dd-MM-yyyy"];

/** Typed years outside this window are treated as a typo, not a value. */
export const MIN_PARSED_YEAR = 1900;
export const MAX_PARSED_YEAR = 2100;

/** Orders period points by one number: `year * factor + value` (a period index never reaches the factor). */
const PERIOD_KEY_YEAR_FACTOR = 100;

/** Joins the two ends of a range in the formatted value. */
const RANGE_SEPARATOR = " - ";

const YEAR_PATTERN = /^(?<year>\d{4})$/u;
const QUARTER_PATTERN = /^Q(?<quarter>[1-4])(?:\s+(?<year>\d{4}))?$/iu;

/** The name of a period at `index`, or an empty string when the list has no such entry. */
export function periodName(names: readonly string[], index: number): string {
	return names.at(index) ?? "";
}

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

/** Whether `year` lies within the years of `[start, end]` (inclusive); false without both ends. */
export function isYearInPeriodRange(year: number, start: DateSelectorPeriodPoint | undefined, end: DateSelectorPeriodPoint | undefined): boolean {
	if (start === undefined || end === undefined) {
		return false;
	}
	return year >= start.year && year <= end.year;
}

export interface YearListOptions {
	readonly currentYear: number;
	readonly yearRange: number;
	readonly minYear?: number | undefined;
	readonly maxYear?: number | undefined;
}

/** The years a period grid lists: `minYear…maxYear` when both are set, otherwise `yearRange` years centred on `currentYear`. */
export function buildYearList({ currentYear, yearRange, minYear, maxYear }: YearListOptions): number[] {
	if (minYear !== undefined && maxYear !== undefined) {
		return Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_unused: undefined, offset: number): number => minYear + offset);
	}
	const firstYear = currentYear - Math.floor(yearRange / 2);
	return Array.from({ length: Math.max(0, yearRange) }, (_unused: undefined, offset: number): number => firstYear + offset);
}

/** Where `month` sits against the month of `today`; no month counts as the current one. */
export function getMonthPosition(month: Date | undefined, today: Date): DateSelectorMonthPosition {
	if (month === undefined || isSameMonth(month, today)) {
		return "current";
	}
	return month > today ? "future" : "past";
}

function formatPeriodRange(start: DateSelectorPeriodPoint, end: DateSelectorPeriodPoint, names: readonly string[]): string {
	return `${periodName(names, start.value)} ${String(start.year)}${RANGE_SEPARATOR}${periodName(names, end.value)} ${String(end.year)}`;
}

function formatNamedPeriod(value: DateSelectorValue, index: number | undefined, names: readonly string[]): string {
	const { year, rangeStart, rangeEnd } = value;
	if (rangeStart !== undefined && rangeEnd !== undefined) {
		return formatPeriodRange(rangeStart, rangeEnd, names);
	}
	if (year !== undefined && index !== undefined) {
		return `${periodName(names, index)} ${String(year)}`;
	}
	return "";
}

function formatDayValue({ startDate, endDate }: DateSelectorValue, dayDateFormat: string): string {
	if (startDate !== undefined && endDate !== undefined) {
		return `${format(startDate, dayDateFormat)}${RANGE_SEPARATOR}${format(endDate, dayDateFormat)}`;
	}
	return startDate === undefined ? "" : format(startDate, dayDateFormat);
}

function formatYearValue({ year, rangeStart, rangeEnd }: DateSelectorValue): string {
	if (rangeStart !== undefined && rangeEnd !== undefined) {
		return `${String(rangeStart.year)}${RANGE_SEPARATOR}${String(rangeEnd.year)}`;
	}
	return year === undefined ? "" : String(year);
}

/** The human-readable text of a value, e.g. `03/14/2026`, `Q1 2026 - Q3 2026`, `2024`; empty when nothing is selected. */
export function formatDateValue(value: DateSelectorValue, names: DateSelectorPeriodNames, dayDateFormat: string = DEFAULT_DAY_DATE_FORMAT): string {
	switch (value.period) {
		case "day":
			return formatDayValue(value, dayDateFormat);
		case "month":
			return formatNamedPeriod(value, value.month, names.monthsShort);
		case "quarter":
			return formatNamedPeriod(value, value.quarter, names.quarters);
		case "half-year":
			return formatNamedPeriod(value, value.halfYear, names.halfYears);
		case "year":
			return formatYearValue(value);
		default:
			return assertNeverPeriod(value.period);
	}
}

function assertNeverPeriod(value: never): never {
	throw new Error(`Unhandled date selector period: ${String(value)}`);
}

/** The day formats to parse typed text with: the display format first, then the caller's extras (or the fallbacks), without duplicates. */
export function resolveDayDateFormats(dayDateFormat: string, dayDateFormats: readonly string[] | undefined): string[] {
	const extras = dayDateFormats !== undefined && dayDateFormats.length > 0 ? dayDateFormats : FALLBACK_DAY_DATE_FORMATS;
	return Array.from(new Set([dayDateFormat, ...extras]));
}

function isParsableYear(year: number): boolean {
	return year >= MIN_PARSED_YEAR && year <= MAX_PARSED_YEAR;
}

export interface ParseDateSelectorInputOptions {
	readonly operator: DateSelectorFilterType;
	readonly dateFormats: readonly string[];
	/** The date relative to which a bare quarter (`Q2`) and partial dates resolve. */
	readonly referenceDate: Date;
}

/** Parses typed text — a year (`2025`), a quarter (`Q4`, `Q1 2025`) or a day in one of `dateFormats` — into a value; `null` when it is none of them. */
export function parseDateSelectorInput(text: string, { operator, dateFormats, referenceDate }: ParseDateSelectorInputOptions): DateSelectorValue | null {
	const trimmed = text.trim();
	if (trimmed === "") {
		return null;
	}

	const yearText = YEAR_PATTERN.exec(trimmed)?.groups?.year;
	if (yearText !== undefined) {
		const year = Number(yearText);
		if (isParsableYear(year)) {
			return { period: "year", operator, year };
		}
	}

	const quarterGroups = QUARTER_PATTERN.exec(trimmed)?.groups;
	const quarterText = quarterGroups?.quarter;
	if (quarterText !== undefined) {
		const quarterYearText = quarterGroups?.year;
		const year = quarterYearText === undefined ? referenceDate.getFullYear() : Number(quarterYearText);
		if (isParsableYear(year)) {
			return { period: "quarter", operator, year, quarter: Number(quarterText) - 1 };
		}
	}

	for (const dateFormat of dateFormats) {
		const parsed = parse(trimmed, dateFormat, referenceDate);
		if (isValid(parsed) && isParsableYear(parsed.getFullYear())) {
			return { period: "day", operator, startDate: parsed };
		}
	}

	return null;
}
