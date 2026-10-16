"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-time-grid.json):
// the shared week / day / N-days engine — hour gutter, minute-positioned
// events, the all-day row, drag ghosts, the now indicator and internal
// scrolling. `EventCalendarTimeGrid` (props `view`, `dayStartHour`,
// `dayEndHour`, `showAllDay`, `interval`), `EventCalendarWeekView`,
// `EventCalendarDayView`, `EventCalendarDaysView`, `EventCalendarTimeGutter`,
// `EventCalendarNowIndicator`, `minuteBlockStyle`, `EVENT_TRACK_WIDTH` and
// `useNow` keep ReUI's names. Deviations:
// - Keyboard navigation (ReUI had none): the grid is one tab stop with a
//   roving focus over the day columns — Left/Right move between columns,
//   Up/Down move a slot cursor by `slotDuration` (announced), Enter/Space fire
//   `onSlotClick` for the cursor slot, PageUp/PageDown change period.
// - `useNow()` reads the calendar clock (the `now` prop or the ticking system
//   clock) and takes no interval argument.
// - `scrollMode: "page"`, native scrollbars, `renderAllDaySection` and the
//   `api.scrollToTime` handler are not ported; the grid scrolls to
//   `scrollToHour` on mount.
// - The building blocks the resource view reuses (`EventCalendarDayColumn`,
//   `EventCalendarAllDayCell`, `useTimeGridKeyboard`) are exported here.
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/core/utils";
import { addMinutes, format } from "date-fns";
import * as React from "react";

import {
	EventCalendarViewContext,
	useEventCalendar,
	useEventCalendarDay,
	useEventCalendarDrag,
	useEventCalendarNow,
	useEventCalendarViewConfig,
	useEventCalendarViewContext,
	useEventCalendarViewSettings,
	type EventCalendarViewContextValue,
} from "./event-calendar";
import { useEventCalendarGestures } from "./event-calendar-dnd";
import { EVENT_CALENDAR_GHOST, EVENT_CALENDAR_SLOT_DRAFT, EventCalendarEvent, getEventToneStyle } from "./event-calendar-event";
import {
	dayOffsets,
	getDayKey,
	getDayTotalMinutes,
	getVisibleDays,
	gridPosition,
	isWeekendDay,
	MINUTES_PER_HOUR,
	minutesToInstant,
	packTimedSegments,
	packWeekRowLanes,
	rangeColumnSpan,
	resolveOffDay,
	snapMinutes,
	toZoned,
	zonedMinutesOfDay,
	zonedStartOfDay,
} from "./event-calendar-lib";
import type { CalendarView, EventCalendarDateRange, EventCalendarSegment } from "./event-calendar-types";

/** Inline size of the timed-block track; the strip beside a full-width block stays clickable for "new event here". */
export const EVENT_TRACK_WIDTH = "(100% - var(--ec-event-gutter, 0.75rem))";

/** Grid interval bounds, in minutes. */
const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 240;
/** Shortest drawn block, in hours of the track (15 minutes). */
const MIN_BLOCK_HOURS = 0.25;
/** Events stack above the column background, below the ghost/now layers (`z-sticky`). */
const EVENT_STACK_BASE = 1;
/** Pixels of headroom kept above the scroll target so its gutter label stays visible. */
const SCROLL_LABEL_HEADROOM_PX = 12;
const DEFAULT_OFF_DAY_CLASS = "bg-muted/40";
const GRID_LINE_OFFSET = 1;

type TrackStyle = React.CSSProperties & Readonly<Record<"--ec-hour-height", string>>;

const TRACK_STYLE: TrackStyle = { "--ec-hour-height": "3rem" };

/** Absolute overlay block positioned by minutes (blocks, ghosts and drafts). */
export function minuteBlockStyle(startMin: number, endMin: number, boundsStartMin: number): React.CSSProperties {
	const top = (startMin - boundsStartMin) / MINUTES_PER_HOUR;
	const height = Math.max((endMin - startMin) / MINUTES_PER_HOUR, MIN_BLOCK_HOURS);
	return { top: `calc(var(--ec-hour-height) * ${String(top)})`, height: `calc(var(--ec-hour-height) * ${String(height)})` };
}

/** The calendar clock as a Date. */
export function useNow(): Date {
	const nowMs = useEventCalendarNow();
	return React.useMemo((): Date => new Date(nowMs), [nowMs]);
}

function clampInterval(interval: number): number {
	return Math.min(Math.max(interval, MIN_INTERVAL_MINUTES), MAX_INTERVAL_MINUTES);
}

/** A time-grid column's identity: its day plus (resource view) its resource. */
export interface TimeGridColumn {
	readonly key: string;
	readonly day: Date;
	readonly resourceId?: string;
}

export function timeGridColumnKey(day: Date, timeZone: string, resourceId?: string): string {
	return `${getDayKey(day, timeZone)}|${resourceId ?? ""}`;
}

export interface TimeGridKeyboard {
	readonly focusedKey: string;
	readonly cursorMin: number;
	readonly onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
	readonly onColumnFocus: (key: string) => void;
}

