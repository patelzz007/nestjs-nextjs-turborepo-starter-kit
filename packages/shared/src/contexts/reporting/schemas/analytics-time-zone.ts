import { z } from "zod";

/** Days in one analytics week (weekly buckets start on Monday 00:00 in the bucket time zone). */
const DAYS_PER_WEEK = 7;
const DAY_MS = 86_400_000;
/** `Date#getUTCDay()` → days since the most recent Monday (Sunday = 6). */
const DAYS_SINCE_MONDAY_OFFSET = 6;
/** Two refinement rounds resolve a local wall-clock time to an instant across one DST transition. */
const OFFSET_REFINEMENT_ROUNDS = 2;

/** The time zone the platform-wide (admin) and cross-merchant (customer) analytics are bucketed in. */
export const UTC_TIME_ZONE = "UTC";

function isIanaTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

/** An IANA time zone name the runtime (and Postgres) understands, e.g. `Asia/Kuala_Lumpur`. */
export const IanaTimeZoneSchema = z.string().min(1).max(64).refine(isIanaTimeZone, { message: "Must be an IANA time zone such as Asia/Kuala_Lumpur" });

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
	let formatter = formatters.get(timeZone);
	if (formatter === undefined) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		});
		formatters.set(timeZone, formatter);
	}
	return formatter;
}

/** The wall-clock reading of `epochMs` in `timeZone`, encoded as if it were UTC (milliseconds dropped). */
function wallClockAsUtcMs(epochMs: number, timeZone: string): number {
	const parts = new Map(
		formatterFor(timeZone)
			.formatToParts(new Date(epochMs))
			.map((part) => [part.type, Number(part.value)]),
	);
	const read = (type: Intl.DateTimeFormatPartTypes): number => parts.get(type) ?? 0;
	return Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
}

/** The instant whose wall-clock reading in `timeZone` is `wallClockMs` (encoded as UTC). */
function instantOfWallClock(wallClockMs: number, timeZone: string): number {
	let instant = wallClockMs;
	for (let round = 0; round < OFFSET_REFINEMENT_ROUNDS; round += 1) {
		instant = wallClockMs - (wallClockAsUtcMs(instant, timeZone) - instant);
	}
	return instant;
}

/**
 * Monday 00:00 (local wall clock in `timeZone`) of the week containing
 * `epochMs`, as epoch ms — the start of its weekly analytics bucket. For
 * `UTC` this is Monday 00:00:00.000 UTC. Weeks crossing a DST change are 167
 * or 169 hours long; the start is still local midnight.
 */
export function startOfWeekInTimeZone(epochMs: number, timeZone: string): number {
	const wallClock = wallClockAsUtcMs(epochMs, timeZone);
	const local = new Date(wallClock);
	const daysSinceMonday = (local.getUTCDay() + DAYS_SINCE_MONDAY_OFFSET) % DAYS_PER_WEEK;
	const localMondayMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - daysSinceMonday * DAY_MS;
	return instantOfWallClock(localMondayMidnight, timeZone);
}

/** The bucket start of the week after the one starting at `weekStartMs` (DST-safe: re-aligned to local midnight). */
export function nextWeekStartInTimeZone(weekStartMs: number, timeZone: string): number {
	return startOfWeekInTimeZone(weekStartMs + (DAYS_PER_WEEK + 1) * DAY_MS, timeZone);
}

/** Characters of an ISO 8601 calendar date (`YYYY-MM-DD`) at the start of `Date#toISOString()`. */
const ISO_DATE_LENGTH = 10;

/** The calendar date (`YYYY-MM-DD`) `epochMs` falls on in `timeZone` — e.g. a report's first and last day. */
export function localDateInTimeZone(epochMs: number, timeZone: string): string {
	return new Date(wallClockAsUtcMs(epochMs, timeZone)).toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * The wall-clock reading of `epochMs` in `timeZone` as a `Date` whose UTC
 * fields carry the local date and time — what a spreadsheet cell (which has
 * no time zone) must hold so it DISPLAYS the local date.
 */
export function wallClockDateInTimeZone(epochMs: number, timeZone: string): Date {
	return new Date(wallClockAsUtcMs(epochMs, timeZone));
}

/**
 * A calendar date written `YYYY-MM-DD` (ISO 8601), e.g. the first or last day
 * of a report range as a person picks it — a wall-clock day, not an instant.
 */
export const LocalDateSchema = z.iso.date();

/** A calendar date (`YYYY-MM-DD`) — parse it with {@link LocalDateSchema}. */
export type LocalDate = z.output<typeof LocalDateSchema>;

/** Midnight UTC of a calendar date, the date arithmetic base (`Date.UTC` has no DST and no zone). */
function calendarDateAsUtcMs(localDate: LocalDate): number {
	return Date.parse(`${LocalDateSchema.parse(localDate)}T00:00:00.000Z`);
}

/**
 * The instant local midnight starts `localDate` in `timeZone` — the inclusive
 * `from` of a range that begins on that day. DST-safe: the result is the
 * zone's own 00:00, whatever its offset that day.
 */
export function startOfLocalDateInTimeZone(localDate: LocalDate, timeZone: string): number {
	return instantOfWallClock(calendarDateAsUtcMs(localDate), timeZone);
}

/** `localDate` moved by `days` calendar days (negative = earlier), e.g. `2026-03-01` − 1 → `2026-02-28`. */
export function addLocalDays(localDate: LocalDate, days: number): LocalDate {
	return new Date(calendarDateAsUtcMs(localDate) + days * DAY_MS).toISOString().slice(0, ISO_DATE_LENGTH);
}

/** Calendar days from `fromDate` to `toDate`, both counted (`2026-09-01` → `2026-09-30` = 30); ≤ 0 when `toDate` is earlier. */
export function inclusiveLocalDayCount(fromDate: LocalDate, toDate: LocalDate): number {
	return Math.round((calendarDateAsUtcMs(toDate) - calendarDateAsUtcMs(fromDate)) / DAY_MS) + 1;
}
