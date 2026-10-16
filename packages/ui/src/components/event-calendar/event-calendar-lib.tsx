// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-lib.json): pure,
// React-free calendar maths — view ranges, zoned day keys, multi-day
// segmentation, overlap packing, lane packing and the event index. Names and
// semantics match ReUI, with these deliberate deviations:
// - Nothing mutates its input. `packTimedSegments` returns packed copies
//   instead of writing `column`/`columnCount`/`columnSpan` onto the segments
//   it was given, so the memoized index can be shared safely.
// - Day offsets inside a week row use calendar-day maths in the display zone
//   (never a fixed 24h divisor), so DST weeks place bars on the right columns.
// - Helpers the views share (`getVisibleDays`, `chunkWeeks`, `addZonedDays`,
//   `zonedMinutesOfDay`, `occurrenceKey`, `isWeekendDay`) live here instead of
//   being re-derived inline in every view.
import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, differenceInCalendarDays, differenceInMinutes, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";

import { expandRecurrence } from "./event-calendar-recurrence";
import type {
	CalendarEvent,
	CalendarView,
	EventCalendarDateRange,
	EventCalendarEventData,
	EventCalendarOccurrence,
	EventCalendarOffDaysConfig,
	EventCalendarResource,
	EventCalendarSegment,
	WeekStartsOn,
} from "./event-calendar-types";

export type { WeekStartsOn } from "./event-calendar-types";

/** Packing-effective minimum in minutes so tiny events do not stack invisibly. */
export const MIN_PACK_SLOT = 30;

export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const DAYS_PER_WEEK = 7;
const MS_PER_MINUTE = 60_000;
/** Rows of the fixed-height month grid (6 weeks always cover a month). */
export const FIXED_MONTH_WEEKS = 6;

/** Weekday numbers treated as the weekend by default (Sunday, Saturday). */
export const DEFAULT_WEEKEND_DAYS: readonly number[] = [0, 6];

/** The instant re-expressed in the display time zone (TZDate extends Date). */
export function toZoned(date: Date, timeZone: string): TZDate {
	return new TZDate(date.getTime(), timeZone);
}

/** Zoned midnight of the day containing the instant. */
export function zonedStartOfDay(date: Date, timeZone: string): TZDate {
	return startOfDay(toZoned(date, timeZone));
}

/** Zoned midnight `amount` calendar days after the day containing `date` (DST-safe). */
export function addZonedDays(date: Date, amount: number, timeZone: string): TZDate {
	return zonedStartOfDay(addDays(zonedStartOfDay(date, timeZone), amount), timeZone);
}

/** Stable per-day key in the display time zone. */
export function getDayKey(date: Date, timeZone: string): string {
	return format(toZoned(date, timeZone), "yyyy-MM-dd");
}

/** Minutes elapsed since the zoned midnight of the instant's own day. */
export function zonedMinutesOfDay(date: Date, timeZone: string): number {
	return differenceInMinutes(date, zonedStartOfDay(date, timeZone));
}

/** Day length in minutes; 1380/1500 on DST transition days — never assume 1440. */
export function getDayTotalMinutes(dayStart: Date, timeZone: string): number {
	const start = zonedStartOfDay(dayStart, timeZone);
	return differenceInMinutes(addZonedDays(start, 1, timeZone), start);
}

/** Rounds to the nearest multiple of `snap` minutes. */
export function snapMinutes(minutes: number, snap: number): number {
	return Math.round(minutes / snap) * snap;
}

/** Stable occurrence key: `${eventId}::${startISO}`. */
export function occurrenceKey(eventId: string, start: Date): string {
	return `${eventId}::${start.toISOString()}`;
}

export interface ViewRangeOptions {
	readonly timeZone: string;
	readonly weekStartsOn: WeekStartsOn;
	readonly dayCount: number;
	readonly agendaDayCount: number;
	readonly fixedWeeks: boolean;
}

export interface ViewDateRanges {
	readonly visibleRange: EventCalendarDateRange;
	readonly activeRange: EventCalendarDateRange;
}

function sameRanges(range: EventCalendarDateRange): ViewDateRanges {
	return { activeRange: range, visibleRange: range };
}