/** Roving focus over the day columns plus a keyboard slot cursor (display state only). */
export function useTimeGridKeyboard(columns: readonly TimeGridColumn[], bounds: { readonly startMin: number; readonly endMin: number }, view: CalendarView): TimeGridKeyboard {
	const { settings, internals, api } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { timeZone, locale, slotDuration, i18n } = settings;
	const [focused, setFocused] = React.useState<string | null>(null);
	const [cursor, setCursor] = React.useState<number | null>(null);
	const defaultCursor = Math.min(Math.max(viewConfig.scrollToHour * MINUTES_PER_HOUR, bounds.startMin), bounds.endMin - slotDuration);
	const cursorMin = cursor ?? defaultCursor;
	const focusedKey = columns.find((column: TimeGridColumn): boolean => column.key === focused)?.key ?? columns.at(0)?.key ?? "";

	const onColumnFocus = React.useCallback(
		(key: string): void => {
			setFocused(key);
		},
		[setFocused],
	);

	const onKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLElement>): void => {
			const { target } = event;
			if (!(target instanceof HTMLElement) || target.dataset.slot !== "event-calendar-day-column") {
				return;
			}
			const index = columns.findIndex((column: TimeGridColumn): boolean => column.key === target.dataset.ecColKey);
			const column = columns.at(index);
			if (column === undefined) {
				return;
			}
			const moveCursor = (delta: number): void => {
				const next = Math.min(Math.max(snapMinutes(cursorMin + delta, slotDuration), bounds.startMin), bounds.endMin - slotDuration);
				setCursor(next);
				const start = minutesToInstant(column.day, next, timeZone);
				internals.announce(i18n.functions.formatEventTime(toZoned(start, timeZone), toZoned(addMinutes(start, slotDuration), timeZone), false, { locale }));
			};
			const focusColumn = (target: TimeGridColumn | undefined): void => {
				if (target === undefined) {
					return;
				}
				setFocused(target.key);
				const root = event.currentTarget;
				root.querySelector<HTMLElement>(`[data-ec-col-key="${target.key}"]`)?.focus();
			};
			switch (event.key) {
				case "ArrowLeft":
					event.preventDefault();
					focusColumn(columns.at(Math.max(0, index - 1)));
					return;
				case "ArrowRight":
					event.preventDefault();
					focusColumn(columns.at(Math.min(columns.length - 1, index + 1)));
					return;
				case "ArrowUp":
					event.preventDefault();
					moveCursor(-slotDuration);
					return;
				case "ArrowDown":
					event.preventDefault();
					moveCursor(slotDuration);
					return;
				case "PageUp":
					event.preventDefault();
					api.prev();
					return;
				case "PageDown":
					event.preventDefault();
					api.next();
					return;
				case "Enter":
				case " ": {
					event.preventDefault();
					const start = minutesToInstant(column.day, cursorMin, timeZone);
					internals.clickSlot(
						{ date: start, end: addMinutes(start, slotDuration), allDay: false, view, ...(column.resourceId === undefined ? {} : { resourceId: column.resourceId }) },
						event,
					);
					return;
				}
				default:
					return;
			}
		},
		[columns, cursorMin, slotDuration, bounds, timeZone, internals, i18n, locale, api, view, setFocused, setCursor],
	);

	return { focusedKey, cursorMin, onKeyDown, onColumnFocus };
}

/** Scrolls the track to `scrollToHour` once on mount (and when the hour bounds change). */
function useInitialScroll(scrollRef: React.RefObject<HTMLDivElement | null>, startHour: number, interval: number): void {
	const viewConfig = useEventCalendarViewConfig();
	const { scrollToHour } = viewConfig;
	React.useEffect((): void => {
		const root = scrollRef.current;
		const viewport = root?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
		const slot = root?.querySelector<HTMLElement>("[data-slot=event-calendar-time-gutter] > div");
		if (viewport === null || viewport === undefined || slot === null || slot === undefined) {
			return;
		}
		const slotPx = slot.getBoundingClientRect().height;
		if (slotPx <= 0) {
			return;
		}
		const pxPerMinute = slotPx / interval;
		viewport.scrollTop = Math.max(0, (scrollToHour - startHour) * MINUTES_PER_HOUR * pxPerMinute - SCROLL_LABEL_HEADROOM_PX);
	}, [scrollRef, scrollToHour, startHour, interval]);
}

export interface EventCalendarTimeGutterProps extends React.ComponentPropsWithoutRef<"div"> {
	readonly days: readonly Date[];
	readonly slots: readonly number[];
	readonly startHour: number;
	readonly interval: number;
}

interface GutterSlotProps {
	readonly referenceDay: Date;
	readonly minutes: number;
	readonly startHour: number;
	readonly interval: number;
}

function GutterSlot({ referenceDay, minutes, startHour, interval }: GutterSlotProps): React.JSX.Element {
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { timeZone, locale, i18n } = settings;
	const time = minutesToInstant(referenceDay, minutes, timeZone);
	const pattern = interval % MINUTES_PER_HOUR === 0 ? i18n.formats.timeGutter : i18n.formats.timeGutterMinute;
	const custom = viewConfig.renderTimeGutterSlot?.({ time, hour: Math.floor(minutes / MINUTES_PER_HOUR), minute: minutes % MINUTES_PER_HOUR });
	const label = custom ?? (minutes > startHour * MINUTES_PER_HOUR ? format(toZoned(time, timeZone), pattern, locale === undefined ? {} : { locale }) : null);
	const style = React.useMemo((): React.CSSProperties => ({ height: `calc(var(--ec-hour-height) * ${String(interval / MINUTES_PER_HOUR)})` }), [interval]);
	return (
		<div className="relative" style={style}>
			{label === null ? null : <span className={cn("absolute end-2 -top-2 text-muted-foreground", viewConfig.classNames?.timeGutterLabel)}>{label}</span>}
		</div>
	);
}

