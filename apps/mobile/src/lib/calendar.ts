// Calendar arithmetic for a month view (DateField, MultiDateField,
// DateRangePicker): the month a date is in, the months around it, the months
// and years that can be jumped to, the weeks of a month laid out Monday first,
// a set of picked days, and the next pick of a start / end range. Dates are calendar days
// (`YYYY-MM-DD`, LocalDate), never instants: no time zone moves them. Pure,
// so every case is tested without rendering.

import { addLocalDays, localDateInTimeZone, startOfLocalDateInTimeZone, UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";

/** A calendar month: `month` is 1 (January) to 12. */
export interface CalendarMonth {
	readonly year: number;
	readonly month: number;
}

const DAYS_PER_WEEK = 7;
/** `Date#getUTCDay` counts from Sunday; these weeks start on Monday. */
const MONDAY_OFFSET = 6;

/** `Date.UTC`'s months count from 0. */
function utcMsOf(month: CalendarMonth, day: number): number {
	return Date.UTC(month.year, month.month - 1, day);
}

function localDateOf(epochMs: number): LocalDate {
	return localDateInTimeZone(epochMs, UTC_TIME_ZONE);
}

/** The instant a calendar day is formatted at: its UTC midnight, so no zone moves it to another day. */
export function calendarDayMsOf(date: LocalDate): number {
	return startOfLocalDateInTimeZone(date, UTC_TIME_ZONE);
}

/** The month `date` is in. */
export function calendarMonthOf(date: LocalDate): CalendarMonth {
	const day = new Date(startOfLocalDateInTimeZone(date, UTC_TIME_ZONE));
	return { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1 };
}

/** The month `offset` months from `month` (negative = earlier). */
export function addCalendarMonths(month: CalendarMonth, offset: number): CalendarMonth {
	const first = new Date(utcMsOf({ year: month.year, month: month.month + offset }, 1));
	return { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1 };
}

/** The month's first day. */
export function firstDayOf(month: CalendarMonth): LocalDate {
	return localDateOf(utcMsOf(month, 1));
}

/** Earlier, the same or later month: negative, 0 or positive. */
export function compareCalendarMonths(left: CalendarMonth, right: CalendarMonth): number {
	return left.year === right.year ? left.month - right.month : left.year - right.year;
}

/** The twelve months of a year, January (1) to December (12). */
const MONTHS_PER_YEAR = 12;
export const CALENDAR_MONTH_NUMBERS: readonly number[] = [...Array<number>(MONTHS_PER_YEAR).keys()].map((index: number): number => index + 1);

/** `month` is from `first` to `last`, both included. */
export function isCalendarMonthWithin(month: CalendarMonth, first: CalendarMonth, last: CalendarMonth): boolean {
	return compareCalendarMonths(month, first) >= 0 && compareCalendarMonths(month, last) <= 0;
}

/** `month`, moved to `first` when before it and to `last` when after it. */
export function clampCalendarMonth(month: CalendarMonth, first: CalendarMonth, last: CalendarMonth): CalendarMonth {
	if (compareCalendarMonths(month, first) < 0) {
		return first;
	}
	return compareCalendarMonths(month, last) > 0 ? last : month;
}

/** Every year from `first`'s to `last`'s, both included, earliest first. */
export function calendarYearsBetween(first: CalendarMonth, last: CalendarMonth): readonly number[] {
	const count = Math.max(last.year - first.year + 1, 0);
	return [...Array<number>(count).keys()].map((offset: number): number => first.year + offset);
}

/**
 * The month as weeks, Monday first: every week seven slots, the days of the
 * month in place and `null` before the 1st and after the last day.
 */
export function monthWeeks(month: CalendarMonth): readonly (readonly (LocalDate | null)[])[] {
	const first = firstDayOf(month);
	const leading = (new Date(utcMsOf(month, 1)).getUTCDay() + MONDAY_OFFSET) % DAYS_PER_WEEK;
	const length = new Date(utcMsOf(addCalendarMonths(month, 1), 0)).getUTCDate();
	const slots: (LocalDate | null)[] = [...Array<null>(leading).fill(null), ...[...Array<number>(length).keys()].map((index: number): LocalDate => addLocalDays(first, index))];
	const trailing = (DAYS_PER_WEEK - (slots.length % DAYS_PER_WEEK)) % DAYS_PER_WEEK;
	const padded = [...slots, ...Array<null>(trailing).fill(null)];
	return [...Array<number>(padded.length / DAYS_PER_WEEK).keys()].map((week: number): readonly (LocalDate | null)[] =>
		padded.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK),
	);
}

/**
 * The picked days after a tap on `day`: picked, it is unpicked; otherwise it
 * is added — unless `maxDays` are already picked, when nothing changes. The
 * result is in date order without repeats (`YYYY-MM-DD` strings sort as dates).
 */
export function toggleCalendarDay(days: readonly LocalDate[], day: LocalDate, maxDays: number | null): readonly LocalDate[] {
	if (days.includes(day)) {
		return days.filter((picked: LocalDate): boolean => picked !== day);
	}
	if (maxDays !== null && days.length >= maxDays) {
		return days;
	}
	return [...days, day].sort();
}

/** A range being picked: a start, then an end on or after it. */
export interface DateRangeDraft {
	readonly from: LocalDate | null;
	readonly to: LocalDate | null;
}

/**
 * The draft after a tap on `day`: the first tap (or any tap once both ends
 * are set) starts a new range; the next tap ends it — on the same day it is a
 * one-day range, and before the start it starts again from there.
 * (`YYYY-MM-DD` strings sort as dates.)
 */
export function pickRangeDay(draft: DateRangeDraft, day: LocalDate): DateRangeDraft {
	if (draft.from === null || draft.to !== null || day < draft.from) {
		return { from: day, to: null };
	}
	return { from: draft.from, to: day };
}

/** Where a day sits in a draft: outside it, at one end, or between the ends. */
export type RangeDayRole = "none" | "start" | "end" | "single" | "inside";

export function rangeDayRoleOf(draft: DateRangeDraft, day: LocalDate): RangeDayRole {
	if (draft.from === null) {
		return "none";
	}
	if (draft.to === null || draft.from === draft.to) {
		return day === draft.from ? "single" : "none";
	}
	if (day === draft.from) {
		return "start";
	}
	if (day === draft.to) {
		return "end";
	}
	return day > draft.from && day < draft.to ? "inside" : "none";
}