/** The logical period of a view (`activeRange`) and the full rendered grid (`visibleRange`). */
export function getViewDateRange(view: CalendarView, date: Date, options: ViewRangeOptions): ViewDateRanges {
	const { timeZone, weekStartsOn, dayCount, agendaDayCount, fixedWeeks } = options;
	const zoned = toZoned(date, timeZone);
	switch (view) {
		case "month": {
			const activeStart = startOfMonth(zoned);
			const activeEnd = startOfMonth(addMonths(zoned, 1));
			const visibleStart = startOfWeek(activeStart, { weekStartsOn });
			const visibleEnd = fixedWeeks
				? addZonedDays(visibleStart, FIXED_MONTH_WEEKS * DAYS_PER_WEEK, timeZone)
				: addWeeks(startOfWeek(addDays(activeEnd, -1), { weekStartsOn }), 1);
			return { activeRange: { start: activeStart, end: activeEnd }, visibleRange: { start: visibleStart, end: visibleEnd } };
		}
		case "week": {
			const start = startOfWeek(zoned, { weekStartsOn });
			return sameRanges({ start, end: addWeeks(start, 1) });
		}
		case "day":
		case "resource": {
			const start = startOfDay(zoned);
			return sameRanges({ start, end: addDays(start, 1) });
		}
		case "days": {
			const start = startOfDay(zoned);
			return sameRanges({ start, end: addDays(start, Math.max(1, dayCount)) });
		}
		case "agenda": {
			const start = startOfDay(zoned);
			return sameRanges({ start, end: addDays(start, Math.max(1, agendaDayCount)) });
		}
		default:
			return assertNeverView(view);
	}
}

function assertNeverView(view: never): never {
	throw new Error(`Unhandled calendar view: ${JSON.stringify(view)}`);
}

/** Day of month of the last day of the month containing the zoned date. */
function lastDayOfZonedMonth(date: Date): number {
	return addDays(startOfMonth(addMonths(date, 1)), -1).getDate();
}

export type StepDirection = 1 | -1;

/** The anchor date stepped one period forward or backward for the view. */
export function stepDate(view: CalendarView, date: Date, direction: StepDirection, options: Pick<ViewRangeOptions, "timeZone" | "dayCount" | "agendaDayCount">): Date {
	const zoned = toZoned(date, options.timeZone);
	switch (view) {
		case "month": {
			const stepped = addMonths(zoned, direction);
			// addMonths clamps the day into a shorter month and never restores it;
			// sticking a month end to the target month's end keeps stepping invertible.
			if (zoned.getDate() !== lastDayOfZonedMonth(zoned)) {
				return stepped;
			}
			return addDays(stepped, lastDayOfZonedMonth(stepped) - stepped.getDate());
		}
		case "week":
			return addWeeks(zoned, direction);
		case "day":
		case "resource":
			return addDays(zoned, direction);
		case "days":
			return addDays(zoned, direction * Math.max(1, options.dayCount));
		case "agenda":
			return addDays(zoned, direction * Math.max(1, options.agendaDayCount));
		default:
			return assertNeverView(view);
	}
}

export function rangesIntersect(left: EventCalendarDateRange, right: EventCalendarDateRange): boolean {
	return left.start < right.end && left.end > right.start;
}

export function eventsOverlap(left: EventCalendarDateRange, right: EventCalendarDateRange): boolean {
	return rangesIntersect(left, right);
}

/** Every zoned midnight inside the range, in order. */
export function getVisibleDays(range: EventCalendarDateRange, timeZone: string): TZDate[] {
	const days: TZDate[] = [];
	for (let cursor = zonedStartOfDay(range.start, timeZone); cursor < range.end; cursor = addZonedDays(cursor, 1, timeZone)) {
		days.push(cursor);
	}
	return days;
}

/** Splits consecutive days into week rows of seven. */
export function chunkWeeks<TDay extends Date>(days: readonly TDay[]): TDay[][] {
	const rows: TDay[][] = [];
	for (let index = 0; index < days.length; index += DAYS_PER_WEEK) {
		rows.push(days.slice(index, index + DAYS_PER_WEEK));
	}
	return rows;
}

/** Whether the day falls on one of the weekend weekdays in the display zone. */
export function isWeekendDay(day: Date, timeZone: string, weekendDays: readonly number[]): boolean {
	return weekendDays.includes(toZoned(day, timeZone).getDay());
}

