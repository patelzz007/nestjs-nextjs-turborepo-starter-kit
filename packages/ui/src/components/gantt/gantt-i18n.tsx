/**
 * The gantt's copy contract, mapped onto the UI kit labels system: the
 * `gantt` family of `UiKitLabels` (`lib/labels`) supplies every string and
 * date pattern, and a gantt's `i18n` prop overrides individual keys for one
 * usage. The kit itself holds no copy — `mergeGanttI18n` only lays overrides
 * over the provider's labels and binds the default formatters to the result.
 */
import { format, isSameMonth, isSameYear, subMilliseconds, type Locale } from "date-fns";

import type { GanttDateRange, GanttScale } from "./gantt-types";

/** Per-scale names (the scale switcher's items). */
export interface GanttScaleLabels {
	readonly day: string;
	readonly week: string;
	readonly month: string;
	readonly quarter: string;
	readonly year: string;
}

/** date-fns format patterns, applied with the gantt `locale`. Language packs choose them. */
export interface GanttDateFormats {
	/** Month-scale title, e.g. "MMMM yyyy". */
	readonly monthTitle: string;
	/** Day-scale title and day group header, e.g. "EEEE, MMMM d, yyyy". */
	readonly dayTitle: string;
	/** Day-scale hour units, e.g. "h a". */
	readonly timeGutter: string;
	/** Day-scale sub-hour units (an interval that does not divide the hour), e.g. "h:mm". */
	readonly timeGutterFine: string;
	/** Time of day inside an event label, e.g. "h:mm a". */
	readonly eventTime: string;
	/** A day and its time of day (timed milestones, multi-day timed events), e.g. "MMM d, h:mm a". */
	readonly dateTime: string;
	/** Quarter-scale title and year-scale quarter groups, e.g. "QQQ yyyy". */
	readonly quarterTitle: string;
	/** Year-scale title, e.g. "yyyy". */
	readonly yearTitle: string;
	/** Week title start when the week stays in one month, e.g. "MMMM d". */
	readonly weekTitleStart: string;
	/** Week title end when the week stays in one month, e.g. "d, yyyy". */
	readonly weekTitleEnd: string;
	/** A day without its year, e.g. "MMM d". */
	readonly shortDate: string;
	/** A day with its year, e.g. "MMM d, yyyy". */
	readonly longDate: string;
	/** Week/month-scale day units, e.g. "EEE d". */
	readonly dayUnit: string;
	/** Quarter-scale week units, e.g. "MMM d". */
	readonly weekUnit: string;
	/** Quarter-scale month groups, e.g. "MMMM". */
	readonly monthGroup: string;
	/** Year-scale month units, e.g. "MMM". */
	readonly monthUnit: string;
	/** Week group header start, e.g. "MMM d". */
	readonly weekGroupStart: string;
	/** Week group header end, e.g. "d". */
	readonly weekGroupEnd: string;
}

/** Every user-facing gantt string (reui's `GanttI18nConfig["labels"]`, plus the kit's announcements and hints). */
export interface GanttI18nLabels {
	readonly today: string;
	readonly previous: string;
	readonly next: string;
	readonly addEvent: string;
	/** "Add task" hint at the foot of the tree. */
	readonly addTask: string;
	readonly allDay: string;
	readonly loading: string;
	readonly event: string;
	readonly events: (count: number) => string;
	readonly week: (weekNumber: number) => string;
	/** The tree pane's header, and its accessible name. */
	readonly resources: string;
	/** Accessible name of the timeline pane. */
	readonly timeline: string;
	readonly goToDate: string;
	/** Hover hint over empty row space, click-only create. */
	readonly scheduleHint: string;
	/** Same hint where dragCreate is on and a drag paints a range. */
	readonly scheduleHintDrag: string;
	readonly reorder: string;
	/** Scale switcher label ("Timeline scale"). */
	readonly selectView: string;
	readonly zoomIn: string;
	readonly zoomOut: string;
	/** Aria-label of the tree/timeline splitter. */
	readonly resizePanel: string;
	/** Aria-label of the off-screen bar chips. */
	readonly jumpToBar: (title: string) => string;
	/** Read to screen readers as part of the bar label. */
	readonly progress: (percent: number) => string;
	/** The visible percentage beside a parent rollup strip. */
	readonly summaryProgress: (percent: number) => string;
	/** Live duration readout on the resize indicator. */
	readonly durationDays: (days: number) => string;
	/** Appended to the bar aria-label when its segment is clipped by the range. */
	readonly continues: string;
	/** Names the planned (baseline) range in the bar tooltip and aria-label. */
	readonly planned: (rangeLabel: string) => string;
	/** Read to screen readers on a zero-duration (milestone) bar. */
	readonly milestone: string;
	/** The keyboard contract of a movable bar, announced as its description. */
	readonly barKeyboardHint: string;
	/** Live-region announcement after a bar moved or resized. */
	readonly announceUpdate: (title: string, timeLabel: string) => string;
	/** Live-region announcement after a tree row was reordered. */
	readonly announceReorder: (title: string) => string;
	/** Joins the two ends of a date range ("Jan 1 – Jan 5"). */
	readonly rangeSeparator: string;
	/** Joins the clauses of a bar's accessible name. */
	readonly listSeparator: string;
	/** A week group header from its week label and its day range. */
	readonly weekGroup: (weekLabel: string, rangeLabel: string) => string;
	readonly scales: GanttScaleLabels;
}