/** The hour labels column. */
export const EventCalendarTimeGutter = React.forwardRef<HTMLDivElement, EventCalendarTimeGutterProps>(function EventCalendarTimeGutter(
	{ days, slots, startHour, interval, className, ...props },
	forwardedRef,
): React.JSX.Element {
	const viewConfig = useEventCalendarViewConfig();
	const now = useNow();
	const referenceDay = days.at(0) ?? now;
	return (
		<div
			ref={forwardedRef}
			aria-hidden
			data-slot="event-calendar-time-gutter"
			className={cn("relative w-(--ec-gutter-width,4.5rem) shrink-0 border-e border-border", viewConfig.classNames?.timeGutter, className)}
			{...props}>
			{slots.map((minutes: number): React.JSX.Element => (
				<GutterSlot key={minutes} referenceDay={referenceDay} minutes={minutes} startHour={startHour} interval={interval} />
			))}
		</div>
	);
});

export interface EventCalendarNowIndicatorProps extends React.ComponentPropsWithoutRef<"div"> {
	/** The columns' days, in order (one per column; the resource view repeats its day). */
	readonly days: readonly Date[];
	readonly startHour: number;
	readonly endHour: number;
}

/** The current-time line across the track, strongest over today's column(s). */
export const EventCalendarNowIndicator = React.forwardRef<HTMLDivElement, EventCalendarNowIndicatorProps>(function EventCalendarNowIndicator(
	{ days, startHour, endHour, className, ...props },
	forwardedRef,
): React.JSX.Element | null {
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const now = useNow();
	const { timeZone } = settings;
	const todayKey = getDayKey(now, timeZone);
	const todayColumns = days.map((day: Date, index: number): number => (getDayKey(day, timeZone) === todayKey ? index : -1)).filter((index: number): boolean => index >= 0);
	const minutes = zonedMinutesOfDay(now, timeZone);
	const firstColumn = todayColumns.at(0) ?? -1;
	const lastColumn = todayColumns.at(-1) ?? -1;
	const top = minutes / MINUTES_PER_HOUR - startHour;
	const lineStyle = React.useMemo((): React.CSSProperties => ({ top: `calc(var(--ec-hour-height) * ${String(top)})` }), [top]);
	const todayStyle = React.useMemo((): React.CSSProperties => {
		const share = 1 / Math.max(1, days.length);
		return {
			left: `calc(var(--ec-gutter-width, 4.5rem) + (100% - var(--ec-gutter-width, 4.5rem)) * ${String(firstColumn * share)})`,
			width: `calc((100% - var(--ec-gutter-width, 4.5rem)) * ${String((lastColumn - firstColumn + 1) * share)})`,
		};
	}, [days.length, firstColumn, lastColumn]);
	if (firstColumn === -1 || minutes < startHour * MINUTES_PER_HOUR || minutes > endHour * MINUTES_PER_HOUR) {
		return null;
	}
	const custom = viewConfig.renderNowIndicator?.({ time: now });
	return (
		<div
			ref={forwardedRef}
			aria-hidden
			data-slot="event-calendar-now-indicator"
			className={cn("pointer-events-none absolute inset-x-0 z-sticky", className)}
			style={lineStyle}
			{...props}>
			{custom ?? (
				<>
					<div className="absolute start-(--ec-gutter-width,4.5rem) end-0 h-px bg-destructive/40" />
					<div className="absolute h-px" style={todayStyle}>
						<div className="absolute inset-x-0 top-0 h-px bg-destructive" />
						<div className="absolute -start-1 top-0 size-1.5 -translate-y-1/2 rounded-full bg-destructive" />
					</div>
				</>
			)}
		</div>
	);
});

interface TimedBlockProps {
	readonly segment: EventCalendarSegment;
	readonly boundsStartMin: number;
	readonly boundsEndMin: number;
}

const TimedBlock = React.memo(function TimedBlock({ segment, boundsStartMin, boundsEndMin }: TimedBlockProps): React.JSX.Element {
	const viewConfig = useEventCalendarViewConfig();
	const startMin = Math.max(segment.startMin ?? 0, boundsStartMin);
	const endMin = Math.min(segment.endMin ?? startMin, boundsEndMin);
	const columnCount = segment.columnCount ?? 1;
	const column = segment.column ?? 0;
	const span = segment.columnSpan ?? 1;
	const zIndex = segment.occurrence.event.zIndex ?? EVENT_STACK_BASE + column;
	const style = React.useMemo(
		(): React.CSSProperties => ({
			...minuteBlockStyle(startMin, endMin, boundsStartMin),
			left: `calc(${EVENT_TRACK_WIDTH} * ${String(column / columnCount)})`,
			width: `calc(${EVENT_TRACK_WIDTH} * ${String(span / columnCount)})`,
			zIndex,
		}),
		[startMin, endMin, boundsStartMin, column, columnCount, span, zIndex],
	);
	return (
		<div data-slot="event-calendar-timed-block" className="absolute min-h-(--ec-event-min-h,1.25rem) px-0.5" style={style}>
			<EventCalendarEvent segment={segment} className={cn(columnCount > 1 ? "ring-1 ring-background" : undefined, viewConfig.classNames?.timedChip)} />
		</div>
	);
});

