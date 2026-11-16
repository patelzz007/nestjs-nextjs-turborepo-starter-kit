import { tz } from "@date-fns/tz";
import { format, isValid, parse } from "date-fns";
import { z } from "zod";

/** `yyyy-MM-dd` date string used by form pickers and API date boundaries. */
export const DateInputStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type DateInputString = z.output<typeof DateInputStringSchema>;

/** A calendar day is stored as the epoch milliseconds of its midnight in UTC. */
const CALENDAR_DAY_ZONE = tz("UTC");
const DATE_INPUT_PATTERN = "yyyy-MM-dd";

/** Parse a `yyyy-MM-dd` string into a local calendar date. */
export function parseDateInputString(value: string): Date | undefined {
	const parsed = DateInputStringSchema.safeParse(value);
	if (!parsed.success) {
		return undefined;
	}
	const date = parse(parsed.data, DATE_INPUT_PATTERN, new Date());
	return isValid(date) ? date : undefined;
}

/** Format a calendar date as `yyyy-MM-dd`. */
export function formatDateInputString(date: Date): DateInputString {
	return DateInputStringSchema.parse(format(date, DATE_INPUT_PATTERN));
}

/** `"2026-10-01"` → the epoch milliseconds of 1 Oct 2026 00:00 UTC, or `undefined` for a malformed day. */
export function dateInputStringToEpochMs(value: string): number | undefined {
	const parsed = DateInputStringSchema.safeParse(value);
	if (!parsed.success) {
		return undefined;
	}
	const day = parse(parsed.data, DATE_INPUT_PATTERN, 0, { in: CALENDAR_DAY_ZONE });
	return isValid(day) ? day.getTime() : undefined;
}

/** The calendar day (UTC) an epoch instant falls on, as `yyyy-MM-dd` — what a date picker shows for a stored day. */
export function epochMsToDateInputString(epochMs: number): DateInputString {
	return DateInputStringSchema.parse(format(epochMs, DATE_INPUT_PATTERN, { in: CALENDAR_DAY_ZONE }));
}

/** A form's `yyyy-MM-dd` field, submitted as epoch milliseconds (UTC midnight of that day). */
export const DateInputEpochMsSchema = DateInputStringSchema.refine((value) => dateInputStringToEpochMs(value) !== undefined, "Enter a valid date").transform(
	(value): number => dateInputStringToEpochMs(value) ?? 0,
);