function laterOf(left: Date, right: Date): Date {
	return left > right ? left : right;
}

function earlierOf(left: Date, right: Date): Date {
	return left < right ? left : right;
}

/**
 * The one canonical multi-day segmentation. Splits an occurrence into per-day
 * segments clamped to the range. Exclusive end — an event ending exactly at
 * zoned midnight emits NO segment for that day; zero-duration events emit one
 * segment; allDay occurrences walk the same absolute instants as timed ones and
 * only drop startMin/endMin, so their bounds must BE display-zone midnights.
 */
export function segmentOccurrence<TData extends EventCalendarEventData>(
	occurrence: EventCalendarOccurrence<TData>,
	range: EventCalendarDateRange,
	timeZone: string,
): EventCalendarSegment<TData>[] {
	const { start: occStart, end: occEnd } = occurrence;
	const isZeroLength = occEnd.getTime() === occStart.getTime();
	const clampStart = laterOf(occStart, range.start);
	const clampEnd = earlierOf(occEnd, range.end);
	if (clampEnd < clampStart || (clampEnd.getTime() === clampStart.getTime() && !isZeroLength)) {
		return [];
	}
	const segments: EventCalendarSegment<TData>[] = [];
	let cursor: Date = zonedStartOfDay(clampStart, timeZone);
	while (cursor < clampEnd || (isZeroLength && segments.length === 0)) {
		const next = addZonedDays(cursor, 1, timeZone);
		const segStart = laterOf(clampStart, cursor);
		const segEnd = earlierOf(clampEnd, next);
		if (segEnd.getTime() > segStart.getTime() || isZeroLength) {
			const isStart = segStart.getTime() === occStart.getTime();
			const isEnd = segEnd.getTime() === occEnd.getTime();
			const startMin = differenceInMinutes(segStart, cursor);
			const timing = occurrence.allDay ? {} : { startMin, endMin: Math.max(differenceInMinutes(segEnd, cursor), startMin) };
			segments.push({ occurrence, day: cursor, isStart, isEnd, continuesBefore: !isStart, continuesAfter: !isEnd, ...timing });
		}
		if (isZeroLength) {
			break;
		}
		cursor = next;
	}
	return segments;
}

/**
 * Whether the span is longer than the calendar day it starts on. An event
 * ending exactly at the next midnight is still single-day (exclusive end), and
 * the yardstick is that day's real length, never a flat 24h (DST days).
 */
export function spansMultipleDays(occurrence: EventCalendarDateRange, timeZone?: string): boolean {
	const dayStart = timeZone === undefined ? startOfDay(occurrence.start) : zonedStartOfDay(occurrence.start, timeZone);
	const nextDayStart = timeZone === undefined ? startOfDay(addDays(dayStart, 1)) : addZonedDays(dayStart, 1, timeZone);
	return occurrence.end.getTime() - occurrence.start.getTime() > nextDayStart.getTime() - dayStart.getTime();
}

/** True when the occurrence should render as a bar (all-day row / month lanes). */
export function isBarOccurrence(occurrence: Pick<EventCalendarOccurrence, "allDay" | "start" | "end">, timeZone?: string): boolean {
	return occurrence.allDay || spansMultipleDays(occurrence, timeZone);
}

interface PackingItem<TData extends EventCalendarEventData> {
	readonly segment: EventCalendarSegment<TData>;
	readonly startMin: number;
	readonly effectiveEnd: number;
	column: number;
}

function toPackingItem<TData extends EventCalendarEventData>(segment: EventCalendarSegment<TData>): PackingItem<TData> {
	const startMin = segment.startMin ?? 0;
	const endMin = segment.endMin ?? startMin;
	return { segment, startMin, effectiveEnd: Math.max(endMin, startMin + MIN_PACK_SLOT), column: 0 };
}

function comparePackingItems<TData extends EventCalendarEventData>(left: PackingItem<TData>, right: PackingItem<TData>): number {
	return (
		left.startMin - right.startMin ||
		right.effectiveEnd - right.startMin - (left.effectiveEnd - left.startMin) ||
		left.segment.occurrence.key.localeCompare(right.segment.occurrence.key)
	);
}

