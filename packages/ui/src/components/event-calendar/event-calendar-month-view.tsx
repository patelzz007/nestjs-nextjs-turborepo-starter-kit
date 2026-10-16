"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-month-view.json):
// the ARIA-grid month view — week rows, day cells, continuous multi-day bars,
// event chips and "+N more" overflow. `EventCalendarMonthView` (with its
// `maxEventsPerCell` prop) and `EventCalendarMoreIndicator` keep ReUI's names.
// Deviations:
// - Keyboard navigation (ReUI had none): the grid is one tab stop with a
//   roving focus — Arrow keys move a day / a week, Home/End jump to the row's
//   ends, PageUp/PageDown change month, Enter/Space fire `onSlotClick` for the
//   focused day (the create flow). Leaving the visible range navigates.
// - `maxEventsPerCell` is a number (ReUI's `"auto"` measured cell heights at
//   runtime); the default is 3.
// - The drag ghost is always a day-span bar in the row overlay (ReUI drew an
//   inline placeholder for single-day timed moves) and the drag-create draft is
//   a dashed span with the range readout on its first day.
// - Cells, rows and bars are memoized components with memoized styles, so a
//   drag repaints only the ghost layer of each row.
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { addMonths, format, getWeek } from "date-fns";
import { PlusIcon } from "lucide-react";
import * as React from "react";

import {
	EventCalendarViewContext,
	useEventCalendar,
	useEventCalendarDay,
	useEventCalendarDrag,
	useEventCalendarViewConfig,
	useEventCalendarViewSettings,
	useEventCalendarWeek,
	type EventCalendarViewContextValue,
} from "./event-calendar";
import { useEventCalendarGestures } from "./event-calendar-dnd";
import { EVENT_CALENDAR_GHOST, EVENT_CALENDAR_SLOT_DRAFT, EventCalendarEvent, getEventToneStyle } from "./event-calendar-event";
import {
	addZonedDays,
	chunkWeeks,
	dayOffsets,
	DAYS_PER_WEEK,
	getDayKey,
	getVisibleDays,
	gridPosition,
	isWeekendDay,
	rangeColumnSpan,
	resolveOffDay,
	toZoned,
	zonedStartOfDay,
} from "./event-calendar-lib";
import type { EventCalendarOccurrence, EventCalendarSegment } from "./event-calendar-types";

const MONTH_VIEW_CONTEXT: EventCalendarViewContextValue = { view: "month" };
const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();
const DEFAULT_OFF_DAY_CLASS = "bg-muted/40";
/** 1-based CSS grid lines. */
const GRID_LINE_OFFSET = 1;

export const eventCalendarMonthCellVariants = cva(
	"group/ec-cell relative flex min-h-0 min-w-0 flex-col overflow-hidden outline-none focus-visible:z-sticky focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
	{
		variants: {
			variant: {
				default: "",
				outside: "text-muted-foreground",
				hidden: "invisible",
			},
			size: {
				default: "",
			},
			state: {
				default: "",
				today: "bg-primary/5",
				draft: "bg-primary/10",
			},
		},
		defaultVariants: { variant: "default", size: "default", state: "default" },
	},
);

export interface EventCalendarMonthViewProps extends React.ComponentPropsWithoutRef<"div"> {
	/** Event rows a cell shows before "+N more"; defaults to the view config. */
	readonly maxEventsPerCell?: number;
}

interface MonthLayout {
	readonly weeks: readonly (readonly Date[])[];
	readonly days: readonly Date[];
	readonly columnCount: number;
}

function useMonthLayout(): MonthLayout {
	const { settings, state } = useEventCalendar();
	const { effective } = useEventCalendarViewSettings();
	const { timeZone, weekendDays } = settings;
	const { visibleRange } = state;
	return React.useMemo((): MonthLayout => {
		const rows = chunkWeeks(getVisibleDays(visibleRange, timeZone));
		const weeks = effective.weekends ? rows : rows.map((row: Date[]): Date[] => row.filter((day: Date): boolean => !isWeekendDay(day, timeZone, weekendDays)));
		const columnCount = weeks.at(0)?.length ?? DAYS_PER_WEEK;
		return { weeks, days: weeks.flat(), columnCount };
	}, [visibleRange, timeZone, weekendDays, effective.weekends]);
}