interface DayColumnGhostProps {
	readonly day: Date;
	readonly resourceId: string | undefined;
	readonly boundsStartMin: number;
	readonly boundsEndMin: number;
}

/** Minute window of a range intersecting the day, clipped to the bounds; null when outside. */
function dayWindow(
	range: EventCalendarDateRange,
	day: Date,
	bounds: { readonly startMin: number; readonly endMin: number },
	timeZone: string,
): readonly [number, number] | null {
	const dayStart = zonedStartOfDay(day, timeZone);
	const totalMinutes = getDayTotalMinutes(day, timeZone);
	const dayStartMs = dayStart.getTime();
	const from = Math.max((range.start.getTime() - dayStartMs) / MS_PER_MINUTE, bounds.startMin, 0);
	const to = Math.min((range.end.getTime() - dayStartMs) / MS_PER_MINUTE, bounds.endMin, totalMinutes);
	return to > from ? [from, to] : null;
}

const MS_PER_MINUTE = 60_000;

/** The live ghost / drag-create draft inside one column — the only part a pointer move repaints. */
function DayColumnGhost({ day, resourceId, boundsStartMin, boundsEndMin }: DayColumnGhostProps): React.JSX.Element | null {
	const { drag, slotDraft } = useEventCalendarDrag();
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { timeZone, locale, i18n } = settings;
	const bounds = { startMin: boundsStartMin, endMin: boundsEndMin };
	const dragResource = drag === null ? undefined : (drag.proposedResourceId ?? drag.occurrence.event.resourceId);
	const ghostWindow =
		drag === null || drag.proposedDayGranular || (resourceId !== undefined && dragResource !== resourceId)
			? null
			: dayWindow({ start: drag.proposedStart, end: drag.proposedEnd }, day, bounds, timeZone);
	const draftWindow = slotDraft === null || slotDraft.allDay || slotDraft.resourceId !== resourceId ? null : dayWindow(slotDraft, day, bounds, timeZone);
	const [ghostFrom, ghostTo]: MinuteWindow = ghostWindow ?? NO_WINDOW;
	const [draftFrom, draftTo]: MinuteWindow = draftWindow ?? NO_WINDOW;
	const ghostStyle = React.useMemo(
		(): React.CSSProperties | undefined =>
			ghostFrom === undefined || ghostTo === undefined || drag === null
				? undefined
				: { ...getEventToneStyle(drag.occurrence.event.color), ...minuteBlockStyle(ghostFrom, ghostTo, boundsStartMin) },
		[ghostFrom, ghostTo, drag, boundsStartMin],
	);
	const draftStyle = React.useMemo(
		(): React.CSSProperties | undefined => (draftFrom === undefined || draftTo === undefined ? undefined : minuteBlockStyle(draftFrom, draftTo, boundsStartMin)),
		[draftFrom, draftTo, boundsStartMin],
	);
	if (ghostStyle === undefined && draftStyle === undefined) {
		return null;
	}
	return (
		<>
			{ghostStyle === undefined || drag === null ? null : (
				<div
					aria-hidden
					data-slot="event-calendar-drag-ghost"
					data-kind={drag.kind}
					data-drop-invalid={drag.valid ? undefined : ""}
					className={cn(
						"pointer-events-none absolute inset-x-0.5 z-sticky",
						drag.kind === "move" ? EVENT_CALENDAR_GHOST.move : EVENT_CALENDAR_GHOST.resize,
						drag.valid ? undefined : EVENT_CALENDAR_GHOST.invalid,
						viewConfig.classNames?.dragGhost,
					)}
					style={ghostStyle}
				/>
			)}
			{draftStyle === undefined || slotDraft === null ? null : (
				<div
					aria-hidden
					data-slot="event-calendar-slot-draft"
					className={cn("pointer-events-none absolute inset-x-0.5 z-sticky overflow-hidden", EVENT_CALENDAR_SLOT_DRAFT.box, viewConfig.classNames?.slotDraft)}
					style={draftStyle}>
					<span className={cn("block", EVENT_CALENDAR_SLOT_DRAFT.label)}>
						{i18n.functions.formatEventTime(toZoned(slotDraft.start, timeZone), toZoned(slotDraft.end, timeZone), false, { locale })}
					</span>
				</div>
			)}
		</>
	);
}

/** A missing minute window, destructured like a present one. */
const NO_WINDOW: MinuteWindow = [undefined, undefined];

type MinuteWindow = readonly [number | undefined, number | undefined];

function useOffDay(day: Date): { readonly isOff: boolean; readonly offClassName: string } {
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { effective } = useEventCalendarViewSettings();
	const config = effective.offDays ? (viewConfig.offDays === undefined || viewConfig.offDays === false ? true : viewConfig.offDays) : false;
	const custom = viewConfig.offDays !== undefined && viewConfig.offDays !== true && viewConfig.offDays !== false ? viewConfig.offDays.className : undefined;
	return { isOff: resolveOffDay(day, settings.timeZone, config, settings.weekendDays), offClassName: custom ?? DEFAULT_OFF_DAY_CLASS };
}

export interface EventCalendarDayColumnProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
	readonly day: Date;
	readonly startHour: number;
	readonly endHour: number;
	readonly interval: number;
	/** Packed timed segments to draw (defaults to the day's own bucket). */
	readonly segments?: readonly EventCalendarSegment[];
	readonly resourceId?: string;
	readonly columnKey: string;
	readonly tabbable: boolean;
	readonly cursorMin: number;
	readonly onColumnFocus: (key: string) => void;
}