/** Sweeps start-sorted items into connected overlap clusters. */
function clusterItems<TData extends EventCalendarEventData>(items: readonly PackingItem<TData>[]): PackingItem<TData>[][] {
	const clusters: PackingItem<TData>[][] = [];
	let current: PackingItem<TData>[] = [];
	let clusterEnd = Number.NEGATIVE_INFINITY;
	for (const item of items) {
		if (item.startMin >= clusterEnd) {
			current = [];
			clusters.push(current);
			clusterEnd = Number.NEGATIVE_INFINITY;
		}
		current.push(item);
		clusterEnd = Math.max(clusterEnd, item.effectiveEnd);
	}
	return clusters;
}

function itemsOverlap<TData extends EventCalendarEventData>(left: PackingItem<TData>, right: PackingItem<TData>): boolean {
	return left.startMin < right.effectiveEnd && left.effectiveEnd > right.startMin;
}

/**
 * Google-style overlap packing for one day's timed segments: greedy columns
 * per overlap cluster, then each block widens rightward into free columns.
 * Returns packed copies in start order; the input is left untouched.
 */
export function packTimedSegments<TData extends EventCalendarEventData>(segments: readonly EventCalendarSegment<TData>[]): EventCalendarSegment<TData>[] {
	const items = segments.map(toPackingItem).sort(comparePackingItems);
	const packed: EventCalendarSegment<TData>[] = [];
	for (const cluster of clusterItems(items)) {
		const columnEnds: number[] = [];
		const byColumn = new Map<number, PackingItem<TData>[]>();
		for (const item of cluster) {
			let column = columnEnds.findIndex((end: number): boolean => end <= item.startMin);
			if (column === -1) {
				column = columnEnds.length;
				columnEnds.push(0);
			}
			columnEnds[column] = item.effectiveEnd;
			item.column = column;
			byColumn.set(column, [...(byColumn.get(column) ?? []), item]);
		}
		const columnCount = columnEnds.length;
		for (const item of cluster) {
			let columnSpan = 1;
			while (item.column + columnSpan < columnCount) {
				const occupants = byColumn.get(item.column + columnSpan) ?? [];
				if (occupants.some((occupant: PackingItem<TData>): boolean => itemsOverlap(occupant, item))) {
					break;
				}
				columnSpan++;
			}
			packed.push({ ...item.segment, column: item.column, columnCount, columnSpan });
		}
	}
	return packed;
}

interface WeekBar<TData extends EventCalendarEventData> {
	readonly segment: EventCalendarSegment<TData>;
	colStart: number;
	colSpan: number;
	isStart: boolean;
	isEnd: boolean;
	lane: number;
}

function compareBars<TData extends EventCalendarEventData>(left: WeekBar<TData>, right: WeekBar<TData>): number {
	return left.colStart - right.colStart || right.colSpan - left.colSpan || left.segment.occurrence.key.localeCompare(right.segment.occurrence.key);
}

/** First lane whose columns `colStart … colStart + colSpan` are all free; marks them taken. */
function claimLane(lanes: boolean[][], colStart: number, colSpan: number, columnCount: number): number {
	for (let lane = 0; ; lane++) {
		const row = lanes[lane] ?? Array.from({ length: columnCount }, (): boolean => false);
		lanes[lane] = row;
		const columns = row.slice(colStart, colStart + colSpan);
		if (columns.every((taken: boolean): boolean => !taken)) {
			row.fill(true, colStart, colStart + colSpan);
			return lane;
		}
	}
}

/**
 * Build the laned bars for one week row: consecutive-day segments of the same
 * occurrence merge into ONE bar (colStart → colSpan) stacked into lanes.
 * Returns NEW segment objects — the shared per-day segments stay pristine.
 */