/** The day the roving focus lands on after `key` (or null when the key is not a navigation key). */
function nextFocusDay(key: string, day: Date, layout: MonthLayout, timeZone: string): Date | null {
	const index = layout.days.findIndex((candidate: Date): boolean => candidate.getTime() === day.getTime());
	const column = index % layout.columnCount;
	const step = (delta: number): Date => layout.days.at(index + delta) ?? addZonedDays(day, delta, timeZone);
	switch (key) {
		case "ArrowLeft":
			return index - 1 < 0 ? addZonedDays(day, -1, timeZone) : step(-1);
		case "ArrowRight":
			return index + 1 >= layout.days.length ? addZonedDays(day, 1, timeZone) : step(1);
		case "ArrowUp":
			return index - layout.columnCount < 0 ? addZonedDays(day, -DAYS_PER_WEEK, timeZone) : step(-layout.columnCount);
		case "ArrowDown":
			return index + layout.columnCount >= layout.days.length ? addZonedDays(day, DAYS_PER_WEEK, timeZone) : step(layout.columnCount);
		case "Home":
			return step(-column);
		case "End":
			return step(layout.columnCount - 1 - column);
		default:
			return null;
	}
}

/** ARIA-grid month view with week rows, day cells, event chips and overflow counts. */
export const EventCalendarMonthView = React.forwardRef<HTMLDivElement, EventCalendarMonthViewProps>(function EventCalendarMonthView(
	{ className, maxEventsPerCell, onKeyDown, ...props },
	forwardedRef,
): React.JSX.Element {
	const { settings, state, api, internals } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { effective } = useEventCalendarViewSettings();
	const layout = useMonthLayout();
	const { timeZone, locale, i18n } = settings;
	const cap = Math.max(1, maxEventsPerCell ?? viewConfig.maxEventsPerCell);

	const anchorKey = getDayKey(state.date, timeZone);
	const [focusedKey, setFocusedKey] = React.useState<string | null>(null);
	const visibleKeys = React.useMemo((): readonly string[] => layout.days.map((day: Date): string => getDayKey(day, timeZone)), [layout.days, timeZone]);
	const rovingKey = [focusedKey, anchorKey].find((key: string | null): key is string => key !== null && visibleKeys.includes(key)) ?? visibleKeys.at(0) ?? anchorKey;

	const gridRef = React.useRef<HTMLDivElement | null>(null);
	const pendingFocusRef = React.useRef<string | null>(null);
	React.useEffect((): void => {
		const key = pendingFocusRef.current;
		if (key === null) {
			return;
		}
		const cell = gridRef.current?.querySelector<HTMLElement>(`[data-ec-day-key="${key}"]`);
		if (cell !== null && cell !== undefined) {
			pendingFocusRef.current = null;
			cell.focus();
		}
	});

	const setRefs = React.useCallback(
		(node: HTMLDivElement | null): void => {
			gridRef.current = node;
			assignRef(forwardedRef, node);
		},
		[forwardedRef],
	);

	const focusDay = React.useCallback(
		(day: Date): void => {
			const key = getDayKey(day, timeZone);
			setFocusedKey(key);
			pendingFocusRef.current = key;
			if (!visibleKeys.includes(key)) {
				api.goTo(day);
			}
		},
		[timeZone, visibleKeys, api, setFocusedKey],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || !(event.target instanceof HTMLElement) || event.target.dataset.slot !== "event-calendar-month-cell") {
				return;
			}
			const dayMs = Number(event.target.dataset.ecDay);
			const day = new Date(dayMs);
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				internals.clickSlot({ date: day, allDay: true, view: "month" }, event);
				return;
			}
			if (event.key === "PageUp" || event.key === "PageDown") {
				event.preventDefault();
				focusDay(zonedStartOfDay(addMonths(toZoned(day, timeZone), event.key === "PageUp" ? -1 : 1), timeZone));
				return;
			}
			const next = nextFocusDay(event.key, day, layout, timeZone);
			if (next !== null) {
				event.preventDefault();
				focusDay(next);
			}
		},
		[onKeyDown, internals, timeZone, layout, focusDay],
	);

	const handleCellFocus = React.useCallback(
		(key: string): void => {
			setFocusedKey(key);
		},
		[setFocusedKey],
	);

	const gridTemplateColumns = `${effective.weekNumbers ? "var(--ec-week-number-w, 2.75rem) " : ""}repeat(${String(layout.columnCount)}, minmax(0, 1fr))`;
	const columnsStyle = React.useMemo((): React.CSSProperties => ({ gridTemplateColumns }), [gridTemplateColumns]);
	const rowsStyle = React.useMemo(
		(): React.CSSProperties => ({ gridTemplateRows: `repeat(${String(layout.weeks.length)}, minmax(var(--ec-month-row-min-h, 6rem), 1fr))` }),
		[layout.weeks.length],
	);
	const title = i18n.functions.formatTitle("month", {
		date: toZoned(state.date, timeZone),
		activeRange: { start: toZoned(state.activeRange.start, timeZone), end: toZoned(state.activeRange.end, timeZone) },
		visibleRange: state.visibleRange,
		locale,
	});
	const headerDays = layout.weeks.at(0) ?? [];

	return (
		<EventCalendarViewContext.Provider value={MONTH_VIEW_CONTEXT}>
			<div
				ref={setRefs}
				role="grid"
				tabIndex={-1}
				aria-label={title}
				aria-readonly
				data-slot="event-calendar-month-view"
				data-view="month"
				className={cn("flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border", viewConfig.classNames?.monthView, className)}
				onKeyDown={handleKeyDown}
				{...props}>
				<div
					role="row"
					data-slot="event-calendar-month-header"
					className={cn("@container grid border-b border-border", viewConfig.classNames?.monthHeader)}
					style={columnsStyle}>
					{effective.weekNumbers ? <div role="columnheader" aria-hidden className={cn("border-e border-border px-2 py-1.5", viewConfig.classNames?.weekNumber)} /> : null}
					{headerDays.map((day: Date): React.JSX.Element => (
						<EventCalendarMonthDayHeader key={day.getTime()} day={day} />
					))}
				</div>
				<div data-slot="event-calendar-month-body" className="grid min-h-0 flex-1" style={rowsStyle}>
					{layout.weeks.map((week: readonly Date[]): React.JSX.Element => (
						<EventCalendarMonthWeek
							key={week.at(0)?.getTime() ?? 0}
							week={week}
							columnsStyle={columnsStyle}
							showWeekNumber={effective.weekNumbers}
							cap={cap}
							rovingKey={rovingKey}
							onCellFocus={handleCellFocus}
						/>
					))}
				</div>
			</div>
		</EventCalendarViewContext.Provider>
	);
});