/** The `gantt` family of `UiKitLabels`: the labels plus the language's date patterns. */
export interface GanttLabels extends GanttI18nLabels {
	readonly formats: GanttDateFormats;
}

export interface GanttTitleContext {
	readonly date: Date;
	readonly activeRange: GanttDateRange;
	readonly visibleRange: GanttDateRange;
	readonly locale?: Locale | undefined;
}

export interface GanttAriaLabelParts {
	readonly title: string;
	readonly timeLabel: string;
	/** Localized milestone clause, from `labels.milestone`. */
	readonly milestoneLabel?: string | undefined;
	readonly rowTitle?: string | undefined;
	readonly progressLabel?: string | undefined;
	/** Localized planned-range clause, from `labels.planned`. */
	readonly plannedLabel?: string | undefined;
	readonly continues: boolean;
}

export interface GanttI18nFunctions {
	readonly formatTitle: (scale: GanttScale, context: GanttTitleContext) => string;
	readonly formatEventTime: (start: Date, end: Date, allDay: boolean, locale?: Locale) => string;
	readonly formatDayRange: (range: GanttDateRange, locale?: Locale) => string;
	/** Composes the bar's screen-reader label from its localized parts. */
	readonly formatEventAriaLabel: (parts: GanttAriaLabelParts) => string;
}

export interface GanttI18nConfig {
	readonly labels: GanttI18nLabels;
	readonly formats: GanttDateFormats;
	readonly functions: GanttI18nFunctions;
}

/** Deep-partial override shape: replace individual keys, never sections. */
export interface GanttI18nOverrides {
	readonly labels?: (Partial<Omit<GanttI18nLabels, "scales">> & { readonly scales?: Partial<GanttScaleLabels> | undefined }) | undefined;
	readonly formats?: Partial<GanttDateFormats> | undefined;
	readonly functions?: Partial<GanttI18nFunctions> | undefined;
}

/** `{ locale }` for date-fns, or nothing when the gantt has no locale. */
export function localeOptions(locale: Locale | undefined): { readonly locale?: Locale } {
	return locale === undefined ? {} : { locale };
}

const DAY_KEY_FORMAT = "yyyy-MM-dd";

/** The last instant a half-open range covers (its end minus 1ms), never before its start. */
function lastInstant(start: Date, end: Date): Date {
	return end.getTime() - 1 >= start.getTime() ? subMilliseconds(end, 1) : start;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
	return format(left, DAY_KEY_FORMAT) === format(right, DAY_KEY_FORMAT);
}

/**
 * Default formatting functions BOUND to a config's labels/formats, so that
 * `formats` overrides flow into the default renderers. Dates arrive zoned
 * (TZDate); subMilliseconds keeps that type, so labels never flip to the
 * machine zone near midnight.
 */