export function packWeekRowLanes<TData extends EventCalendarEventData>(
	segments: readonly EventCalendarSegment<TData>[],
	rowIndex: number,
	rowStart: Date,
	timeZone: string,
	columnCount: number = DAYS_PER_WEEK,
): EventCalendarSegment<TData>[] {
	const rowStartDay = zonedStartOfDay(rowStart, timeZone);
	const merged = new Map<string, WeekBar<TData>>();
	for (const segment of segments) {
		const dayIndex = differenceInCalendarDays(zonedStartOfDay(segment.day, timeZone), rowStartDay);
		const colStart = Math.max(0, Math.min(columnCount - 1, dayIndex));
		const existing = merged.get(segment.occurrence.key);
		if (existing === undefined) {
			merged.set(segment.occurrence.key, { segment, colStart, colSpan: 1, isStart: segment.isStart, isEnd: segment.isEnd, lane: 0 });
			continue;
		}
		const start = Math.min(existing.colStart, colStart);
		const end = Math.max(existing.colStart + existing.colSpan, colStart + 1);
		existing.colStart = start;
		existing.colSpan = end - start;
		existing.isStart = existing.isStart || segment.isStart;
		existing.isEnd = existing.isEnd || segment.isEnd;
	}
	const bars = [...merged.values()].sort(compareBars);
	const lanes: boolean[][] = [];
	for (const bar of bars) {
		bar.lane = claimLane(lanes, bar.colStart, bar.colSpan, columnCount);
	}
	return bars.map((bar: WeekBar<TData>): EventCalendarSegment<TData> => ({
		...bar.segment,
		isStart: bar.isStart,
		isEnd: bar.isEnd,
		continuesBefore: !bar.isStart,
		continuesAfter: !bar.isEnd,
		lane: bar.lane,
		rowIndex,
		colStart: bar.colStart,
		colSpan: bar.colSpan,
	}));
}

export interface EventCalendarDayBucket<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly allDay: readonly EventCalendarSegment<TData>[];
	/** Packed (column/columnCount/columnSpan set), in start order. */
	readonly timed: readonly EventCalendarSegment<TData>[];
}

export interface EventCalendarWeekRow<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly rowIndex: number;
	readonly rowStart: Date;
	/** Laned bar segments (one per occurrence per row). */
	readonly bars: readonly EventCalendarSegment<TData>[];
}

export interface EventCalendarIndex<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly occurrences: readonly EventCalendarOccurrence<TData>[];
	readonly byDay: ReadonlyMap<string, EventCalendarDayBucket<TData>>;
	readonly weekRows: readonly EventCalendarWeekRow<TData>[];
}

export type EventCalendarEventOrder<TData extends EventCalendarEventData = EventCalendarEventData> = (
	left: EventCalendarOccurrence<TData>,
	right: EventCalendarOccurrence<TData>,
) => number;

export type EventCalendarGetOccurrences<TData extends EventCalendarEventData = EventCalendarEventData> = (
	event: CalendarEvent<TData>,
	range: EventCalendarDateRange,
	context: { readonly timeZone: string },
) => readonly EventCalendarDateRange[] | null;

export interface BuildIndexOptions<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly timeZone: string;
	readonly weekStartsOn: WeekStartsOn;
	readonly eventOrder?: EventCalendarEventOrder<TData>;
	readonly getOccurrences?: EventCalendarGetOccurrences<TData>;
}

/** Start ascending, then longer first, then key — the stable default ordering. */
export function defaultEventOrder(left: EventCalendarOccurrence, right: EventCalendarOccurrence): number {
	return (
		left.start.getTime() - right.start.getTime() ||
		right.end.getTime() - right.start.getTime() - (left.end.getTime() - left.start.getTime()) ||
		left.key.localeCompare(right.key)
	);
}

/** Higher priority packs and orders first; ties fall through to `defaultEventOrder`. */
export function createPriorityEventOrder<TData extends EventCalendarEventData>(getEventPriority: (event: CalendarEvent<TData>) => number): EventCalendarEventOrder<TData> {
	return (left: EventCalendarOccurrence<TData>, right: EventCalendarOccurrence<TData>): number =>
		getEventPriority(right.event) - getEventPriority(left.event) || defaultEventOrder(left, right);
}

/** Instants of the series replaced by RECURRENCE-ID overrides, by parent event id. */
function collectOverrideTimes<TData extends EventCalendarEventData>(events: readonly CalendarEvent<TData>[]): Map<string, Set<number>> {
	const overrideTimes = new Map<string, Set<number>>();
	for (const event of events) {
		if (event.recurringEventId === undefined || event.originalStart === undefined) {
			continue;
		}
		const times = overrideTimes.get(event.recurringEventId) ?? new Set<number>();
		times.add(event.originalStart.getTime());
		overrideTimes.set(event.recurringEventId, times);
	}
	return overrideTimes;
}