const EventCalendarMonthDayHeader = React.memo(function EventCalendarMonthDayHeader({ day }: { readonly day: Date }): React.JSX.Element {
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { isToday } = useEventCalendarDay(day);
	const { timeZone, locale, i18n } = settings;
	const zoned = toZoned(day, timeZone);
	const options = locale === undefined ? {} : { locale };
	const custom = viewConfig.renderDayHeader?.({ day, view: "month", isToday });
	return (
		<div role="columnheader" className={cn("truncate px-2 py-1.5 font-medium text-muted-foreground", viewConfig.classNames?.monthDayHeader)}>
			{custom ?? (
				<>
					<span className="@max-[36rem]:hidden">{format(zoned, i18n.formats.monthDayHeader, options)}</span>
					<span className="hidden @max-[36rem]:inline">{format(zoned, i18n.formats.monthDayHeaderNarrow, options)}</span>
				</>
			)}
		</div>
	);
});

interface MonthWeekProps {
	readonly week: readonly Date[];
	readonly columnsStyle: React.CSSProperties;
	readonly showWeekNumber: boolean;
	readonly cap: number;
	readonly rovingKey: string;
	readonly onCellFocus: (key: string) => void;
}

function coversOffset(bar: EventCalendarSegment, offset: number): boolean {
	const colStart = bar.colStart ?? 0;
	return colStart <= offset && offset < colStart + (bar.colSpan ?? 1);
}

