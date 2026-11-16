// ============================================
// packages/shared/src/lib/time.ts — epoch milliseconds
// ============================================
// Every time the app stores, compares, sends or logs is epoch milliseconds: a UTC
// instant as a plain number. Build one with date-fns (+ @date-fns/tz for a fixed
// zone), never by parsing a string; turn one into text only at the moment it is
// shown, with lib/ui/format/date-time.ts.

import { TZDate } from "@date-fns/tz";

/** The epoch milliseconds of a wall-clock moment in UTC — `month` is 1-based (October is 10). */
export function utcEpochMs(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0): number {
	return new TZDate(year, month - 1, day, hours, minutes, seconds, "UTC").getTime();
}

// Units of time, defined once: the Gantt's calendar maths and the notifications' quiet hours both count in them.
export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
/** Minutes in a day (1,440). */
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
export const MS_PER_DAY = MS_PER_MINUTE * MINUTES_PER_DAY;
export const DAYS_PER_WEEK = 7;
export const MS_PER_WEEK = MS_PER_DAY * DAYS_PER_WEEK;
