// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-i18n.json). ReUI
// ships its own English defaults and an override merge; here the copy is part of
// the kit's ONE label system instead: `EventCalendarLabels` is the
// `eventCalendar` family of `UiKitLabels` (every language pack supplies it), and
// the calendar's `i18n` prop is a per-usage override laid over it — the same
// role every other kit component's `labels` prop plays. The config shape
// (`labels` / `viewNames` / `formats` / `functions`) and the merge semantics
// match ReUI, so ReUI's `i18n={{ labels: { today: "Hoy" } }}` keeps working.
// Deviations:
// - No built-in English: the defaults come from the label pack (`en.ts`).
// - The date-fns patterns ReUI hardcoded inside its formatters (smart range
//   titles, multi-day event times, the agenda day header) are `formats` keys,
//   and the range separator is `labels.timeRange`, so a language pack controls
//   every visible string.
// - `labels.toneNames` names the event tones (for colour pickers); the chip
//   tooltip/aria compositions are `labels.eventLabel` / `labels.eventAriaLabel`.
import { format, isSameMonth, isSameYear, subMilliseconds, type Locale } from "date-fns";

import type { CalendarView, EventCalendarDateRange, EventCalendarTone } from "./event-calendar-types";

export interface EventCalendarTextLabels {
	readonly today: string;
	readonly previous: string;
	readonly next: string;
	readonly addEvent: string;
	readonly allDay: string;
	readonly more: (count: number) => string;
	readonly noEvents: string;
	readonly loading: string;
	readonly event: string;
	readonly events: (count: number) => string;
	readonly selectView: string;
	readonly week: (weekNumber: number) => string;
	readonly resources: string;
	readonly goToDate: string;
	/** Announced while a drag/resize hovers a rejected position. */
	readonly dropNotAllowed: string;
	/** Aria-label suffix on chip segments that continue past the cell. */
	readonly continues: string;
	/** Agenda label for the first day of a multi-day event. */
	readonly timeFrom: (time: string) => string;
	/** Agenda label for the last day of a multi-day event. */
	readonly timeUntil: (time: string) => string;
	/** View-switcher shortcut hint characters, per view. */
	readonly viewShortcuts: Readonly<Record<CalendarView, string>>;
	/** Aria-label of the agenda event details toggle. */
	readonly eventDetails: (title: string) => string;
	/** Compact "+N" overflow. */
	readonly moreCompact: (count: number) => string;
	/** Joins a bounded from-to span (times or dates). */
	readonly timeRange: (from: string, to: string) => string;
	/** Chip tooltip text. */
	readonly eventLabel: (title: string, time: string) => string;
	/** Chip accessible name; `continues` = the chip is one slice of a longer event. */
	readonly eventAriaLabel: (title: string, time: string, continues: string | null) => string;
	/** Announced after a keyboard move/resize commits. */
	readonly eventMoved: (title: string, time: string) => string;
	/** Accessible names of the event tones (colour pickers). */
	readonly toneNames: Readonly<Record<EventCalendarTone, string>>;
}

export interface EventCalendarViewNames {
	readonly month: string;
	readonly week: string;
	readonly day: string;
	readonly days: (count: number) => string;
	readonly agenda: string;
	readonly resource: string;
}

/** date-fns format patterns, applied with the calendar `locale`. */
export interface EventCalendarFormats {
	readonly monthTitle: string;
	/** Undefined = smart cross-month range title. */
	readonly weekTitle?: string;
	readonly dayTitle: string;
	/** Undefined = smart range title. */
	readonly agendaTitle?: string;
	/** Undefined = the resource view title falls back to dayTitle. */
	readonly resourceTitle?: string;
	/** Smart range title: start/end of a range inside one month. */
	readonly rangeSameMonthStart: string;
	readonly rangeSameMonthEnd: string;
	/** Smart range title: start/end of a range inside one year. */
	readonly rangeSameYearStart: string;
	readonly rangeSameYearEnd: string;
	/** Smart range title: start/end of a range across years. */
	readonly rangeStart: string;
	readonly rangeEnd: string;
	/** Short day label of `formatDayRange` (month drag-create readout, agenda region name). */
	readonly dayRange: string;
	readonly monthDayHeader: string;
	/** Narrow variant used by the month view below the compact breakpoint. */
	readonly monthDayHeaderNarrow: string;
	readonly timeGridDayHeader: string;
	/** Agenda day header: weekday (leading) and full date (trailing). */
	readonly agendaWeekday: string;
	readonly agendaDate: string;
	/** "+N more" popover day header. */
	readonly moreDayHeader: string;
	/** Month cell aria-label date. */
	readonly monthCellAriaLabel: string;
	/** Time-grid day column aria-label date. */
	readonly dayAria: string;
	readonly timeGutter: string;
	/** Sub-hour gutter labels (interval below 60 minutes). */
	readonly timeGutterMinute: string;
	readonly eventTime: string;
	/** A multi-day timed event's start/end (date + time). */
	readonly eventDateTime: string;
	readonly monthCellDay: string;
}

/** The `eventCalendar` family of `UiKitLabels`: every string and pattern the calendar renders. */
export interface EventCalendarLabels {
	readonly labels: EventCalendarTextLabels;
	readonly viewNames: EventCalendarViewNames;
	readonly formats: EventCalendarFormats;
}

export interface EventCalendarFormatOptions {
	readonly locale?: Locale | undefined;
}

export interface EventCalendarTitleContext extends EventCalendarFormatOptions {
	/** The anchor date, in the display zone. */
	readonly date: Date;
	/** The logical period, its bounds in the display zone. */
	readonly activeRange: EventCalendarDateRange;
	readonly visibleRange: EventCalendarDateRange;
}