/**
 * One month week row. Multi-day / all-day events render as CONTINUOUS bars in
 * an overlay grid spanning day columns and stacked by lane; single-day timed
 * events render inside each cell below the bar lanes.
 */
const EventCalendarMonthWeek = React.memo(function EventCalendarMonthWeek({
	week,
	columnsStyle,
	showWeekNumber,
	cap,
	rovingKey,
	onCellFocus,
}: MonthWeekProps): React.JSX.Element {
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const firstDay = week.at(0) ?? new Date(0);
	const { bars, rowStart } = useEventCalendarWeek(firstDay);
	const { timeZone, locale, weekStartsOn, i18n } = settings;
	const rowStartDay = rowStart ?? firstDay;

	const offsets = React.useMemo((): readonly number[] => dayOffsets(week, rowStartDay, timeZone), [week, timeZone, rowStartDay]);
	const visibleBars = React.useMemo((): readonly EventCalendarSegment[] => bars.filter((bar: EventCalendarSegment): boolean => (bar.lane ?? 0) < cap), [bars, cap]);
	const hiddenKeysByColumn = React.useMemo(
		(): readonly ReadonlySet<string>[] =>
			offsets.map(
				(offset: number): ReadonlySet<string> =>
					new Set(
						bars
							.filter((bar: EventCalendarSegment): boolean => (bar.lane ?? 0) >= cap && coversOffset(bar, offset))
							.map((bar: EventCalendarSegment): string => bar.occurrence.key),
					),
			),
		[offsets, bars, cap],
	);
	const reservedLanes = React.useMemo(
		(): readonly number[] =>
			offsets.map((offset: number): number =>
				visibleBars.reduce((max: number, bar: EventCalendarSegment): number => (coversOffset(bar, offset) ? Math.max(max, (bar.lane ?? 0) + 1) : max), 0),
			),
		[offsets, visibleBars],
	);
	const columnOffset = showWeekNumber ? 1 : 0;
	const weekNumber = getWeek(toZoned(firstDay, timeZone), locale === undefined ? { weekStartsOn } : { locale, weekStartsOn });

	return (
		<div
			role="row"
			data-slot="event-calendar-month-row"
			className={cn("relative grid min-h-0 border-b border-border last:border-b-0", viewConfig.classNames?.monthRow)}
			style={columnsStyle}>
			{showWeekNumber ? (
				<div
					role="rowheader"
					data-slot="event-calendar-week-number"
					className={cn("border-e border-border px-2 pt-1 text-muted-foreground tabular-nums", viewConfig.classNames?.weekNumber)}>
					{i18n.labels.week(weekNumber)}
				</div>
			) : null}
			{week.map((day: Date, column: number): React.JSX.Element => (
				<EventCalendarMonthCell
					key={day.getTime()}
					day={day}
					cap={cap}
					reservedLanes={reservedLanes.at(column) ?? 0}
					hiddenBarKeys={hiddenKeysByColumn.at(column) ?? EMPTY_KEYS}
					isLast={column === week.length - 1}
					tabbable={getDayKey(day, timeZone) === rovingKey}
					onCellFocus={onCellFocus}
				/>
			))}
			<div data-slot="event-calendar-month-bar-overlay" className="pointer-events-none absolute inset-x-0 top-0 z-sticky grid pt-1.5" style={columnsStyle}>
				{visibleBars.map((bar: EventCalendarSegment): React.JSX.Element | null => {
					const position = gridPosition(offsets, bar.colStart ?? 0, bar.colSpan ?? 1);
					return position === null ? null : <EventCalendarMonthBar key={bar.occurrence.key} bar={bar} column={columnOffset + position.column} span={position.span} />;
				})}
				<EventCalendarMonthWeekGhost
					week={week}
					offsets={offsets}
					rowStart={rowStartDay}
					columnOffset={columnOffset}
					laneCount={Math.min(cap, visibleBars.length > 0 ? maxLane(visibleBars) : 0)}
				/>
			</div>
		</div>
	);
});

