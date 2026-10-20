import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";

/**
 * "Today" for the redemptions page: the calendar day, in the stores' time zone,
 * that contains a given instant — as the `[fromMs, toMs)` window the
 * redemptions list filters on (`filter[redeemedAt][gte|lt]`), so the API
 * counts the day's redemptions (`meta.total`) instead of the client counting
 * the rows of one page.
 *
 * The stores' zone is the platform display region's: every pilot city shares
 * it (pinned by a test in packages/shared), so midnight here is midnight at
 * the merchant's counter. The window is computed once on the server and handed
 * to the client, so the server render and hydration ask for the same day.
 */
export const STORE_TIME_ZONE: string = PLATFORM_DISPLAY_REGION.timeZone;

export interface DayWindow {
	/** Midnight that starts the day (inclusive). */
	readonly fromMs: number;
	/** Midnight that starts the next day (exclusive). */
	readonly toMs: number;
}

interface CalendarDay {
	readonly year: number;
	readonly month: number;
	readonly day: number;
}

const MS_PER_MINUTE = 60_000;
/** Some engines report midnight as hour 24; `% 24` normalizes it to 0. */
const HOURS_PER_DAY = 24;

function zonedParts(epochMs: number, timeZone: string): CalendarDay & { readonly hour: number; readonly minute: number } {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		hourCycle: "h23",
	}).formatToParts(epochMs);
	const read = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value);
	return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour") % HOURS_PER_DAY, minute: read("minute") };
}

/** Minutes the zone is ahead of UTC at `epochMs`. */
function zoneOffsetMinutes(epochMs: number, timeZone: string): number {
	const local = zonedParts(epochMs, timeZone);
	const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
	return Math.round((asUtc - Math.floor(epochMs / MS_PER_MINUTE) * MS_PER_MINUTE) / MS_PER_MINUTE);
}

/** The instant of local midnight starting `day` in `timeZone` (offset re-read at the result, so a DST change that day is honoured). */
function zonedMidnight(day: CalendarDay, timeZone: string): number {
	const utcMidnight = Date.UTC(day.year, day.month - 1, day.day);
	const firstGuess = utcMidnight - zoneOffsetMinutes(utcMidnight, timeZone) * MS_PER_MINUTE;
	return utcMidnight - zoneOffsetMinutes(firstGuess, timeZone) * MS_PER_MINUTE;
}

/** The local calendar day containing `nowMs`, as a `[midnight, next midnight)` window. */
export function dayWindowContaining(nowMs: number, timeZone: string = STORE_TIME_ZONE): DayWindow {
	const today = zonedParts(nowMs, timeZone);
	const nextDay = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
	return {
		fromMs: zonedMidnight(today, timeZone),
		toMs: zonedMidnight({ year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate() }, timeZone),
	};
}
