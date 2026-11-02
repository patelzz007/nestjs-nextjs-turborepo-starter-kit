// ============================================
// notifications/domain/policies/quiet-hours.ts — when held notifications may go (ADR 070)
// ============================================
// Computed in the person's IANA time zone at the moment of sending, never stored as a UTC offset, so a
// daylight-saving change moves the window with the clock.

import { MINUTES_PER_DAY } from "@workspace/shared";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MINUTES_PER_HOUR = 60;
const DAYS_PER_WEEK = 7;
/** The digest goes out at 08:00 local time. */
export const DIGEST_LOCAL_HOUR = 8;
/** Weekly digests go out on Mondays (ISO weekday 1). */
const MONDAY = 1;

export interface QuietHours {
	readonly enabled: boolean;
	readonly startMinute: number;
	readonly endMinute: number;
	readonly timeZone: string;
}

/** Minute of the local day and ISO weekday (1 = Monday … 7 = Sunday) at `epochMs` in `timeZone`. */
export function localClock(epochMs: number, timeZone: string): { readonly minuteOfDay: number; readonly isoWeekday: number } {
	const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(new Date(epochMs));
	const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part): boolean => part.type === type)?.value ?? "0";
	const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
	return { minuteOfDay: Number(value("hour")) * MINUTES_PER_HOUR + Number(value("minute")), isoWeekday: weekdays.indexOf(value("weekday")) + 1 };
}

/** Whether `minute` falls in a window that may wrap past midnight (22:00–07:00). */
export function isInWindow(minute: number, startMinute: number, endMinute: number): boolean {
	if (startMinute === endMinute) {
		return false;
	}
	return startMinute < endMinute ? minute >= startMinute && minute < endMinute : minute >= startMinute || minute < endMinute;
}

/** When a notification held by quiet hours may go: `null` when it may go now. */
export function quietHoursRelease(epochMs: number, quietHours: QuietHours): number | null {
	if (!quietHours.enabled) {
		return null;
	}
	const { minuteOfDay } = localClock(epochMs, quietHours.timeZone);
	if (!isInWindow(minuteOfDay, quietHours.startMinute, quietHours.endMinute)) {
		return null;
	}
	const minutesLeft = (quietHours.endMinute - minuteOfDay + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	// Recomputed at release: a DST change inside the window is absorbed by the next check.
	return epochMs + minutesLeft * MS_PER_MINUTE;
}

/** The next digest moment after `epochMs`: 08:00 local, daily or on Mondays. */
export function nextDigestAt(epochMs: number, timeZone: string, frequency: "DAILY" | "WEEKLY"): number {
	const { minuteOfDay, isoWeekday } = localClock(epochMs, timeZone);
	const target = DIGEST_LOCAL_HOUR * MINUTES_PER_HOUR;
	let days = minuteOfDay < target ? 0 : 1;
	if (frequency === "WEEKLY") {
		const weekday = ((isoWeekday - 1 + days) % DAYS_PER_WEEK) + 1;
		days += (MONDAY - weekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
	}
	const roughly = epochMs + (days * MINUTES_PER_DAY + target - minuteOfDay) * MS_PER_MINUTE;
	// Re-anchor on the local clock at the target (a DST shift of up to an hour in between).
	const drift = localClock(roughly, timeZone).minuteOfDay - target;
	return roughly - drift * MS_PER_MINUTE + (drift > MINUTES_PER_HOUR ? MS_PER_HOUR : 0);
}