function maxLane(bars: readonly EventCalendarSegment[]): number {
	return bars.reduce((max: number, bar: EventCalendarSegment): number => Math.max(max, (bar.lane ?? 0) + 1), 0);
}

interface MonthBarProps {
	readonly bar: EventCalendarSegment;
	readonly column: number;
	readonly span: number;
}

const EventCalendarMonthBar = React.memo(function EventCalendarMonthBar({ bar, column, span }: MonthBarProps): React.JSX.Element {
	const viewConfig = useEventCalendarViewConfig();
	const style = React.useMemo(
		(): React.CSSProperties => ({
			gridColumn: `${String(column + GRID_LINE_OFFSET)} / span ${String(span)}`,
			gridRow: (bar.lane ?? 0) + GRID_LINE_OFFSET,
			height: "var(--ec-month-bar-h, 1.5rem)",
		}),
		[column, span, bar.lane],
	);
	return (
		<div data-slot="event-calendar-month-bar" className={cn("pointer-events-auto min-w-0 px-1 pb-0.5", viewConfig.classNames?.monthBar)} style={style}>
			<EventCalendarEvent segment={bar} />
		</div>
	);
});

interface MonthWeekGhostProps {
	readonly week: readonly Date[];
	readonly offsets: readonly number[];
	readonly rowStart: Date;
	readonly columnOffset: number;
	readonly laneCount: number;
}