/** One minute-positioned day column (a resource column in the resource view). */
export const EventCalendarDayColumn = React.memo(
	React.forwardRef<HTMLDivElement, EventCalendarDayColumnProps>(function EventCalendarDayColumn(
		{ day, startHour, endHour, interval, segments: segmentsProp, resourceId, columnKey, tabbable, cursorMin, onColumnFocus, className, ...props },
		forwardedRef,
	): React.JSX.Element {
		const { settings, internals } = useEventCalendar();
		const viewConfig = useEventCalendarViewConfig();
		const { view } = useEventCalendarViewContext();
		const gestures = useEventCalendarGestures();
		const { segments, isToday } = useEventCalendarDay(day);
		const { isOff, offClassName } = useOffDay(day);
		const { timeZone, locale, i18n, snapDuration, slotDuration } = settings;
		const dayStart = zonedStartOfDay(day, timeZone);
		const totalMinutes = getDayTotalMinutes(day, timeZone);
		const boundsStartMin = startHour * MINUTES_PER_HOUR;
		const boundsEndMin = Math.min(endHour * MINUTES_PER_HOUR, totalMinutes);
		const boundsMinutes = Math.max(MINUTES_PER_HOUR, boundsEndMin - boundsStartMin);
		const source = segmentsProp ?? segments.timed;

		// Segments clipped away by the hour bounds would still hold a packing column: repack the visible subset.
		const packed = React.useMemo((): readonly EventCalendarSegment[] => {
			const visible = source.filter((segment: EventCalendarSegment): boolean => {
				const startMin = segment.startMin ?? 0;
				return (segment.endMin ?? startMin) > boundsStartMin && startMin < boundsEndMin;
			});
			return visible.length === source.length ? source : packTimedSegments(visible);
		}, [source, boundsStartMin, boundsEndMin]);

		const style = React.useMemo((): React.CSSProperties => {
			const slotHeight = `calc(var(--ec-hour-height) * ${String(interval / MINUTES_PER_HOUR)})`;
			return {
				height: `calc(var(--ec-hour-height) * ${String(boundsMinutes / MINUTES_PER_HOUR)})`,
				backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent calc(${slotHeight} - 1px), var(--border) calc(${slotHeight} - 1px), var(--border) ${slotHeight})`,
			};
		}, [interval, boundsMinutes]);
		const cursorStyle = React.useMemo(
			(): React.CSSProperties => minuteBlockStyle(cursorMin, cursorMin + slotDuration, boundsStartMin),
			[cursorMin, slotDuration, boundsStartMin],
		);

		const slotFromPointer = React.useCallback(
			(event: React.MouseEvent<HTMLDivElement>): { readonly date: Date; readonly end: Date } => {
				const rect = event.currentTarget.getBoundingClientRect();
				const pxPerMinute = rect.height > 0 ? rect.height / boundsMinutes : 1;
				const minutes = snapMinutes(boundsStartMin + (event.clientY - rect.top) / pxPerMinute, snapDuration);
				const clamped = Math.min(Math.max(minutes, boundsStartMin), boundsEndMin - slotDuration);
				return { date: minutesToInstant(dayStart, clamped, timeZone), end: minutesToInstant(dayStart, clamped + slotDuration, timeZone) };
			},
			[boundsMinutes, boundsStartMin, boundsEndMin, snapDuration, slotDuration, dayStart, timeZone],
		);
		const handlePointerDown = React.useCallback(
			(event: React.PointerEvent<HTMLDivElement>): void => {
				if (event.target === event.currentTarget) {
					gestures.beginCreate(event, dayStart, false, resourceId);
				}
			},
			[gestures, dayStart, resourceId],
		);
		const handleClick = React.useCallback(
			(event: React.MouseEvent<HTMLDivElement>): void => {
				if (event.target !== event.currentTarget || internals.wasRecentGesture() || internals.wasRecentChipPress()) {
					return;
				}
				internals.clickSlot({ ...slotFromPointer(event), allDay: false, view, ...(resourceId === undefined ? {} : { resourceId }) }, event);
			},
			[internals, slotFromPointer, view, resourceId],
		);
		const handleFocus = React.useCallback(
			(event: React.FocusEvent<HTMLDivElement>): void => {
				if (event.target === event.currentTarget) {
					onColumnFocus(columnKey);
				}
			},
			[onColumnFocus, columnKey],
		);

		return (
			<div
				ref={forwardedRef}
				role="gridcell"
				tabIndex={tabbable ? 0 : -1}
				aria-label={format(toZoned(day, timeZone), i18n.formats.dayAria, locale === undefined ? {} : { locale })}
				aria-current={isToday ? "date" : undefined}
				data-slot="event-calendar-day-column"
				data-today={isToday ? "" : undefined}
				data-off={isOff ? "" : undefined}
				data-ec-day={dayStart.getTime()}
				data-ec-bounds-start={boundsStartMin}
				data-ec-bounds-end={boundsEndMin}
				data-ec-resource={resourceId}
				data-ec-col-key={columnKey}
				className={cn(
					"group/ec-col relative min-w-0 border-e border-border outline-none last:border-e-0 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
					isOff ? offClassName : undefined,
					isToday ? viewConfig.todayClassName : undefined,
					viewConfig.dayClassName?.(day),
					viewConfig.classNames?.dayColumn,
					className,
				)}
				style={style}
				onPointerDown={handlePointerDown}
				onClick={handleClick}
				onFocus={handleFocus}
				{...props}>
				{viewConfig.renderDayColumnBackground === undefined ? null : (
					<div className="pointer-events-none absolute inset-0">{viewConfig.renderDayColumnBackground({ day, boundsStartMin, boundsEndMin, totalMinutes })}</div>
				)}
				{packed.map((segment: EventCalendarSegment): React.JSX.Element => (
					<TimedBlock key={segment.occurrence.key} segment={segment} boundsStartMin={boundsStartMin} boundsEndMin={boundsEndMin} />
				))}
				<div
					aria-hidden
					data-slot="event-calendar-slot-cursor"
					className="pointer-events-none absolute inset-x-0.5 hidden rounded-sm border-2 border-ring/60 group-focus-visible/ec-col:block"
					style={cursorStyle}
				/>
				<DayColumnGhost day={dayStart} resourceId={resourceId} boundsStartMin={boundsStartMin} boundsEndMin={boundsEndMin} />
			</div>
		);
	}),
);

export interface EventCalendarAllDayCellProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
	readonly day: Date;
	readonly resourceId?: string;
	/** Chips to stack in the cell (the resource view); the time grid draws bars in an overlay instead. */
	readonly segments?: readonly EventCalendarSegment[];
	/** Reserved bar lanes above the cell content. */
	readonly laneCount?: number;
}

/** One all-day cell: a drag-create and drop target, optionally stacking its own chips. */
export const EventCalendarAllDayCell = React.forwardRef<HTMLDivElement, EventCalendarAllDayCellProps>(function EventCalendarAllDayCell(
	{ day, resourceId, segments, laneCount = 0, className, ...props },
	forwardedRef,
): React.JSX.Element {
	const { settings, internals } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { view } = useEventCalendarViewContext();
	const gestures = useEventCalendarGestures();
	const { isToday } = useEventCalendarDay(day);
	const { timeZone, locale, i18n } = settings;
	const dayStart = zonedStartOfDay(day, timeZone);
	const style = React.useMemo((): React.CSSProperties => ({ minHeight: `calc(${String(Math.max(1, laneCount))} * var(--ec-month-bar-h, 1.5rem) + 0.75rem)` }), [laneCount]);
	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			if (event.target === event.currentTarget) {
				gestures.beginCreate(event, dayStart, true, resourceId);
			}
		},
		[gestures, dayStart, resourceId],
	);
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>): void => {
			if (event.target !== event.currentTarget || internals.wasRecentGesture() || internals.wasRecentChipPress()) {
				return;
			}
			internals.clickSlot({ date: dayStart, allDay: true, view, ...(resourceId === undefined ? {} : { resourceId }) }, event);
		},
		[internals, dayStart, view, resourceId],
	);
	return (
		<div
			ref={forwardedRef}
			role="gridcell"
			tabIndex={-1}
			aria-label={`${format(toZoned(day, timeZone), i18n.formats.dayAria, locale === undefined ? {} : { locale })}, ${i18n.labels.allDay}`}
			data-slot="event-calendar-all-day-cell"
			data-today={isToday ? "" : undefined}
			data-ec-day={dayStart.getTime()}
			data-ec-resource={resourceId}
			className={cn("flex min-w-0 flex-col gap-0.5 border-e border-border p-1 last:border-e-0", viewConfig.dayClassName?.(day), className)}
			style={style}
			onPointerDown={handlePointerDown}
			onClick={handleClick}
			{...props}>
			{(segments ?? []).map((segment: EventCalendarSegment): React.JSX.Element => (
				<EventCalendarEvent key={segment.occurrence.key} segment={segment} />
			))}
		</div>
	);
});

interface AllDayBarsProps {
	readonly days: readonly Date[];
	readonly columnsStyle: React.CSSProperties;
}

/** Continuous all-day bars over the all-day row, lane-packed across the visible days. */
function AllDayBars({ days, columnsStyle }: AllDayBarsProps): React.JSX.Element {
	const { index, settings } = useEventCalendar();
	const { drag } = useEventCalendarDrag();
	const viewConfig = useEventCalendarViewConfig();
	const { timeZone } = settings;
	const firstDay = React.useMemo((): Date => days.at(0) ?? new Date(0), [days]);
	const lastDay = days.at(-1) ?? firstDay;
	const span = Math.max(1, dayOffsets([lastDay], firstDay, timeZone).at(0) ?? 0) + 1;
	const offsets = React.useMemo((): readonly number[] => dayOffsets(days, firstDay, timeZone), [days, firstDay, timeZone]);
	const bars = React.useMemo((): readonly EventCalendarSegment[] => {
		const seen = new Set<EventCalendarSegment>();
		const segments: EventCalendarSegment[] = [];
		for (const day of days) {
			for (const segment of index.byDay.get(getDayKey(day, timeZone))?.allDay ?? []) {
				if (!seen.has(segment)) {
					seen.add(segment);
					segments.push(segment);
				}
			}
		}
		return packWeekRowLanes(segments, 0, firstDay, timeZone, span);
	}, [days, index, timeZone, firstDay, span]);
	const laneCount = bars.reduce((max: number, bar: EventCalendarSegment): number => Math.max(max, (bar.lane ?? 0) + 1), 0);
	const ghostSpan = drag?.proposedDayGranular === true ? rangeColumnSpan({ start: drag.proposedStart, end: drag.proposedEnd }, firstDay, span, timeZone) : null;
	const ghostPosition = ghostSpan === null ? null : gridPosition(offsets, ghostSpan.colStart, ghostSpan.colSpan);
	const ghostStyle = React.useMemo(
		(): React.CSSProperties | undefined =>
			ghostPosition === null || drag === null
				? undefined
				: {
						...getEventToneStyle(drag.occurrence.event.color),
						gridColumn: `${String(ghostPosition.column + GRID_LINE_OFFSET)} / span ${String(ghostPosition.span)}`,
						gridRow: GRID_LINE_OFFSET,
						height: "var(--ec-month-bar-h, 1.5rem)",
					},
		[ghostPosition, drag],
	);
	return (
		<div className="relative grid min-w-0 flex-1" style={columnsStyle}>
			{days.map((day: Date): React.JSX.Element => (
				<EventCalendarAllDayCell key={day.getTime()} day={day} laneCount={laneCount} />
			))}
			<div className="pointer-events-none absolute inset-0 grid content-start pt-1" style={columnsStyle}>
				{bars.map((bar: EventCalendarSegment): React.JSX.Element | null => {
					const position = gridPosition(offsets, bar.colStart ?? 0, bar.colSpan ?? 1);
					return position === null ? null : <AllDayBar key={bar.occurrence.key} bar={bar} column={position.column} span={position.span} />;
				})}
				{ghostStyle === undefined || drag === null ? null : (
					<div
						aria-hidden
						data-slot="event-calendar-drag-ghost"
						data-kind={drag.kind}
						data-drop-invalid={drag.valid ? undefined : ""}
						className={cn("mx-1", EVENT_CALENDAR_GHOST.move, drag.valid ? undefined : EVENT_CALENDAR_GHOST.invalid, viewConfig.classNames?.dragGhost)}
						style={ghostStyle}
					/>
				)}
			</div>
		</div>
	);
}

interface AllDayBarProps {
	readonly bar: EventCalendarSegment;
	readonly column: number;
	readonly span: number;
}

const AllDayBar = React.memo(function AllDayBar({ bar, column, span }: AllDayBarProps): React.JSX.Element {
	const style = React.useMemo(
		(): React.CSSProperties => ({
			gridColumn: `${String(column + GRID_LINE_OFFSET)} / span ${String(span)}`,
			gridRow: (bar.lane ?? 0) + GRID_LINE_OFFSET,
			height: "var(--ec-month-bar-h, 1.5rem)",
		}),
		[column, span, bar.lane],
	);
	return (
		<div className="pointer-events-auto min-w-0 px-1 pb-0.5" style={style}>
			<EventCalendarEvent segment={bar} />
		</div>
	);
});

interface DayHeaderProps {
	readonly day: Date;
	readonly view: CalendarView;
}

const EventCalendarDayHeader = React.memo(function EventCalendarDayHeader({ day, view }: DayHeaderProps): React.JSX.Element {
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { isToday } = useEventCalendarDay(day);
	const { timeZone, locale, i18n } = settings;
	const custom = viewConfig.renderDayHeader?.({ day, view, isToday });
	return (
		<div
			role="columnheader"
			data-slot="event-calendar-day-header"
			data-today={isToday ? "" : undefined}
			className={cn(
				"min-w-0 truncate border-e border-border px-2 py-1.5 font-medium last:border-e-0 data-today:text-primary",
				isToday ? viewConfig.todayClassName : undefined,
			)}>
			{custom ?? format(toZoned(day, timeZone), i18n.formats.timeGridDayHeader, locale === undefined ? {} : { locale })}
		</div>
	);
});

export type EventCalendarTimeGridView = Extract<CalendarView, "week" | "day" | "days">;

export interface EventCalendarTimeGridProps extends React.ComponentPropsWithoutRef<"div"> {
	readonly view: EventCalendarTimeGridView;
	readonly dayStartHour?: number;
	readonly dayEndHour?: number;
	readonly showAllDay?: boolean;
	/** Gutter/gridline interval in minutes; defaults to the interval view config. */
	readonly interval?: number;
}

/** Hour slots of a day, in minutes from the zoned midnight. */
export function useTimeSlots(startHour: number, endHour: number, interval: number): readonly number[] {
	return React.useMemo((): readonly number[] => {
		const slots: number[] = [];
		for (let minutes = startHour * MINUTES_PER_HOUR; minutes < endHour * MINUTES_PER_HOUR; minutes += interval) {
			slots.push(minutes);
		}
		return slots;
	}, [startHour, endHour, interval]);
}

/** The shared week / day / N-days time grid. */
export const EventCalendarTimeGrid = React.forwardRef<HTMLDivElement, EventCalendarTimeGridProps>(function EventCalendarTimeGrid(
	{ view, dayStartHour, dayEndHour, showAllDay = true, interval: intervalProp, className, onKeyDown, ...props },
	forwardedRef,
): React.JSX.Element {
	const { settings, state } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { effective } = useEventCalendarViewSettings();
	const { timeZone, weekendDays, i18n, locale } = settings;
	const startHour = dayStartHour ?? settings.dayStartHour;
	const endHour = dayEndHour ?? settings.dayEndHour;
	const interval = clampInterval(intervalProp ?? viewConfig.interval);
	const { visibleRange } = state;
	const viewContext = React.useMemo((): EventCalendarViewContextValue => ({ view }), [view]);

	const days = React.useMemo((): readonly Date[] => {
		const all = getVisibleDays(visibleRange, timeZone);
		if (effective.weekends || view === "day") {
			return all;
		}
		const workdays = all.filter((day: Date): boolean => !isWeekendDay(day, timeZone, weekendDays));
		// A short window landing entirely on the weekend would otherwise render no columns.
		return workdays.length > 0 ? workdays : all;
	}, [visibleRange, timeZone, weekendDays, effective.weekends, view]);
	const columns = React.useMemo((): readonly TimeGridColumn[] => days.map((day: Date): TimeGridColumn => ({ key: timeGridColumnKey(day, timeZone), day })), [days, timeZone]);
	const slots = useTimeSlots(startHour, endHour, interval);
	const bounds = React.useMemo(() => ({ startMin: startHour * MINUTES_PER_HOUR, endMin: endHour * MINUTES_PER_HOUR }), [startHour, endHour]);
	const keyboard = useTimeGridKeyboard(columns, bounds, view);
	const scrollRef = React.useRef<HTMLDivElement | null>(null);
	useInitialScroll(scrollRef, startHour, interval);

	const columnsStyle = React.useMemo(
		(): React.CSSProperties => ({ gridTemplateColumns: `repeat(${String(days.length)}, minmax(var(--ec-day-col-min, 0px), 1fr))` }),
		[days.length],
	);
	const rootStyle = React.useMemo((): React.CSSProperties => ({ ...TRACK_STYLE, ...props.style }), [props.style]);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (!event.defaultPrevented) {
				keyboard.onKeyDown(event);
			}
		},
		[onKeyDown, keyboard],
	);
	const firstDay = days.at(0);
	const lastDay = days.at(-1);
	const ariaLabel =
		firstDay === undefined || lastDay === undefined
			? undefined
			: i18n.functions.formatDayRange({ start: toZoned(firstDay, timeZone), end: toZoned(new Date(lastDay.getTime() + 1), timeZone) }, { locale });

	return (
		<EventCalendarViewContext.Provider value={viewContext}>
			<div
				ref={forwardedRef}
				role="grid"
				tabIndex={-1}
				aria-label={ariaLabel}
				aria-readonly
				data-slot="event-calendar-time-grid"
				data-view={view}
				className={cn("flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border", viewConfig.classNames?.timeGrid, className)}
				onKeyDown={handleKeyDown}
				{...props}
				style={rootStyle}>
				<div role="row" className={cn("flex border-b border-border", viewConfig.classNames?.timeGridHeader)}>
					<div aria-hidden className="w-(--ec-gutter-width,4.5rem) shrink-0 border-e border-border" />
					<div className="grid min-w-0 flex-1" style={columnsStyle}>
						{days.map((day: Date): React.JSX.Element => (
							<EventCalendarDayHeader key={day.getTime()} day={day} view={view} />
						))}
					</div>
				</div>
				{showAllDay ? (
					<div role="row" data-slot="event-calendar-all-day-section" className={cn("flex border-b border-border", viewConfig.classNames?.allDaySection)}>
						<div
							className={cn(
								"flex w-(--ec-gutter-width,4.5rem) shrink-0 justify-end border-e border-border px-2 pt-1.5 text-muted-foreground",
								viewConfig.classNames?.allDayLabel,
							)}>
							{i18n.labels.allDay}
						</div>
						<AllDayBars days={days} columnsStyle={columnsStyle} />
					</div>
				) : null}
				<div ref={scrollRef} className="min-h-0 flex-1">
					<ScrollArea className="h-full">
						<div role="row" className="relative flex">
							<EventCalendarTimeGutter days={days} slots={slots} startHour={startHour} interval={interval} />
							<div className="grid min-w-0 flex-1" style={columnsStyle}>
								{columns.map((column: TimeGridColumn): React.JSX.Element => (
									<EventCalendarDayColumn
										key={column.key}
										day={column.day}
										columnKey={column.key}
										startHour={startHour}
										endHour={endHour}
										interval={interval}
										tabbable={column.key === keyboard.focusedKey}
										cursorMin={keyboard.cursorMin}
										onColumnFocus={keyboard.onColumnFocus}
									/>
								))}
							</div>
							{effective.nowIndicator ? <EventCalendarNowIndicator days={days} startHour={startHour} endHour={endHour} /> : null}
						</div>
					</ScrollArea>
				</div>
			</div>
		</EventCalendarViewContext.Provider>
	);
});

export type EventCalendarTimeGridViewProps = Omit<EventCalendarTimeGridProps, "view">;

export const EventCalendarWeekView = React.forwardRef<HTMLDivElement, EventCalendarTimeGridViewProps>(function EventCalendarWeekView(props, forwardedRef): React.JSX.Element {
	return <EventCalendarTimeGrid ref={forwardedRef} view="week" {...props} />;
});

export const EventCalendarDayView = React.forwardRef<HTMLDivElement, EventCalendarTimeGridViewProps>(function EventCalendarDayView(props, forwardedRef): React.JSX.Element {
	return <EventCalendarTimeGrid ref={forwardedRef} view="day" {...props} />;
});

export const EventCalendarDaysView = React.forwardRef<HTMLDivElement, EventCalendarTimeGridViewProps>(function EventCalendarDaysView(props, forwardedRef): React.JSX.Element {
	return <EventCalendarTimeGrid ref={forwardedRef} view="days" {...props} />;
});