function expandEvent<TData extends EventCalendarEventData>(
	event: CalendarEvent<TData>,
	range: EventCalendarDateRange,
	options: BuildIndexOptions<TData>,
	replaced: ReadonlySet<number> | undefined,
): EventCalendarOccurrence<TData>[] {
	const custom = options.getOccurrences?.(event, range, { timeZone: options.timeZone }) ?? null;
	const isReplaced = (start: Date): boolean => replaced?.has(start.getTime()) ?? false;
	if (custom === null) {
		return expandRecurrence(event, range, { timeZone: options.timeZone }).filter((occurrence: EventCalendarOccurrence<TData>): boolean => !isReplaced(occurrence.start));
	}
	const occurrences: EventCalendarOccurrence<TData>[] = [];
	custom.forEach((instance: EventCalendarDateRange, recurrenceIndex: number): void => {
		if (isReplaced(instance.start) || !rangesIntersect(instance, range)) {
			return;
		}
		occurrences.push({
			key: occurrenceKey(event.id, instance.start),
			eventId: event.id,
			event,
			start: instance.start,
			end: instance.end,
			allDay: event.allDay ?? false,
			isRecurring: true,
			recurrenceIndex,
		});
	});
	return occurrences;
}

interface MutableDayBucket<TData extends EventCalendarEventData> {
	readonly allDay: EventCalendarSegment<TData>[];
	readonly timed: EventCalendarSegment<TData>[];
}

/** Expands, orders, segments and packs every event intersecting the visible range. */
export function buildEventIndex<TData extends EventCalendarEventData>(
	events: readonly CalendarEvent<TData>[],
	visibleRange: EventCalendarDateRange,
	options: BuildIndexOptions<TData>,
): EventCalendarIndex<TData> {
	const { timeZone, weekStartsOn } = options;
	const order = options.eventOrder ?? defaultEventOrder;
	const overrideTimes = collectOverrideTimes(events);
	const occurrences = events.flatMap((event: CalendarEvent<TData>): EventCalendarOccurrence<TData>[] =>
		expandEvent(event, visibleRange, options, overrideTimes.get(event.id)),
	);
	occurrences.sort(order);

	const buckets = new Map<string, MutableDayBucket<TData>>();
	const barSegmentsByRow = new Map<number, EventCalendarSegment<TData>[]>();
	const firstRowStart = startOfWeek(toZoned(visibleRange.start, timeZone), { weekStartsOn });
	for (const occurrence of occurrences) {
		const isBar = isBarOccurrence(occurrence, timeZone);
		for (const segment of segmentOccurrence(occurrence, visibleRange, timeZone)) {
			const key = getDayKey(segment.day, timeZone);
			const bucket = buckets.get(key) ?? { allDay: [], timed: [] };
			buckets.set(key, bucket);
			if (!isBar) {
				bucket.timed.push(segment);
				continue;
			}
			bucket.allDay.push(segment);
			// Calendar-day maths, not a fixed 168h divisor: DST weeks are 167/169h long.
			const rowIndex = Math.floor(differenceInCalendarDays(toZoned(segment.day, timeZone), firstRowStart) / DAYS_PER_WEEK);
			barSegmentsByRow.set(rowIndex, [...(barSegmentsByRow.get(rowIndex) ?? []), segment]);
		}
	}

	const byDay = new Map<string, EventCalendarDayBucket<TData>>();
	for (const [key, bucket] of buckets) {
		byDay.set(key, { allDay: bucket.allDay, timed: packTimedSegments(bucket.timed) });
	}
	const weekRows = [...barSegmentsByRow.entries()]
		.map(([rowIndex, segments]: [number, EventCalendarSegment<TData>[]]): EventCalendarWeekRow<TData> => {
			const rowStart = addWeeks(firstRowStart, rowIndex);
			return { rowIndex, rowStart, bars: packWeekRowLanes(segments, rowIndex, rowStart, timeZone) };
		})
		.sort((left: EventCalendarWeekRow<TData>, right: EventCalendarWeekRow<TData>): number => left.rowIndex - right.rowIndex);

	return { occurrences, byDay, weekRows };
}