/** The live drag ghost and drag-create draft of one week row — the only part a pointer move repaints. */
function EventCalendarMonthWeekGhost({ week, offsets, rowStart, columnOffset, laneCount }: MonthWeekGhostProps): React.JSX.Element | null {
	const { drag, slotDraft } = useEventCalendarDrag();
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { timeZone, locale, i18n } = settings;
	const dragSpan = drag === null ? null : rangeColumnSpan({ start: drag.proposedStart, end: drag.proposedEnd }, rowStart, DAYS_PER_WEEK, timeZone);
	const dragPosition = dragSpan === null ? null : gridPosition(offsets, dragSpan.colStart, dragSpan.colSpan);
	const draftSpan = slotDraft?.allDay === true ? rangeColumnSpan(slotDraft, rowStart, DAYS_PER_WEEK, timeZone) : null;
	const draftPosition = draftSpan === null ? null : gridPosition(offsets, draftSpan.colStart, draftSpan.colSpan);
	const ghostStyle = React.useMemo(
		(): React.CSSProperties | undefined =>
			dragPosition === null || drag === null
				? undefined
				: {
						...getEventToneStyle(drag.occurrence.event.color),
						gridColumn: `${String(columnOffset + dragPosition.column + GRID_LINE_OFFSET)} / span ${String(dragPosition.span)}`,
						gridRow: GRID_LINE_OFFSET,
						height: "var(--ec-month-bar-h, 1.5rem)",
					},
		[dragPosition, drag, columnOffset],
	);
	const draftStyle = React.useMemo(
		(): React.CSSProperties | undefined =>
			draftPosition === null
				? undefined
				: {
						gridColumn: `${String(columnOffset + draftPosition.column + GRID_LINE_OFFSET)} / span ${String(draftPosition.span)}`,
						gridRow: `${String(GRID_LINE_OFFSET)} / span ${String(Math.max(1, laneCount + 1))}`,
					},
		[draftPosition, columnOffset, laneCount],
	);
	if (ghostStyle === undefined && draftStyle === undefined) {
		return null;
	}
	const draftStartsHere = slotDraft !== null && draftSpan !== null && zonedStartOfDay(slotDraft.start, timeZone).getTime() >= zonedStartOfDay(rowStart, timeZone).getTime();
	const firstVisible = week.at(0);
	return (
		<>
			{ghostStyle === undefined || drag === null ? null : (
				<div
					aria-hidden
					data-slot="event-calendar-drag-ghost"
					data-kind={drag.kind}
					data-drop-invalid={drag.valid ? undefined : ""}
					className={cn(
						"mx-1",
						drag.kind === "move" ? EVENT_CALENDAR_GHOST.move : EVENT_CALENDAR_GHOST.resize,
						drag.valid ? undefined : EVENT_CALENDAR_GHOST.invalid,
						viewConfig.classNames?.dragGhost,
					)}
					style={ghostStyle}
				/>
			)}
			{draftStyle === undefined || slotDraft === null || firstVisible === undefined ? null : (
				<div
					aria-hidden
					data-slot="event-calendar-slot-draft"
					className={cn("relative mx-0.5", EVENT_CALENDAR_SLOT_DRAFT.box, viewConfig.classNames?.slotDraft)}
					style={draftStyle}>
					{draftStartsHere ? (
						<span className={cn("absolute inset-x-1 bottom-1", EVENT_CALENDAR_SLOT_DRAFT.label)}>
							{i18n.functions.formatDayRange({ start: toZoned(slotDraft.start, timeZone), end: toZoned(slotDraft.end, timeZone) }, { locale })}
						</span>
					) : null}
				</div>
			)}
		</>
	);
}

interface MonthCellProps {
	readonly day: Date;
	readonly cap: number;
	readonly reservedLanes: number;
	/** Occurrence keys of the bars hidden in THIS column (lane >= cap). */
	readonly hiddenBarKeys: ReadonlySet<string>;
	readonly isLast: boolean;
	readonly tabbable: boolean;
	readonly onCellFocus: (key: string) => void;
}