export function makeDefaultGanttFunctions(config: Pick<GanttI18nConfig, "labels" | "formats">): GanttI18nFunctions {
	const { labels, formats } = config;
	const join = (from: string, to: string): string => `${from}${labels.rangeSeparator}${to}`;
	const formatTitle = (scale: GanttScale, { date, activeRange, locale }: GanttTitleContext): string => {
		const options = localeOptions(locale);
		switch (scale) {
			case "day":
				return format(date, formats.dayTitle, options);
			case "month":
				return format(date, formats.monthTitle, options);
			case "quarter":
				return format(date, formats.quarterTitle, options);
			case "year":
				return format(date, formats.yearTitle, options);
			case "week": {
				const start = activeRange.start;
				const rangeEnd = subMilliseconds(activeRange.end, 1);
				if (isSameMonth(start, rangeEnd)) {
					return join(format(start, formats.weekTitleStart, options), format(rangeEnd, formats.weekTitleEnd, options));
				}
				if (isSameYear(start, rangeEnd)) {
					return join(format(start, formats.shortDate, options), format(rangeEnd, formats.longDate, options));
				}
				return join(format(start, formats.longDate, options), format(rangeEnd, formats.longDate, options));
			}
			default:
				return assertNeverTitleScale(scale);
		}
	};
	const formatEventTime = (start: Date, end: Date, allDay: boolean, locale?: Locale): string => {
		const options = localeOptions(locale);
		if (end.getTime() === start.getTime()) {
			// a milestone is an instant, not a range
			return allDay ? format(start, formats.longDate, options) : format(start, formats.dateTime, options);
		}
		const last = lastInstant(start, end);
		if (allDay) {
			// a gantt bar is a DATE RANGE: ends are exclusive midnights, so the last shown day is end - 1ms
			if (isSameCalendarDay(start, last)) {
				return format(start, formats.longDate, options);
			}
			return join(format(start, isSameYear(start, last) ? formats.shortDate : formats.longDate, options), format(last, formats.longDate, options));
		}
		if (!isSameCalendarDay(start, last)) {
			// multi-day timed events carry the date on both sides
			return join(format(start, formats.dateTime, options), format(end, formats.dateTime, options));
		}
		return join(format(start, formats.eventTime, options), format(end, formats.eventTime, options));
	};
	const formatDayRange = (range: GanttDateRange, locale?: Locale): string => {
		const options = localeOptions(locale);
		return join(format(range.start, formats.shortDate, options), format(subMilliseconds(range.end, 1), formats.shortDate, options));
	};
	const formatEventAriaLabel = (parts: GanttAriaLabelParts): string =>
		[parts.title, parts.timeLabel, parts.milestoneLabel, parts.rowTitle, parts.progressLabel, parts.plannedLabel, parts.continues ? labels.continues : undefined]
			.filter((part: string | undefined): part is string => part !== undefined && part !== "")
			.join(labels.listSeparator);
	return { formatTitle, formatEventTime, formatDayRange, formatEventAriaLabel };
}

function assertNeverTitleScale(value: never): never {
	throw new Error(`Unhandled gantt scale: ${String(value)}`);
}

/** Splits the `gantt` labels family into reui's `labels` + `formats` sections. */
function splitGanttLabels(labels: GanttLabels): Pick<GanttI18nConfig, "labels" | "formats"> {
	const { formats, ...rest } = labels;
	return { labels: rest, formats };
}

/**
 * The resolved gantt copy: the provider's `gantt` labels with a usage's
 * overrides laid over them, one key at a time (nested `scales` and `formats`
 * too). Default functions are re-bound to the MERGED labels/formats so a
 * `formats` (or `labels.continues`) override reaches the default renderers;
 * explicit `functions` overrides still win.
 */
export function mergeGanttI18n(base: GanttLabels, overrides?: GanttI18nOverrides): GanttI18nConfig {
	const split = splitGanttLabels(base);
	if (overrides === undefined) {
		return { ...split, functions: makeDefaultGanttFunctions(split) };
	}
	const labelOverrides = overrides.labels ?? {};
	const labels: GanttI18nLabels = { ...split.labels, ...labelOverrides, scales: { ...split.labels.scales, ...labelOverrides.scales } };
	const formats: GanttDateFormats = { ...split.formats, ...overrides.formats };
	return { labels, formats, functions: { ...makeDefaultGanttFunctions({ labels, formats }), ...overrides.functions } };
}