/** Cache key for index memoization; cheap string compare. */
export function getRangeKey(range: EventCalendarDateRange): string {
	return `${String(range.start.getTime())}-${String(range.end.getTime())}`;
}

export interface FlattenedResource {
	readonly resource: EventCalendarResource;
	readonly depth: number;
}

/** Depth-first flatten of the resource tree (parents included). */
export function flattenResources(resources: readonly EventCalendarResource[], depth = 0): FlattenedResource[] {
	return resources.flatMap((resource: EventCalendarResource): FlattenedResource[] => [{ resource, depth }, ...flattenResources(resource.children ?? [], depth + 1)]);
}

/** The leaf resources — the resource view's booking columns. */
export function leafResources(resources: readonly EventCalendarResource[]): EventCalendarResource[] {
	return flattenResources(resources)
		.map((row: FlattenedResource): EventCalendarResource => row.resource)
		.filter((resource: EventCalendarResource): boolean => (resource.children ?? []).length === 0);
}

/**
 * Whether a day is an off day (non-working) in the display zone. Callers pass
 * the calendar's own weekendDays so the shading cannot contradict the weekend
 * the rest of the calendar renders; an explicit offDays.weekendDays still wins.
 */
export function resolveOffDay(day: Date, timeZone: string, config: boolean | EventCalendarOffDaysConfig | undefined, defaultWeekendDays?: readonly number[]): boolean {
	if (config === undefined || config === false) {
		return false;
	}
	const resolved: EventCalendarOffDaysConfig = config === true ? {} : config;
	const weekendDays = resolved.weekendDays ?? defaultWeekendDays ?? DEFAULT_WEEKEND_DAYS;
	if (isWeekendDay(day, timeZone, weekendDays)) {
		return true;
	}
	const key = getDayKey(day, timeZone);
	if ((resolved.dates ?? []).some((date: Date): boolean => getDayKey(date, timeZone) === key)) {
		return true;
	}
	return resolved.isOffDay?.(day) ?? false;
}

/** Minutes → an instant on the zoned day (`minutes` may exceed one day). */
export function minutesToInstant(day: Date, minutes: number, timeZone: string): Date {
	return new Date(zonedStartOfDay(day, timeZone).getTime() + minutes * MS_PER_MINUTE);
}

/** Calendar-day offset of each day from `rowStart`, in the display zone. */
export function dayOffsets(days: readonly Date[], rowStart: Date, timeZone: string): number[] {
	const start = zonedStartOfDay(rowStart, timeZone);
	return days.map((day: Date): number => differenceInCalendarDays(zonedStartOfDay(day, timeZone), start));
}

export interface GridPosition {
	/** 0-based index among the visible columns. */
	readonly column: number;
	readonly span: number;
}

/** Visible-column position of a span of day offsets (hidden weekend columns are skipped); null = fully hidden. */
export function gridPosition(offsets: readonly number[], colStart: number, colSpan: number): GridPosition | null {
	let first = -1;
	let last = -1;
	for (let offset = colStart; offset < colStart + colSpan; offset++) {
		const column = offsets.indexOf(offset);
		if (column === -1) {
			continue;
		}
		if (first === -1) {
			first = column;
		}
		last = column;
	}
	return first === -1 ? null : { column: first, span: last - first + 1 };
}

/** The day offsets a range covers inside a row of `columnCount` days from `rowStart`; null when outside. */
export function rangeColumnSpan(
	range: EventCalendarDateRange,
	rowStart: Date,
	columnCount: number,
	timeZone: string,
): { readonly colStart: number; readonly colSpan: number } | null {
	const start = zonedStartOfDay(rowStart, timeZone);
	const lastInstant = new Date(Math.max(range.start.getTime(), range.end.getTime() - 1));
	const first = differenceInCalendarDays(zonedStartOfDay(range.start, timeZone), start);
	const last = differenceInCalendarDays(zonedStartOfDay(lastInstant, timeZone), start);
	if (first >= columnCount || last < 0) {
		return null;
	}
	const colStart = Math.max(0, first);
	const colEnd = Math.min(columnCount - 1, last);
	return { colStart, colSpan: colEnd - colStart + 1 };
}
