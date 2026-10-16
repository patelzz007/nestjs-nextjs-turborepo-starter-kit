import { addDays, addMonths, addWeeks, addYears, format, isValid, parse, startOfDay } from "date-fns";

import {
	FILTER_TIME_PATTERN,
	FilterDateValueSchema,
	FilterRelativeDateUnitSchema,
	type FilterDateValue,
	type FilterLabels,
	type FilterRelativeDate,
	type FilterRelativeDateUnit,
} from "./filters-types";

/**
 * Date helpers for a consumer's date editor. A date filter value is DATA, not a
 * `Date` (see `FilterDateValue`): an absolute day stays one day, a relative one
 * is re-resolved on every read. Every function takes `now` explicitly, so the
 * clock is the caller's and the helpers stay pure (rules/00, dates and time).
 */

export const FILTER_DATE_FORMAT = "yyyy-MM-dd";
/** The display pattern `formatFilterDate` uses when the caller names none. */
export const FILTER_DATE_DISPLAY_FORMAT = "MMM d, yyyy";

export const RELATIVE_TODAY: FilterRelativeDate = { unit: "day", offset: 0 };
export const RELATIVE_TOMORROW: FilterRelativeDate = { unit: "day", offset: 1 };
export const RELATIVE_YESTERDAY: FilterRelativeDate = { unit: "day", offset: -1 };
export const RELATIVE_NEXT_WEEK: FilterRelativeDate = { unit: "week", offset: 1 };

/** Days in a week, for the weekday arithmetic of `parseFilterDate`. */
const DAYS_PER_WEEK = 7;
/** Radix for `Number.parseInt`. */
const DECIMAL_RADIX = 10;

export function applyFilterRelative(relative: FilterRelativeDate, now: Date): Date {
	const base = startOfDay(now);
	switch (relative.unit) {
		case "day":
			return addDays(base, relative.offset);
		case "week":
			return addWeeks(base, relative.offset);
		case "month":
			return addMonths(base, relative.offset);
		case "year":
			return addYears(base, relative.offset);
		default:
			return assertNeverFilterDateUnit(relative.unit);
	}
}

function assertNeverFilterDateUnit(value: never): never {
	throw new Error(`Unhandled relative date unit: ${JSON.stringify(value)}`);
}

export function resolveFilterDate(value: FilterDateValue | undefined, now: Date): Date | null {
	if (value === undefined) {
		return null;
	}
	if (value.relative !== undefined) {
		return applyFilterRelative(value.relative, now);
	}
	if (value.date !== undefined) {
		const parsed = parse(value.date, FILTER_DATE_FORMAT, now);
		return isValid(parsed) ? parsed : null;
	}
	return null;
}

export function toFilterDateValue(date: Date, time?: string): FilterDateValue {
	const day = format(date, FILTER_DATE_FORMAT);
	return time === undefined || time === "" ? { date: day } : { date: day, time };
}

/* ----------------------------- natural language ---------------------------- */

const WEEKDAYS: readonly string[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Typed formats, most specific first. */
const EXPLICIT_FORMATS: readonly string[] = [
	"yyyy-MM-dd",
	"MM/dd/yyyy",
	"M/d/yyyy",
	"dd/MM/yyyy",
	"MMMM d, yyyy",
	"MMM d, yyyy",
	"MMMM d",
	"MMM d",
	"d MMMM yyyy",
	"d MMM yyyy",
];

const NEXT_LAST_PATTERN = /^(?<direction>next|last|this) (?<unit>day|week|month|year)$/;
const COUNTED_PATTERN = /^(?:in )?(?<magnitude>\d+) (?<unit>day|week|month|year)s?(?<ago> ago)?$/;
const WEEKDAY_PATTERN = /^(?:(?<qualifier>next|last|this) )?(?<weekday>[a-z]+)$/;
const WHITESPACE_PATTERN = /\s+/g;

function relativeUnit(unit: string | undefined): FilterRelativeDateUnit | null {
	const parsed = FilterRelativeDateUnitSchema.safeParse(unit);
	return parsed.success ? parsed.data : null;
}

function directionOffset(direction: string | undefined): number {
	if (direction === "next") {
		return 1;
	}
	if (direction === "last") {
		return -1;
	}
	return 0;
}

function weekdayOffset(target: number, current: number, qualifier: string | undefined): number {
	const delta = target - current;
	if (qualifier === "last") {
		// Always strictly in the past.
		return delta >= 0 ? delta - DAYS_PER_WEEK : delta;
	}
	// "next" / "this" and a bare weekday all mean the NEXT one, not today.
	return delta <= 0 ? delta + DAYS_PER_WEEK : delta;
}

/**
 * Parses a typed phrase (English relative phrasing or an explicit date), or
 * null when nothing matches. Relative phrasing gives a RELATIVE value and an
 * explicit date an ABSOLUTE one; flattening the two is what freezes a saved view.
 */
export function parseFilterDate(text: string, now: Date): FilterDateValue | null {
	const input = text.trim().toLowerCase().replace(WHITESPACE_PATTERN, " ");
	if (input === "") {
		return null;
	}
	if (input === "today" || input === "now") {
		return { relative: RELATIVE_TODAY };
	}
	if (input === "tomorrow") {
		return { relative: RELATIVE_TOMORROW };
	}
	if (input === "yesterday") {
		return { relative: RELATIVE_YESTERDAY };
	}

	const nextLast = NEXT_LAST_PATTERN.exec(input)?.groups;
	const nextLastUnit = relativeUnit(nextLast?.unit);
	if (nextLast !== undefined && nextLastUnit !== null) {
		return { relative: { unit: nextLastUnit, offset: directionOffset(nextLast.direction) } };
	}

	const counted = COUNTED_PATTERN.exec(input)?.groups;
	const countedUnit = relativeUnit(counted?.unit);
	if (counted !== undefined && countedUnit !== null) {
		const magnitude = Number.parseInt(counted.magnitude ?? "0", DECIMAL_RADIX);
		const offset = counted.ago === undefined ? magnitude : -magnitude;
		const relative = FilterDateValueSchema.safeParse({ relative: { unit: countedUnit, offset } });
		return relative.success ? relative.data : null;
	}

	const weekday = WEEKDAY_PATTERN.exec(input)?.groups;
	const weekdayIndex = WEEKDAYS.indexOf(weekday?.weekday ?? "");
	if (weekday !== undefined && weekdayIndex !== -1) {
		const offset = weekdayOffset(weekdayIndex, startOfDay(now).getDay(), weekday.qualifier);
		return { relative: { unit: "day", offset } };
	}

	for (const pattern of EXPLICIT_FORMATS) {
		const parsed = parse(input, pattern, now);
		if (isValid(parsed)) {
			// "Aug 14" has no year, so it takes the reference year.
			return toFilterDateValue(parsed);
		}
	}
	return null;
}

/**
 * Human wording for a value. Relative values read as their phrase (from the
 * labels), not the resolved day, so a chip reading "is today" never goes stale.
 */
export function formatFilterDate(
	value: FilterDateValue | undefined,
	labels: Pick<FilterLabels, "relativeDate">,
	now: Date,
	pattern: string = FILTER_DATE_DISPLAY_FORMAT,
): string {
	if (value === undefined) {
		return "";
	}
	if (value.relative !== undefined) {
		return labels.relativeDate(value.relative);
	}
	const resolved = resolveFilterDate(value, now);
	if (resolved === null) {
		return "";
	}
	const day = format(resolved, pattern);
	return value.time === undefined ? day : `${day} ${value.time}`;
}

export function isFilterTime(time: string): boolean {
	return FILTER_TIME_PATTERN.test(time);
}
