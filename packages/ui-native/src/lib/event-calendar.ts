// The native EventCalendar's own rules, beside the ones it shares with the web (@workspace/shared
// `lib/event-calendar`: view ranges, occurrences, packing, recurrence): its English copy, the colour classes an
// event's tone names, and the time grid's geometry (where a minute sits, which slot a drag covers).

import { EVENT_CALENDAR_LABELS_EN, type CalendarView, type EventCalendarLabels, type EventCalendarTone } from "@workspace/ui-kit-logic";

/** The kit's copy: the shared English (the web's `en.json`). */
export const DEFAULT_EVENT_CALENDAR_LABELS: EventCalendarLabels = EVENT_CALENDAR_LABELS_EN;

/** Where "now" comes from (a fixed clock for a demo or a test). */
export interface EventCalendarClock {
	nowEpochMs(): number;
}

/** An event's fill, by its tone (the theme's categorical tones; `brand` is the primary colour). */
const TONE_FILLS: Readonly<Record<EventCalendarTone, string>> = {
	brand: "bg-primary",
	neutral: "bg-muted-foreground",
	blue: "bg-tone-blue",
	green: "bg-tone-green",
	violet: "bg-tone-violet",
	red: "bg-tone-red",
	yellow: "bg-tone-yellow",
	teal: "bg-tone-teal",
	orange: "bg-tone-orange",
};

export function eventToneClass(tone: EventCalendarTone | undefined): string {
	return TONE_FILLS[tone ?? "brand"];
}

/** The views a phone offers: the web's, less the multi-day strip a phone has no room for. */
export const PHONE_CALENDAR_VIEWS: readonly CalendarView[] = ["month", "week", "day", "agenda", "resource"];

const MINUTES_PER_HOUR = 60;

/** The time grid's hours: where its day starts and ends, and how tall an hour is, in points. */
export interface TimeGridGeometry {
	readonly startHour: number;
	readonly endHour: number;
	readonly hourHeight: number;
}

/** The point, from the grid's top, a minute of the day sits at (clamped to the grid). */
export function minuteToY(minutes: number, geometry: TimeGridGeometry): number {
	const startMin = geometry.startHour * MINUTES_PER_HOUR;
	const endMin = geometry.endHour * MINUTES_PER_HOUR;
	return ((Math.min(Math.max(minutes, startMin), endMin) - startMin) / MINUTES_PER_HOUR) * geometry.hourHeight;
}

/** The minute of the day at a point from the grid's top, snapped down to `snap` and clamped to the grid. */
export function yToMinute(y: number, geometry: TimeGridGeometry, snap: number): number {
	const startMin = geometry.startHour * MINUTES_PER_HOUR;
	const endMin = geometry.endHour * MINUTES_PER_HOUR;
	const minutes = startMin + (y / geometry.hourHeight) * MINUTES_PER_HOUR;
	return Math.min(Math.max(Math.floor(minutes / snap) * snap, startMin), endMin);
}

/**
 * The minutes a vertical drag from `fromY` to `toY` covers, in either direction, snapped to `snap` and at least one
 * snap long.
 */
export function dragSlotMinutes(fromY: number, toY: number, geometry: TimeGridGeometry, snap: number): { readonly startMin: number; readonly endMin: number } {
	const first = yToMinute(Math.min(fromY, toY), geometry, snap);
	const last = yToMinute(Math.max(fromY, toY), geometry, snap) + snap;
	return { startMin: first, endMin: Math.min(Math.max(last, first + snap), geometry.endHour * MINUTES_PER_HOUR) };
}

/** The grid's hours, for its gutter. */
export function timeGridHours(geometry: TimeGridGeometry): readonly number[] {
	return Array.from({ length: geometry.endHour - geometry.startHour }, (_, index): number => geometry.startHour + index);
}