const EventCalendarMonthCell = React.memo(function EventCalendarMonthCell({
	day,
	cap,
	reservedLanes,
	hiddenBarKeys,
	isLast,
	tabbable,
	onCellFocus,
}: MonthCellProps): React.JSX.Element {
	const { settings, internals } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { effective } = useEventCalendarViewSettings();
	const gestures = useEventCalendarGestures();
	const { segments, isToday, isOutside } = useEventCalendarDay(day);
	const { timeZone, locale, i18n, weekendDays, showOutsideDays } = settings;
	const dayStart = zonedStartOfDay(day, timeZone);
	const dayKey = getDayKey(day, timeZone);
	const zoned = toZoned(day, timeZone);
	const options = locale === undefined ? {} : { locale };
	const offDays = effective.offDays ? (viewConfig.offDays === undefined || viewConfig.offDays === false ? true : viewConfig.offDays) : false;
	const isOff = resolveOffDay(day, timeZone, offDays, weekendDays);
	const offClassName =
		(viewConfig.offDays !== undefined && viewConfig.offDays !== true && viewConfig.offDays !== false ? viewConfig.offDays.className : undefined) ?? DEFAULT_OFF_DAY_CLASS;

	const hiddenBars = React.useMemo(
		(): readonly EventCalendarSegment[] => segments.allDay.filter((segment: EventCalendarSegment): boolean => hiddenBarKeys.has(segment.occurrence.key)),
		[segments.allDay, hiddenBarKeys],
	);
	const timedSlots = Math.max(0, cap - reservedLanes);
	const overflowing = hiddenBars.length > 0 || segments.timed.length > timedSlots;
	const shown = overflowing ? Math.max(0, timedSlots - 1) : timedSlots;
	const visibleTimed = React.useMemo((): readonly EventCalendarSegment[] => segments.timed.slice(0, shown), [segments.timed, shown]);
	const overflowSegments = React.useMemo((): readonly EventCalendarSegment[] => [...hiddenBars, ...segments.timed.slice(shown)], [hiddenBars, segments.timed, shown]);
	const spacerStyle = React.useMemo((): React.CSSProperties => ({ height: `calc(${String(reservedLanes)} * var(--ec-month-bar-h, 1.5rem))` }), [reservedLanes]);

	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			if (event.target instanceof Element && event.target.closest("[data-slot=event-calendar-event], [data-slot=event-calendar-more], button") !== null) {
				return;
			}
			gestures.beginCreate(event, dayStart, true);
		},
		[gestures, dayStart],
	);
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>): void => {
			if (internals.wasRecentGesture() || internals.wasRecentChipPress()) {
				return;
			}
			internals.clickSlot({ date: dayStart, allDay: true, view: "month" }, event);
		},
		[internals, dayStart],
	);
	const handleAddClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			event.stopPropagation();
			internals.clickSlot({ date: dayStart, allDay: true, view: "month" }, event);
		},
		[internals, dayStart],
	);
	const handleFocus = React.useCallback(
		(event: React.FocusEvent<HTMLDivElement>): void => {
			if (event.target === event.currentTarget) {
				onCellFocus(dayKey);
			}
		},
		[onCellFocus, dayKey],
	);

	const defaultContent = (
		<>
			<div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-1 pt-1.5">
				{reservedLanes > 0 ? <div aria-hidden className="shrink-0" style={spacerStyle} /> : null}
				{visibleTimed.map((segment: EventCalendarSegment): React.JSX.Element => (
					<EventCalendarEvent key={segment.occurrence.key} segment={segment} className="shrink-0" />
				))}
				{overflowSegments.length > 0 ? <EventCalendarMoreIndicator day={dayStart} count={overflowSegments.length} segments={overflowSegments} /> : null}
			</div>
			<div className="flex items-center justify-end gap-1 px-2 pb-1.5">
				{viewConfig.showDayAddButton ? (
					<button
						type="button"
						tabIndex={-1}
						data-slot="event-calendar-day-add"
						aria-label={i18n.labels.addEvent}
						className={cn(
							"flex size-5 cursor-pointer items-center justify-center rounded-sm bg-primary text-primary-foreground opacity-0 transition-opacity group-focus-within/ec-cell:opacity-100 group-hover/ec-cell:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none",
							viewConfig.classNames?.dayAddButton,
						)}
						onClick={handleAddClick}>
						<PlusIcon aria-hidden className="size-3.5" />
					</button>
				) : null}
				<span
					data-slot="event-calendar-month-day-number"
					className={cn(
						"flex size-5 items-center justify-center rounded-full",
						isOutside ? "text-muted-foreground" : undefined,
						isToday ? "bg-primary font-medium text-primary-foreground" : undefined,
						viewConfig.classNames?.monthDayNumber,
					)}>
					{format(zoned, i18n.formats.monthCellDay, options)}
				</span>
			</div>
		</>
	);

	const content = viewConfig.renderMonthCell?.({ day, segments, isToday, isOutside, overflowCount: overflowSegments.length, defaultContent }) ?? defaultContent;
	const cellVariant = isOutside ? (showOutsideDays ? "outside" : "hidden") : "default";

	return (
		<div
			role="gridcell"
			tabIndex={tabbable ? 0 : -1}
			aria-label={format(zoned, i18n.formats.monthCellAriaLabel, options)}
			aria-current={isToday ? "date" : undefined}
			data-slot="event-calendar-month-cell"
			data-ec-day={dayStart.getTime()}
			data-ec-day-key={dayKey}
			data-today={isToday ? "" : undefined}
			data-outside={isOutside ? "" : undefined}
			data-weekend={isWeekendDay(day, timeZone, weekendDays) ? "" : undefined}
			data-off={isOff ? "" : undefined}
			className={cn(
				eventCalendarMonthCellVariants({ variant: cellVariant, state: isToday ? "today" : "default" }),
				isLast ? undefined : "border-e border-border",
				isOff ? offClassName : undefined,
				isToday ? viewConfig.todayClassName : undefined,
				viewConfig.dayClassName?.(day),
				viewConfig.classNames?.monthCell,
			)}
			onPointerDown={handlePointerDown}
			onClick={handleClick}
			onFocus={handleFocus}>
			{content}
		</div>
	);
});