export interface EventCalendarFormatFunctions {
	readonly formatTitle: (view: CalendarView, context: EventCalendarTitleContext) => string;
	readonly formatEventTime: (start: Date, end: Date, allDay: boolean, options?: EventCalendarFormatOptions) => string;
	readonly formatDayRange: (range: EventCalendarDateRange, options?: EventCalendarFormatOptions) => string;
	/** Chip tooltip text. */
	readonly formatEventLabel: (title: string, timeLabel: string) => string;
	/** Chip aria-label composition. */
	readonly formatEventAriaLabel: (title: string, timeLabel: string, continues: boolean) => string;
}

/** Resolved copy: the label family plus the formatters bound to it. */
export interface EventCalendarI18nConfig extends EventCalendarLabels {
	readonly functions: EventCalendarFormatFunctions;
}

/** One level deeper than `Partial`: overriding a single label never restates the section. */
export interface EventCalendarI18nOverrides {
	readonly labels?: Partial<EventCalendarTextLabels>;
	readonly viewNames?: Partial<EventCalendarViewNames>;
	readonly formats?: Partial<EventCalendarFormats>;
	readonly functions?: Partial<EventCalendarFormatFunctions>;
}

function formatOptions(options: EventCalendarFormatOptions | undefined): { locale?: Locale } {
	return options?.locale === undefined ? {} : { locale: options.locale };
}

/** The pattern a single-pattern view title uses, or undefined for the smart range title. */
function singleTitlePattern(view: CalendarView, formats: EventCalendarFormats): string | undefined {
	switch (view) {
		case "month":
			return formats.monthTitle;
		case "day":
			return formats.dayTitle;
		case "resource":
			return formats.resourceTitle ?? formats.dayTitle;
		case "week":
			return formats.weekTitle;
		case "agenda":
			return formats.agendaTitle;
		case "days":
			return undefined;
		default:
			return assertNeverView(view);
	}
}

function assertNeverView(view: never): never {
	throw new Error(`Unhandled calendar view: ${JSON.stringify(view)}`);
}

/**
 * Default formatting functions BOUND to a config's labels/formats, so that
 * `formats` overrides flow into the default renderers. Dates passed in are
 * already in the display zone (TZDate), so `format` prints zone-correct text.
 */
export function makeDefaultFunctions(config: EventCalendarLabels): EventCalendarFormatFunctions {
	const { labels, formats } = config;
	const formatRange = (start: Date, end: Date, options: { locale?: Locale }): string => {
		if (isSameMonth(start, end)) {
			return labels.timeRange(format(start, formats.rangeSameMonthStart, options), format(end, formats.rangeSameMonthEnd, options));
		}
		if (isSameYear(start, end)) {
			return labels.timeRange(format(start, formats.rangeSameYearStart, options), format(end, formats.rangeSameYearEnd, options));
		}
		return labels.timeRange(format(start, formats.rangeStart, options), format(end, formats.rangeEnd, options));
	};
	return {
		formatTitle: (view: CalendarView, context: EventCalendarTitleContext): string => {
			const options = formatOptions(context);
			const pattern = singleTitlePattern(view, formats);
			if (pattern !== undefined) {
				return format(context.date, pattern, options);
			}
			// The last day is activeRange.end - 1ms; subMilliseconds keeps the zoned date type.
			return formatRange(context.activeRange.start, subMilliseconds(context.activeRange.end, 1), options);
		},
		formatEventTime: (start: Date, end: Date, allDay: boolean, options?: EventCalendarFormatOptions): string => {
			if (allDay) {
				return labels.allDay;
			}
			const resolved = formatOptions(options);
			// Compare calendar days off the last rendered instant (end is exclusive).
			const lastInstant = end.getTime() - 1 >= start.getTime() ? subMilliseconds(end, 1) : start;
			if (format(start, "yyyy-MM-dd") !== format(lastInstant, "yyyy-MM-dd")) {
				return labels.timeRange(format(start, formats.eventDateTime, resolved), format(end, formats.eventDateTime, resolved));
			}
			return labels.timeRange(format(start, formats.eventTime, resolved), format(end, formats.eventTime, resolved));
		},
		formatDayRange: (range: EventCalendarDateRange, options?: EventCalendarFormatOptions): string => {
			const resolved = formatOptions(options);
			return labels.timeRange(format(range.start, formats.dayRange, resolved), format(subMilliseconds(range.end, 1), formats.dayRange, resolved));
		},
		formatEventLabel: (title: string, timeLabel: string): string => labels.eventLabel(title, timeLabel),
		formatEventAriaLabel: (title: string, timeLabel: string, continues: boolean): string => labels.eventAriaLabel(title, timeLabel, continues ? labels.continues : null),
	};
}

/**
 * Lays a per-usage override over the label family, section by section: a
 * partial override replaces individual keys, never whole sections. Default
 * functions are re-bound to the MERGED labels/formats; explicit `functions`
 * overrides still win.
 */
export function mergeEventCalendarI18n(base: EventCalendarLabels, overrides?: EventCalendarI18nOverrides): EventCalendarI18nConfig {
	const merged: EventCalendarLabels =
		overrides === undefined
			? base
			: {
					labels: { ...base.labels, ...overrides.labels },
					viewNames: { ...base.viewNames, ...overrides.viewNames },
					formats: { ...base.formats, ...overrides.formats },
				};
	return { ...merged, functions: { ...makeDefaultFunctions(merged), ...overrides?.functions } };
}

/** A view's display name (the N-days view names its day count). */
export function getViewName(viewNames: EventCalendarViewNames, view: CalendarView, dayCount: number): string {
	return view === "days" ? viewNames.days(dayCount) : viewNames[view];
}