export interface EventCalendarMoreIndicatorProps extends Omit<React.ComponentPropsWithoutRef<"button">, "children"> {
	readonly day: Date;
	readonly count: number;
	/** The OVERFLOW (hidden) segments for this day — the popover lists only these. */
	readonly segments: readonly EventCalendarSegment[];
}

/**
 * "+N more" trigger opening a popover with the day's hidden events.
 * `onMoreClick` calling `event.preventDefault()` suppresses the built-in popover.
 */
export const EventCalendarMoreIndicator = React.forwardRef<HTMLButtonElement, EventCalendarMoreIndicatorProps>(function EventCalendarMoreIndicator(
	{ day, count, segments, className, onClick, ...props },
	forwardedRef,
): React.JSX.Element {
	const { settings, internals } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { drag } = useEventCalendarDrag();
	const [open, setOpen] = React.useState(false);
	const headerId = React.useId();
	const { timeZone, locale, i18n } = settings;
	const isDragging = drag !== null;

	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			onClick?.(event);
			event.stopPropagation();
			internals.moreClick(
				day,
				segments.map((segment: EventCalendarSegment): EventCalendarOccurrence => segment.occurrence),
				event,
			);
			setOpen(!event.defaultPrevented);
		},
		[onClick, internals, day, segments],
	);
	const handleOpenChange = React.useCallback((next: boolean): void => {
		if (!next) {
			setOpen(false);
		}
	}, []);
	const stopPropagation = React.useCallback((event: React.SyntheticEvent): void => {
		event.stopPropagation();
	}, []);

	const custom = viewConfig.renderMoreIndicator?.({ day, count, segments });
	return (
		<Popover open={open ? !isDragging : false} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				ref={forwardedRef}
				data-slot="event-calendar-more"
				className={cn(
					"shrink-0 cursor-pointer truncate rounded-sm px-1.5 text-start text-muted-foreground hover:text-foreground",
					viewConfig.classNames?.moreIndicator,
					className,
				)}
				onClick={handleClick}
				{...props}>
				{custom ?? i18n.labels.more(count)}
			</PopoverTrigger>
			<PopoverContent
				data-slot="event-calendar-more-popover"
				align={viewConfig.morePopoverAlign}
				aria-labelledby={headerId}
				className={cn("w-64 gap-1 p-2 text-xs", viewConfig.classNames?.morePopover)}
				onClick={stopPropagation}
				onPointerDown={stopPropagation}>
				<div id={headerId} className={cn("px-1 py-1 font-medium text-muted-foreground", viewConfig.classNames?.morePopoverHeader)}>
					{format(toZoned(day, timeZone), i18n.formats.moreDayHeader, locale === undefined ? {} : { locale })}
				</div>
				<ScrollArea className="min-h-0 **:data-[slot=scroll-area-viewport]:max-h-(--ec-more-max-height,16rem)">
					<div className="flex flex-col gap-1 py-1 ps-1 pe-3">
						{segments.map((segment: EventCalendarSegment): React.JSX.Element => (
							<EventCalendarEvent key={segment.occurrence.key} segment={segment} />
						))}
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
});
