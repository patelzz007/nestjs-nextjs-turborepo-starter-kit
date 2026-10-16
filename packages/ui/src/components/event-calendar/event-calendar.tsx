"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar.json): the root
// provider + container of the event calendar, its settings, and the hooks every
// view reads. Exported names, the `EventCalendarProps` option/view-config props
// and the composition contract
//   <EventCalendar><EventCalendarNav/><EventCalendarContent/></EventCalendar>
// match ReUI, with these deliberate deviations (the kit's low-level rules):
// - Fully controlled. `events`, `view` and `date` are required props and every
//   change is reported through its `on…Change` callback; `dayCount`,
//   `selection`, `interactions` and `viewSettings` are optional controlled props
//   (defaults apply when omitted, the callback still fires). ReUI's
//   `default…` uncontrolled props, its subscribable store
//   (`useEventCalendarState`, `calendar`, `useEventCalendarSelector`) and the
//   imperative `apiRef` are dropped — the parent owns the state. The only state
//   the calendar keeps is display state: the live drag/drag-create proposal and
//   the screen-reader announcement.
// - `useEventCalendar()` returns `{ settings, state, index, api, internals }`
//   (ReUI: a store instance with `getState`/`subscribe`). `api` keeps ReUI's
//   method names, each one now emitting the matching change callback.
// - Copy comes from the kit's label system (`UiKitLabels.eventCalendar`); the
//   `i18n` prop overrides it per usage (see event-calendar-i18n.ts).
// - Time is injected: pass `now` for a deterministic clock, otherwise the
//   calendar reads the system clock through a ticking external store (never a
//   render-time `new Date()`).
// - `onEventUpdate` must return its verdict (`true` / `false` / an adjustment);
//   `onMoreClick` suppresses the built-in popover through
//   `event.preventDefault()` instead of returning `false`; `onSlotClick`
//   receives a `SyntheticEvent` because keyboard activation fires it too.
// - The root is a generic function component that takes `ref` as a React 19
//   prop and forwards it to the `forwardRef` host element (`EventCalendarRoot`)
//   — `forwardRef` itself cannot carry a type parameter without a cast.
// - Event colours are tones (`CalendarEvent.color`); sizing/variant/state go
//   through CVA (`eventCalendarVariants`); `render` (Base UI useRender) props,
//   `scrollMode: "page"`, `scrollbars: "native"`, tooltips on events/nav,
//   `maxEventsPerCell: "auto"` measurement and the cursor-carry drag clone are
//   not ported (the in-grid ghost shows the drop target).
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { Locale } from "date-fns";
import * as React from "react";

import { getViewName, mergeEventCalendarI18n, type EventCalendarI18nConfig, type EventCalendarI18nOverrides } from "./event-calendar-i18n";
import {
	addZonedDays,
	buildEventIndex,
	createPriorityEventOrder,
	DEFAULT_WEEKEND_DAYS,
	eventsOverlap,
	getDayKey,
	getRangeKey,
	getViewDateRange,
	stepDate,
	toZoned,
	zonedStartOfDay,
	type EventCalendarDayBucket,
	type EventCalendarEventOrder,
	type EventCalendarGetOccurrences,
	type EventCalendarIndex,
} from "./event-calendar-lib";
import {
	CALENDAR_VIEWS,
	type CalendarEvent,
	type CalendarView,
	type EventCalendarDateRange,
	type EventCalendarDragBlockedInfo,
	type EventCalendarDragState,
	type EventCalendarEventData,
	type EventCalendarInteractions,
	type EventCalendarOccurrence,
	type EventCalendarOffDaysConfig,
	type EventCalendarProposedUpdate,
	type EventCalendarRangeInfo,
	type EventCalendarResource,
	type EventCalendarSegment,
	type EventCalendarSelection,
	type EventCalendarSlotDraft,
	type EventCalendarSlotInfo,
	type EventCalendarUpdateAdjustment,
	type EventCalendarUpdateResult,
	type EventCalendarViewSettings,
	type WeekStartsOn,
} from "./event-calendar-types";

/** The views offered when no `views` prop is passed and no resources are configured. */
export const BASE_VIEWS: readonly CalendarView[] = ["month", "week", "day", "days", "agenda"];
/** Every view, the resource view included (the default when resources are configured). */
export const ALL_VIEWS: readonly CalendarView[] = CALENDAR_VIEWS;

const DEFAULT_INTERACTIONS: EventCalendarInteractions = { drag: true, resize: true, selectSlot: true };
export const EMPTY_SELECTION: EventCalendarSelection = { eventKeys: [], slot: null };
const EMPTY_VIEW_SETTINGS: EventCalendarViewSettings = {};
const EMPTY_RESOURCES: readonly EventCalendarResource[] = [];
const EMPTY_SEGMENTS: readonly EventCalendarSegment[] = [];
const EMPTY_BUCKET: EventCalendarDayBucket = { allDay: EMPTY_SEGMENTS, timed: EMPTY_SEGMENTS };

const DEFAULT_DAY_COUNT = 3;
const DEFAULT_DAY_START_HOUR = 0;
const DEFAULT_DAY_END_HOUR = 24;
const DEFAULT_SLOT_DURATION_MINUTES = 30;
const DEFAULT_SNAP_DURATION_MINUTES = 15;
const DEFAULT_AGENDA_DAY_COUNT = 30;
/** How often the system clock re-renders the now line and "today" marks. */
const DEFAULT_NOW_INDICATOR_INTERVAL_MS = 30_000;
/** A click that lands this soon after a gesture ended belongs to that gesture. */
const GESTURE_CLICK_GUARD_MS = 250;
const CHIP_PRESS_GUARD_MS = 300;

/** Pointer-gesture tuning (activation distances). */
export interface EventCalendarActivationConfig {
	/** Pointer travel before a press on an event becomes a move/resize. */
	readonly moveDistancePx: number;
	/** Pointer travel before a press on empty grid becomes a drag-create. */
	readonly createDistancePx: number;
}

export const EVENT_CALENDAR_ACTIVATION: EventCalendarActivationConfig = { moveDistancePx: 5, createDistancePx: 4 };

/** The calendar's resolved configuration (defaults applied, copy merged). */
export interface EventCalendarSettings {
	readonly timeZone: string;
	readonly locale: Locale | undefined;
	readonly weekStartsOn: WeekStartsOn;
	readonly views: readonly CalendarView[];
	readonly dayStartHour: number;
	readonly dayEndHour: number;
	readonly slotDuration: number;
	readonly snapDuration: number;
	readonly agendaDayCount: number;
	readonly fixedWeeks: boolean;
	readonly showOutsideDays: boolean;
	readonly i18n: EventCalendarI18nConfig;
	readonly resources: readonly EventCalendarResource[];
	readonly weekendDays: readonly number[];
	readonly activation: EventCalendarActivationConfig;
}

/** The calendar state as the parent controls it, plus the derived ranges. */
export interface EventCalendarState {
	readonly view: CalendarView;
	/** Anchor date; navigation steps this, and both ranges derive from it. */
	readonly date: Date;
	/** Read by the "days" view only. */
	readonly dayCount: number;
	/** Full rendered grid incl. outside days — fetch remote data for THIS. */
	readonly visibleRange: EventCalendarDateRange;
	/** The logical period (the month/week itself). */
	readonly activeRange: EventCalendarDateRange;
	readonly events: readonly CalendarEvent[];
	readonly selection: EventCalendarSelection;
	readonly interactions: EventCalendarInteractions;
	readonly loading: boolean;
	readonly viewSettings: EventCalendarViewSettings;
}

export interface EventCalendarSetViewOptions {
	readonly dayCount?: number;
}

export interface EventCalendarSelectEventOptions {
	readonly additive?: boolean;
}

export interface EventCalendarOverlapCandidate extends EventCalendarDateRange {
	readonly excludeEventId?: string;
}

/** Navigation and selection actions; each one emits the matching change callback. */
export interface EventCalendarApi {
	readonly next: () => void;
	readonly prev: () => void;
	readonly today: () => void;
	readonly goTo: (date: Date) => void;
	readonly setView: (view: CalendarView, options?: EventCalendarSetViewOptions) => void;
	readonly setDayCount: (count: number) => void;
	readonly select: (selection: Partial<EventCalendarSelection>) => void;
	readonly selectEvent: (key: string, options?: EventCalendarSelectEventOptions) => void;
	readonly clearSelection: () => void;
	readonly setInteractions: (patch: Partial<EventCalendarInteractions>) => void;
	readonly setViewSettings: (patch: EventCalendarViewSettings) => void;
	readonly getOccurrencesForDay: (day: Date) => EventCalendarOccurrence[];
	readonly findOverlapping: (candidate: EventCalendarOverlapCandidate) => EventCalendarOccurrence[];
	/** TZDate in the calendar's display time zone. */
	readonly toZoned: (date: Date) => Date;
}

/** Plumbing the views and the gesture engine share; not meant for consumers. */
export interface EventCalendarInternals {
	readonly applyProposedUpdate: (update: EventCalendarProposedUpdate) => boolean;
	readonly canDrop: (update: EventCalendarProposedUpdate) => boolean;
	readonly clickEvent: (occurrence: EventCalendarOccurrence, event: React.MouseEvent<HTMLElement>) => void;
	readonly doubleClickEvent: (occurrence: EventCalendarOccurrence, event: React.MouseEvent<HTMLElement>) => void;
	readonly clickSlot: (slot: EventCalendarSlotInfo, event: React.SyntheticEvent<HTMLElement>) => void;
	readonly canSelectSlot: (draft: EventCalendarSlotDraft) => boolean;
	readonly commitSlotDraft: (draft: EventCalendarSlotDraft) => void;
	readonly dragBlocked: (occurrence: EventCalendarOccurrence, info: EventCalendarDragBlockedInfo) => void;
	readonly moreClick: (day: Date, occurrences: readonly EventCalendarOccurrence[], event: React.MouseEvent<HTMLElement>) => void;
	readonly setDrag: (drag: EventCalendarDragState | null) => void;
	readonly setSlotDraft: (draft: EventCalendarSlotDraft | null) => void;
	readonly announce: (message: string) => void;
	readonly markGestureEnd: () => void;
	readonly wasRecentGesture: () => boolean;
	readonly markChipPress: () => void;
	readonly wasRecentChipPress: () => boolean;
	/** Ask the chip of `eventId` to take focus when it (re)mounts — a commit re-keys it. */
	readonly requestFocus: (eventId: string) => void;
	readonly consumeFocusRequest: (eventId: string) => boolean;
	readonly getRootElement: () => HTMLElement | null;
}

export interface EventCalendarContextValue {
	readonly settings: EventCalendarSettings;
	readonly state: EventCalendarState;
	readonly index: EventCalendarIndex;
	readonly api: EventCalendarApi;
	readonly internals: EventCalendarInternals;
}

export interface EventCalendarDragContextValue {
	readonly drag: EventCalendarDragState | null;
	readonly slotDraft: EventCalendarSlotDraft | null;
}

/** Per-element class hooks, `cn()`-merged AFTER the built-in classes. */
export interface EventCalendarClassNames {
	readonly nav?: string;
	readonly toolbar?: string;
	readonly content?: string;
	readonly monthView?: string;
	readonly monthHeader?: string;
	readonly monthDayHeader?: string;
	readonly monthRow?: string;
	readonly monthCell?: string;
	readonly monthDayNumber?: string;
	readonly monthBar?: string;
	readonly weekNumber?: string;
	readonly dayAddButton?: string;
	readonly timeGrid?: string;
	readonly timeGridHeader?: string;
	readonly timeGutter?: string;
	readonly timeGutterLabel?: string;
	readonly dayColumn?: string;
	readonly allDaySection?: string;
	readonly allDayLabel?: string;
	readonly timedChip?: string;
	readonly resourceHeader?: string;
	readonly agendaView?: string;
	readonly agendaDay?: string;
	readonly agendaDayHeader?: string;
	readonly agendaItem?: string;
	readonly event?: string;
	readonly moreIndicator?: string;
	readonly morePopover?: string;
	readonly morePopoverHeader?: string;
	readonly navButton?: string;
	readonly title?: string;
	readonly viewSwitcherContent?: string;
	readonly viewSwitcherLabel?: string;
	readonly viewShortcut?: string;
	readonly datePickerContent?: string;
	readonly dragGhost?: string;
	readonly slotDraft?: string;
	readonly resizeHandle?: string;
	readonly noEvents?: string;
}

export interface EventCalendarRenderEventProps<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly occurrence: EventCalendarOccurrence<TData>;
	readonly segment: EventCalendarSegment<TData>;
	readonly view: CalendarView;
	readonly isDragging: boolean;
	readonly isSelected: boolean;
}

export interface EventCalendarRenderMonthCellProps {
	readonly day: Date;
	readonly segments: EventCalendarDayBucket;
	readonly isToday: boolean;
	readonly isOutside: boolean;
	readonly overflowCount: number;
	readonly defaultContent: React.ReactNode;
}

export interface EventCalendarRenderDayHeaderProps {
	readonly day: Date;
	readonly view: CalendarView;
	readonly isToday: boolean;
}

export interface EventCalendarRenderTimeGutterSlotProps {
	readonly time: Date;
	readonly hour: number;
	readonly minute: number;
}

export interface EventCalendarRenderMoreIndicatorProps {
	readonly day: Date;
	readonly count: number;
	readonly segments: readonly EventCalendarSegment[];
}

export interface EventCalendarRenderDayColumnBackgroundProps {
	readonly day: Date;
	readonly boundsStartMin: number;
	readonly boundsEndMin: number;
	readonly totalMinutes: number;
}

export type EventCalendarNavButtonVariant = "ghost" | "outline" | "secondary" | "default";
export type EventCalendarNavButtonSize = "sm" | "default";
export type EventCalendarMorePopoverAlign = "start" | "center" | "end";

/** View-layer configuration: display props and render overrides. */
export interface EventCalendarViewConfig<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly scrollToHour: number;
	readonly nowIndicator: boolean;
	/** Grid interval in minutes for the time-based views (gutter slots and gridlines). */
	readonly interval: number;
	/** Event rows a month cell shows before rolling the rest into "+N more". */
	readonly maxEventsPerCell: number;
	readonly showWeekNumbers: boolean;
	/** Single-key view shortcuts (labels.viewShortcuts) while focus is inside the calendar. */
	readonly enableShortcuts: boolean;
	/** Custom per-day classes on month cells, day columns and all-day cells. */
	readonly dayClassName?: (day: Date) => string | undefined;
	/** Extra classes for the CURRENT day. */
	readonly todayClassName?: string;
	/** A "+" add affordance on month cells; fires onSlotClick like clicking the day. */
	readonly showDayAddButton: boolean;
	/** Off-day (non-working day) marking; `true` = the weekend. */
	readonly offDays?: boolean | EventCalendarOffDaysConfig;
	readonly classNames?: EventCalendarClassNames;
	/** Swap individual view implementations. */
	readonly components?: Partial<Record<CalendarView, React.ComponentType>>;
	readonly renderEvent?: (props: EventCalendarRenderEventProps<TData>) => React.ReactNode;
	readonly renderAgendaEvent?: (props: EventCalendarRenderEventProps<TData>) => React.ReactNode;
	/** Agenda-only expandable details below an event row. */
	readonly renderAgendaEventDetails?: (occurrence: EventCalendarOccurrence<TData>) => React.ReactNode;
	readonly renderMonthCell?: (props: EventCalendarRenderMonthCellProps) => React.ReactNode;
	readonly renderDayHeader?: (props: EventCalendarRenderDayHeaderProps) => React.ReactNode;
	readonly renderTimeGutterSlot?: (props: EventCalendarRenderTimeGutterSlotProps) => React.ReactNode;
	readonly renderMoreIndicator?: (props: EventCalendarRenderMoreIndicatorProps) => React.ReactNode;
	readonly renderDayColumnBackground?: (props: EventCalendarRenderDayColumnBackgroundProps) => React.ReactNode;
	readonly renderNowIndicator?: (props: { readonly time: Date }) => React.ReactNode;
	readonly renderNoEvents?: () => React.ReactNode;
	readonly renderResourceHeader?: (props: { readonly resource: EventCalendarResource }) => React.ReactNode;
	/** N-day presets offered by the view switcher when the "days" view is enabled. */
	readonly dayCountPresets: readonly number[];
	/** Timed events shorter than this render the compact single-row chip layout. */
	readonly compactEventMinutes: number;
	readonly morePopoverAlign: EventCalendarMorePopoverAlign;
	readonly nowIndicatorInterval: number;
	readonly navButtonVariant: EventCalendarNavButtonVariant;
	readonly navButtonSize: EventCalendarNavButtonSize;
}

export const DEFAULT_VIEW_CONFIG: EventCalendarViewConfig = {
	scrollToHour: 7,
	nowIndicator: true,
	interval: 60,
	maxEventsPerCell: 3,
	showWeekNumbers: false,
	enableShortcuts: true,
	showDayAddButton: false,
	dayCountPresets: [5],
	compactEventMinutes: 45,
	morePopoverAlign: "start",
	nowIndicatorInterval: DEFAULT_NOW_INDICATOR_INTERVAL_MS,
	navButtonVariant: "ghost",
	navButtonSize: "sm",
};

export interface EventCalendarCallbacks<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly onEventClick?: (occurrence: EventCalendarOccurrence<TData>, event: React.MouseEvent<HTMLElement>) => void;
	readonly onEventDoubleClick?: (occurrence: EventCalendarOccurrence<TData>, event: React.MouseEvent<HTMLElement>) => void;
	/** Verdict on a drag / resize / keyboard move: `false` reverts, `true` accepts, an object accepts with an adjustment. */
	readonly onEventUpdate?: (update: EventCalendarProposedUpdate<TData>) => EventCalendarUpdateResult;
	readonly canDropEvent?: (update: EventCalendarProposedUpdate<TData>) => boolean;
	/** A move/resize was attempted on an event that cannot be dragged; fires once per gesture. */
	readonly onDragBlocked?: (occurrence: EventCalendarOccurrence<TData>, info: EventCalendarDragBlockedInfo) => void;
	readonly onSlotClick?: (slot: EventCalendarSlotInfo, event: React.SyntheticEvent<HTMLElement>) => void;
	readonly onSelectSlot?: (slot: EventCalendarSlotDraft) => void;
	readonly canSelectSlot?: (slot: EventCalendarSlotDraft) => boolean;
	readonly onRangeChange?: (info: EventCalendarRangeInfo) => void;
	readonly onViewChange?: (view: CalendarView) => void;
	readonly onDateChange?: (date: Date) => void;
	readonly onDayCountChange?: (count: number) => void;
	readonly onSelectionChange?: (selection: EventCalendarSelection) => void;
	readonly onInteractionsChange?: (interactions: EventCalendarInteractions) => void;
	readonly onViewSettingsChange?: (viewSettings: EventCalendarViewSettings) => void;
	/** The next events array after an accepted update. */
	readonly onEventsChange?: (events: CalendarEvent<TData>[]) => void;
	/** "+N more" clicked; `event.preventDefault()` suppresses the built-in popover. */
	readonly onMoreClick?: (day: Date, occurrences: readonly EventCalendarOccurrence<TData>[], event: React.MouseEvent<HTMLElement>) => void;
}

export interface EventCalendarOptions<TData extends EventCalendarEventData = EventCalendarEventData> extends EventCalendarCallbacks<TData> {
	readonly events: readonly CalendarEvent<TData>[];
	readonly view: CalendarView;
	readonly date: Date;
	readonly dayCount?: number;
	readonly selection?: EventCalendarSelection;
	readonly interactions?: Partial<EventCalendarInteractions>;
	readonly viewSettings?: EventCalendarViewSettings;
	readonly loading?: boolean;
	readonly views?: readonly CalendarView[];
	/** IANA display zone; defaults to the host zone. */
	readonly timeZone?: string;
	readonly locale?: Locale;
	readonly weekStartsOn?: WeekStartsOn;
	readonly dayStartHour?: number;
	readonly dayEndHour?: number;
	/** Length of a clicked/created timed slot, in minutes. */
	readonly slotDuration?: number;
	/** Drag/resize/keyboard granularity, in minutes. */
	readonly snapDuration?: number;
	readonly agendaDayCount?: number;
	readonly fixedWeeks?: boolean;
	readonly showOutsideDays?: boolean;
	readonly i18n?: EventCalendarI18nOverrides;
	/** Bookable resources for the resource view. */
	readonly resources?: readonly EventCalendarResource[];
	readonly getEventPriority?: (event: CalendarEvent<TData>) => number;
	readonly eventOrder?: EventCalendarEventOrder<TData>;
	readonly getOccurrences?: EventCalendarGetOccurrences<TData>;
	/** Weekday numbers (0 = Sunday) the "weekends" toggle hides. @default [0, 6] */
	readonly weekendDays?: readonly number[];
	readonly activation?: Partial<EventCalendarActivationConfig>;
	/** The clock ("today", the now line). Omit to follow the system clock. */
	readonly now?: Date;
}

export const eventCalendarVariants = cva("isolate flex min-h-0 min-w-0 flex-col bg-card text-card-foreground", {
	variants: {
		variant: {
			default: "rounded-lg border border-border shadow-sm",
			plain: "",
		},
		size: {
			sm: "text-xs",
			md: "text-sm",
		},
		state: {
			default: "",
			loading: "",
			disabled: "pointer-events-none opacity-50",
		},
	},
	defaultVariants: { variant: "default", size: "sm", state: "default" },
});

type EventCalendarVariantProps = Omit<VariantProps<typeof eventCalendarVariants>, "state">;

type EventCalendarHostProps = Omit<React.ComponentPropsWithoutRef<"div">, "children" | "defaultValue" | "onChange" | "title" | "color">;

export interface EventCalendarProps<TData extends EventCalendarEventData = EventCalendarEventData>
	extends EventCalendarOptions<TData>, Partial<EventCalendarViewConfig<TData>>, EventCalendarVariantProps, EventCalendarHostProps {
	readonly disabled?: boolean;
	readonly children?: React.ReactNode;
	readonly ref?: React.Ref<HTMLDivElement>;
}

/** What the generic root hands the host after re-typing the TData-carrying callbacks. */
interface EventCalendarRootProps extends Omit<EventCalendarProps, "onEventsChange" | "ref"> {
	/** Commit of an accepted update: the root maps it onto its typed events array. */
	readonly onEventCommit?: (eventId: string, patch: EventCalendarUpdateAdjustment & { readonly resourceId?: string }) => void;
}

const EventCalendarContext = React.createContext<EventCalendarContextValue | null>(null);
const EventCalendarDragContext = React.createContext<EventCalendarDragContextValue>({ drag: null, slotDraft: null });
const EventCalendarViewConfigContext = React.createContext<EventCalendarViewConfig>(DEFAULT_VIEW_CONFIG);
const EventCalendarClockContext = React.createContext<number>(0);
/** Key of the occurrence being dragged — changes only when a drag starts or ends, so chips never re-render per pointer move. */
const EventCalendarDraggingKeyContext = React.createContext<string | null>(null);

export interface EventCalendarViewContextValue {
	readonly view: CalendarView;
}

/** The rendering view of the nearest view component. */
export const EventCalendarViewContext = React.createContext<EventCalendarViewContextValue | null>(null);

export { EventCalendarContext, EventCalendarDragContext, EventCalendarViewConfigContext };

/** System-clock store: one interval per cadence, snapshots quantized so they stay stable between ticks. */
function readClock(intervalMs: number): number {
	return Math.floor(Date.now() / intervalMs) * intervalMs;
}

function subscribeClock(intervalMs: number, listener: () => void): () => void {
	const timer = setInterval(listener, intervalMs);
	window.addEventListener("focus", listener);
	document.addEventListener("visibilitychange", listener);
	return (): void => {
		clearInterval(timer);
		window.removeEventListener("focus", listener);
		document.removeEventListener("visibilitychange", listener);
	};
}

/** The calendar clock in epoch ms: the injected `now`, else the ticking system clock. */
function useCalendarClock(now: Date | undefined, intervalMs: number): number {
	const subscribe = React.useCallback((listener: () => void): (() => void) => (now === undefined ? subscribeClock(intervalMs, listener) : noopUnsubscribe), [now, intervalMs]);
	const getSnapshot = React.useCallback((): number => now?.getTime() ?? readClock(intervalMs), [now, intervalMs]);
	return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function noopUnsubscribe(): void {
	return;
}

function resolveTimeZone(timeZone: string | undefined): string {
	return timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function resolveWeekStartsOn(weekStartsOn: WeekStartsOn | undefined, locale: Locale | undefined): WeekStartsOn {
	// Locale-first default: a de/fr locale gets Monday weeks without also setting weekStartsOn.
	return weekStartsOn ?? locale?.options?.weekStartsOn ?? 0;
}

function isEditableTarget(target: EventTarget): boolean {
	return target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']") !== null);
}

/** The view a single-key shortcut selects, if any. */
function shortcutView(key: string, views: readonly CalendarView[], shortcuts: Readonly<Record<CalendarView, string>>): CalendarView | undefined {
	const normalized = key.toLowerCase();
	return views.find((view: CalendarView): boolean => shortcuts[view].toLowerCase() === normalized);
}

function remapSelectionKey(selection: EventCalendarSelection, oldKey: string, newKey: string): EventCalendarSelection | null {
	if (oldKey === newKey || !selection.eventKeys.includes(oldKey)) {
		return null;
	}
	return { ...selection, eventKeys: selection.eventKeys.map((key: string): string => (key === oldKey ? newKey : key)) };
}

function resolveAdjustment(update: EventCalendarProposedUpdate, result: EventCalendarUpdateResult): Required<EventCalendarUpdateAdjustment> {
	if (result === true || result === false) {
		return { start: update.start, end: update.end, allDay: update.allDay };
	}
	return { start: result.start ?? update.start, end: result.end ?? update.end, allDay: result.allDay ?? update.allDay };
}

interface GestureGuards {
	lastGestureEndedAt: number;
	lastChipPressAt: number;
	pendingFocusEventId: string | null;
}

const EventCalendarRoot = React.forwardRef<HTMLDivElement, EventCalendarRootProps>(function EventCalendarRoot(props, forwardedRef): React.JSX.Element {
	const {
		events,
		view: viewProp,
		date,
		dayCount: dayCountProp,
		selection: selectionProp,
		interactions: interactionsProp,
		viewSettings: viewSettingsProp,
		loading = false,
		disabled = false,
		views: viewsProp,
		timeZone: timeZoneProp,
		locale,
		weekStartsOn: weekStartsOnProp,
		dayStartHour = DEFAULT_DAY_START_HOUR,
		dayEndHour = DEFAULT_DAY_END_HOUR,
		slotDuration = DEFAULT_SLOT_DURATION_MINUTES,
		snapDuration = DEFAULT_SNAP_DURATION_MINUTES,
		agendaDayCount = DEFAULT_AGENDA_DAY_COUNT,
		fixedWeeks = true,
		showOutsideDays = true,
		i18n,
		resources = EMPTY_RESOURCES,
		getEventPriority,
		eventOrder,
		getOccurrences,
		weekendDays = DEFAULT_WEEKEND_DAYS,
		activation,
		now,
		onEventClick,
		onEventDoubleClick,
		onEventUpdate,
		canDropEvent,
		onDragBlocked,
		onSlotClick,
		onSelectSlot,
		canSelectSlot,
		onRangeChange,
		onViewChange,
		onDateChange,
		onDayCountChange,
		onSelectionChange,
		onInteractionsChange,
		onViewSettingsChange,
		onMoreClick,
		onEventCommit,
		scrollToHour = DEFAULT_VIEW_CONFIG.scrollToHour,
		nowIndicator = DEFAULT_VIEW_CONFIG.nowIndicator,
		interval = DEFAULT_VIEW_CONFIG.interval,
		maxEventsPerCell = DEFAULT_VIEW_CONFIG.maxEventsPerCell,
		showWeekNumbers = DEFAULT_VIEW_CONFIG.showWeekNumbers,
		enableShortcuts = DEFAULT_VIEW_CONFIG.enableShortcuts,
		dayClassName,
		todayClassName,
		showDayAddButton = DEFAULT_VIEW_CONFIG.showDayAddButton,
		offDays,
		classNames,
		components,
		renderEvent,
		renderAgendaEvent,
		renderAgendaEventDetails,
		renderMonthCell,
		renderDayHeader,
		renderTimeGutterSlot,
		renderMoreIndicator,
		renderDayColumnBackground,
		renderNowIndicator,
		renderNoEvents,
		renderResourceHeader,
		dayCountPresets = DEFAULT_VIEW_CONFIG.dayCountPresets,
		compactEventMinutes = DEFAULT_VIEW_CONFIG.compactEventMinutes,
		morePopoverAlign = DEFAULT_VIEW_CONFIG.morePopoverAlign,
		nowIndicatorInterval = DEFAULT_VIEW_CONFIG.nowIndicatorInterval,
		navButtonVariant = DEFAULT_VIEW_CONFIG.navButtonVariant,
		navButtonSize = DEFAULT_VIEW_CONFIG.navButtonSize,
		variant,
		size,
		className,
		children,
		...hostProps
	} = props;

	const labels = useUiKitLabels("eventCalendar");
	const timeZone = resolveTimeZone(timeZoneProp);
	const weekStartsOn = resolveWeekStartsOn(weekStartsOnProp, locale);
	const views = viewsProp ?? (resources.length > 0 ? ALL_VIEWS : BASE_VIEWS);
	const nowMs = useCalendarClock(now, nowIndicatorInterval);

	const resolvedI18n = React.useMemo((): EventCalendarI18nConfig => mergeEventCalendarI18n(labels, i18n), [labels, i18n]);
	const resolvedActivation = React.useMemo((): EventCalendarActivationConfig => ({ ...EVENT_CALENDAR_ACTIVATION, ...activation }), [activation]);

	const settings = React.useMemo(
		(): EventCalendarSettings => ({
			timeZone,
			locale,
			weekStartsOn,
			views,
			dayStartHour,
			dayEndHour,
			slotDuration,
			snapDuration,
			agendaDayCount,
			fixedWeeks,
			showOutsideDays,
			i18n: resolvedI18n,
			resources,
			weekendDays,
			activation: resolvedActivation,
		}),
		[
			timeZone,
			locale,
			weekStartsOn,
			views,
			dayStartHour,
			dayEndHour,
			slotDuration,
			snapDuration,
			agendaDayCount,
			fixedWeeks,
			showOutsideDays,
			resolvedI18n,
			resources,
			weekendDays,
			resolvedActivation,
		],
	);

	const view = views.includes(viewProp) ? viewProp : (views.at(0) ?? viewProp);
	const dayCount = Math.max(1, dayCountProp ?? DEFAULT_DAY_COUNT);
	const selection = selectionProp ?? EMPTY_SELECTION;
	const viewSettings = viewSettingsProp ?? EMPTY_VIEW_SETTINGS;
	const interactions = React.useMemo((): EventCalendarInteractions => ({ ...DEFAULT_INTERACTIONS, ...interactionsProp }), [interactionsProp]);
	const dateMs = date.getTime();

	const ranges = React.useMemo(
		() => getViewDateRange(view, new Date(dateMs), { timeZone, weekStartsOn, dayCount, agendaDayCount, fixedWeeks }),
		[view, dateMs, timeZone, weekStartsOn, dayCount, agendaDayCount, fixedWeeks],
	);
	const { visibleRange, activeRange } = ranges;

	const order = React.useMemo(
		(): EventCalendarEventOrder | undefined => eventOrder ?? (getEventPriority === undefined ? undefined : createPriorityEventOrder(getEventPriority)),
		[eventOrder, getEventPriority],
	);
	const index = React.useMemo(
		(): EventCalendarIndex =>
			buildEventIndex(events, visibleRange, {
				timeZone,
				weekStartsOn,
				...(order === undefined ? {} : { eventOrder: order }),
				...(getOccurrences === undefined ? {} : { getOccurrences }),
			}),
		[events, visibleRange, timeZone, weekStartsOn, order, getOccurrences],
	);

	const state = React.useMemo(
		(): EventCalendarState => ({ view, date, dayCount, visibleRange, activeRange, events, selection, interactions, loading, viewSettings }),
		[view, date, dayCount, visibleRange, activeRange, events, selection, interactions, loading, viewSettings],
	);

	const [drag, setDrag] = React.useState<EventCalendarDragState | null>(null);
	const [slotDraft, setSlotDraft] = React.useState<EventCalendarSlotDraft | null>(null);
	const [announcement, setAnnouncement] = React.useState("");
	const rootRef = React.useRef<HTMLDivElement | null>(null);
	const guardsRef = React.useRef<GestureGuards>({ lastGestureEndedAt: 0, lastChipPressAt: 0, pendingFocusEventId: null });

	const setRootRef = React.useCallback(
		(node: HTMLDivElement | null): void => {
			rootRef.current = node;
			assignRef(forwardedRef, node);
		},
		[forwardedRef],
	);

	const stepOptions = React.useMemo(() => ({ timeZone, dayCount, agendaDayCount }), [timeZone, dayCount, agendaDayCount]);

	const api = React.useMemo((): EventCalendarApi => {
		const setSelection = (next: EventCalendarSelection): void => onSelectionChange?.(next);
		return {
			next: (): void => onDateChange?.(stepDate(view, date, 1, stepOptions)),
			prev: (): void => onDateChange?.(stepDate(view, date, -1, stepOptions)),
			today: (): void => onDateChange?.(new Date(nowMs)),
			goTo: (target: Date): void => onDateChange?.(target),
			setView: (next: CalendarView, options?: EventCalendarSetViewOptions): void => {
				if (options?.dayCount !== undefined) {
					onDayCountChange?.(Math.max(1, options.dayCount));
				}
				if (views.includes(next)) {
					onViewChange?.(next);
				}
			},
			setDayCount: (count: number): void => onDayCountChange?.(Math.max(1, count)),
			select: (partial: Partial<EventCalendarSelection>): void => {
				setSelection({ eventKeys: partial.eventKeys ?? selection.eventKeys, slot: partial.slot === undefined ? selection.slot : partial.slot });
			},
			selectEvent: (key: string, options?: EventCalendarSelectEventOptions): void => {
				const additive = options?.additive ?? false;
				const toggled = selection.eventKeys.includes(key) ? selection.eventKeys.filter((existing: string): boolean => existing !== key) : [...selection.eventKeys, key];
				setSelection({ ...selection, eventKeys: additive ? toggled : [key] });
			},
			clearSelection: (): void => {
				setSelection(EMPTY_SELECTION);
			},
			setInteractions: (patch: Partial<EventCalendarInteractions>): void => onInteractionsChange?.({ ...interactions, ...patch }),
			setViewSettings: (patch: EventCalendarViewSettings): void => onViewSettingsChange?.({ ...viewSettings, ...patch }),
			getOccurrencesForDay: (day: Date): EventCalendarOccurrence[] => {
				const bucket = index.byDay.get(getDayKey(day, timeZone)) ?? EMPTY_BUCKET;
				const seen = new Set<string>();
				return [...bucket.allDay, ...bucket.timed]
					.map((segment: EventCalendarSegment): EventCalendarOccurrence => segment.occurrence)
					.filter((occurrence: EventCalendarOccurrence): boolean => {
						if (seen.has(occurrence.key)) {
							return false;
						}
						seen.add(occurrence.key);
						return true;
					});
			},
			findOverlapping: (candidate: EventCalendarOverlapCandidate): EventCalendarOccurrence[] =>
				index.occurrences.filter((occurrence: EventCalendarOccurrence): boolean => occurrence.eventId !== candidate.excludeEventId && eventsOverlap(occurrence, candidate)),
			toZoned: (value: Date): Date => toZoned(value, timeZone),
		};
	}, [
		view,
		date,
		stepOptions,
		nowMs,
		views,
		selection,
		interactions,
		viewSettings,
		index,
		timeZone,
		onDateChange,
		onDayCountChange,
		onViewChange,
		onSelectionChange,
		onInteractionsChange,
		onViewSettingsChange,
	]);

	const internals = React.useMemo((): EventCalendarInternals => {
		const canDrop = (update: EventCalendarProposedUpdate): boolean => canDropEvent?.(update) ?? true;
		return {
			canDrop,
			applyProposedUpdate: (update: EventCalendarProposedUpdate): boolean => {
				const result = onEventUpdate?.(update) ?? true;
				if (result === false) {
					return false;
				}
				const adjusted = resolveAdjustment(update, result);
				const remapped = remapSelectionKey(selection, update.occurrence.key, `${update.event.id}::${adjusted.start.toISOString()}`);
				if (remapped !== null) {
					onSelectionChange?.(remapped);
				}
				onEventCommit?.(update.event.id, update.resourceId === undefined ? adjusted : { ...adjusted, resourceId: update.resourceId });
				return true;
			},
			clickEvent: (occurrence: EventCalendarOccurrence, event: React.MouseEvent<HTMLElement>): void => onEventClick?.(occurrence, event),
			doubleClickEvent: (occurrence: EventCalendarOccurrence, event: React.MouseEvent<HTMLElement>): void => onEventDoubleClick?.(occurrence, event),
			clickSlot: (slot: EventCalendarSlotInfo, event: React.SyntheticEvent<HTMLElement>): void => onSlotClick?.(slot, event),
			canSelectSlot: (draft: EventCalendarSlotDraft): boolean => canSelectSlot?.(draft) ?? true,
			commitSlotDraft: (draft: EventCalendarSlotDraft): void => {
				if (!(canSelectSlot?.(draft) ?? true)) {
					return;
				}
				onSelectSlot?.(draft);
				onSelectionChange?.({ ...selection, slot: { start: draft.start, end: draft.end, allDay: draft.allDay } });
			},
			dragBlocked: (occurrence: EventCalendarOccurrence, info: EventCalendarDragBlockedInfo): void => onDragBlocked?.(occurrence, info),
			moreClick: (day: Date, occurrences: readonly EventCalendarOccurrence[], event: React.MouseEvent<HTMLElement>): void => onMoreClick?.(day, occurrences, event),
			setDrag,
			setSlotDraft,
			announce: setAnnouncement,
			markGestureEnd: (): void => {
				guardsRef.current.lastGestureEndedAt = performance.now();
			},
			wasRecentGesture: (): boolean => performance.now() - guardsRef.current.lastGestureEndedAt < GESTURE_CLICK_GUARD_MS,
			markChipPress: (): void => {
				guardsRef.current.lastChipPressAt = performance.now();
			},
			wasRecentChipPress: (): boolean => performance.now() - guardsRef.current.lastChipPressAt < CHIP_PRESS_GUARD_MS,
			requestFocus: (eventId: string): void => {
				guardsRef.current.pendingFocusEventId = eventId;
			},
			consumeFocusRequest: (eventId: string): boolean => {
				if (guardsRef.current.pendingFocusEventId !== eventId) {
					return false;
				}
				guardsRef.current.pendingFocusEventId = null;
				return true;
			},
			getRootElement: (): HTMLElement | null => rootRef.current,
		};
	}, [
		canDropEvent,
		onEventUpdate,
		selection,
		onSelectionChange,
		onEventCommit,
		onEventClick,
		onEventDoubleClick,
		onSlotClick,
		canSelectSlot,
		onSelectSlot,
		onDragBlocked,
		onMoreClick,
	]);

	const contextValue = React.useMemo((): EventCalendarContextValue => ({ settings, state, index, api, internals }), [settings, state, index, api, internals]);
	const dragValue = React.useMemo((): EventCalendarDragContextValue => ({ drag, slotDraft }), [drag, slotDraft]);

	const viewConfig = React.useMemo(
		(): EventCalendarViewConfig => ({
			scrollToHour,
			nowIndicator,
			interval,
			maxEventsPerCell,
			showWeekNumbers,
			enableShortcuts,
			showDayAddButton,
			dayCountPresets,
			compactEventMinutes,
			morePopoverAlign,
			nowIndicatorInterval,
			navButtonVariant,
			navButtonSize,
			...(dayClassName === undefined ? {} : { dayClassName }),
			...(todayClassName === undefined ? {} : { todayClassName }),
			...(offDays === undefined ? {} : { offDays }),
			...(classNames === undefined ? {} : { classNames }),
			...(components === undefined ? {} : { components }),
			...(renderEvent === undefined ? {} : { renderEvent }),
			...(renderAgendaEvent === undefined ? {} : { renderAgendaEvent }),
			...(renderAgendaEventDetails === undefined ? {} : { renderAgendaEventDetails }),
			...(renderMonthCell === undefined ? {} : { renderMonthCell }),
			...(renderDayHeader === undefined ? {} : { renderDayHeader }),
			...(renderTimeGutterSlot === undefined ? {} : { renderTimeGutterSlot }),
			...(renderMoreIndicator === undefined ? {} : { renderMoreIndicator }),
			...(renderDayColumnBackground === undefined ? {} : { renderDayColumnBackground }),
			...(renderNowIndicator === undefined ? {} : { renderNowIndicator }),
			...(renderNoEvents === undefined ? {} : { renderNoEvents }),
			...(renderResourceHeader === undefined ? {} : { renderResourceHeader }),
		}),
		[
			scrollToHour,
			nowIndicator,
			interval,
			maxEventsPerCell,
			showWeekNumbers,
			enableShortcuts,
			showDayAddButton,
			dayCountPresets,
			compactEventMinutes,
			morePopoverAlign,
			nowIndicatorInterval,
			navButtonVariant,
			navButtonSize,
			dayClassName,
			todayClassName,
			offDays,
			classNames,
			components,
			renderEvent,
			renderAgendaEvent,
			renderAgendaEventDetails,
			renderMonthCell,
			renderDayHeader,
			renderTimeGutterSlot,
			renderMoreIndicator,
			renderDayColumnBackground,
			renderNowIndicator,
			renderNoEvents,
			renderResourceHeader,
		],
	);

	// onRangeChange fires for the initial range and whenever the visible range changes.
	const rangeKey = `${view}:${getRangeKey(visibleRange)}:${timeZone}`;
	const emitRange = React.useEffectEvent((): void => {
		onRangeChange?.({ range: visibleRange, activeRange, view, date, timeZone });
	});
	React.useEffect((): void => {
		emitRange();
	}, [rangeKey]);

	// View shortcuts while focus is inside the calendar. A native listener on the
	// root (not a JSX handler): the root is a layout container, not a widget.
	const handleShortcut = React.useEffectEvent((event: KeyboardEvent): void => {
		if (event.defaultPrevented || !enableShortcuts || event.altKey || event.ctrlKey || event.metaKey || event.target === null || isEditableTarget(event.target)) {
			return;
		}
		const target = shortcutView(event.key, views, resolvedI18n.labels.viewShortcuts);
		if (target !== undefined) {
			event.preventDefault();
			api.setView(target);
		}
	});
	React.useEffect((): (() => void) | undefined => {
		const root = rootRef.current;
		if (root === null) {
			return undefined;
		}
		const listener = (event: KeyboardEvent): void => {
			handleShortcut(event);
		};
		root.addEventListener("keydown", listener);
		return (): void => {
			root.removeEventListener("keydown", listener);
		};
	}, []);

	return (
		<EventCalendarContext.Provider value={contextValue}>
			<EventCalendarDragContext.Provider value={dragValue}>
				<EventCalendarViewConfigContext.Provider value={viewConfig}>
					<EventCalendarClockContext.Provider value={nowMs}>
						<EventCalendarDraggingKeyContext.Provider value={drag?.occurrence.key ?? null}>
							<div
								ref={setRootRef}
								data-slot="event-calendar"
								data-view={view}
								data-loading={loading ? "" : undefined}
								aria-busy={loading}
								aria-disabled={disabled ? true : undefined}
								className={cn(eventCalendarVariants({ variant, size, state: disabled ? "disabled" : loading ? "loading" : "default" }), className)}
								{...hostProps}>
								{children}
								<div data-slot="event-calendar-announcer" aria-live="polite" className="sr-only">
									{announcement}
								</div>
							</div>
						</EventCalendarDraggingKeyContext.Provider>
					</EventCalendarClockContext.Provider>
				</EventCalendarViewConfigContext.Provider>
			</EventCalendarDragContext.Provider>
		</EventCalendarContext.Provider>
	);
});

/** The occurrence with its typed source event, or null when the event left the array. */
function retypeOccurrence<TData extends EventCalendarEventData>(
	occurrence: EventCalendarOccurrence,
	eventsById: ReadonlyMap<string, CalendarEvent<TData>>,
): EventCalendarOccurrence<TData> | null {
	const event = eventsById.get(occurrence.eventId);
	return event === undefined ? null : { ...occurrence, event };
}

function retypeRenderProps<TData extends EventCalendarEventData>(
	props: EventCalendarRenderEventProps,
	eventsById: ReadonlyMap<string, CalendarEvent<TData>>,
): EventCalendarRenderEventProps<TData> | null {
	const occurrence = retypeOccurrence(props.occurrence, eventsById);
	return occurrence === null ? null : { ...props, occurrence, segment: { ...props.segment, occurrence } };
}

function retypeUpdate<TData extends EventCalendarEventData>(
	update: EventCalendarProposedUpdate,
	eventsById: ReadonlyMap<string, CalendarEvent<TData>>,
): EventCalendarProposedUpdate<TData> | null {
	const occurrence = retypeOccurrence(update.occurrence, eventsById);
	return occurrence === null ? null : { ...update, event: occurrence.event, occurrence };
}

/**
 * Root provider + container. Generic over the events' `data` payload: every
 * callback and render prop receives the consumer's own typed events back.
 * Composition: `<EventCalendar><EventCalendarNav/><EventCalendarContent/></EventCalendar>`.
 */
export function EventCalendar<TData extends EventCalendarEventData = EventCalendarEventData>(props: EventCalendarProps<TData>): React.JSX.Element {
	const {
		ref,
		events,
		onEventClick,
		onEventDoubleClick,
		onEventUpdate,
		canDropEvent,
		onDragBlocked,
		onMoreClick,
		onEventsChange,
		getEventPriority,
		eventOrder,
		getOccurrences,
		renderEvent,
		renderAgendaEvent,
		renderAgendaEventDetails,
		...rest
	} = props;
	const eventsById = React.useMemo(
		(): ReadonlyMap<string, CalendarEvent<TData>> => new Map(events.map((event: CalendarEvent<TData>): [string, CalendarEvent<TData>] => [event.id, event])),
		[events],
	);

	const occurrenceHandler = React.useCallback(
		(
			handler: ((occurrence: EventCalendarOccurrence<TData>, event: React.MouseEvent<HTMLElement>) => void) | undefined,
		): ((occurrence: EventCalendarOccurrence, event: React.MouseEvent<HTMLElement>) => void) | undefined =>
			handler === undefined
				? undefined
				: (occurrence: EventCalendarOccurrence, event: React.MouseEvent<HTMLElement>): void => {
						const typed = retypeOccurrence(occurrence, eventsById);
						if (typed !== null) {
							handler(typed, event);
						}
					},
		[eventsById],
	);
	const handleEventClick = React.useMemo(() => occurrenceHandler(onEventClick), [occurrenceHandler, onEventClick]);
	const handleEventDoubleClick = React.useMemo(() => occurrenceHandler(onEventDoubleClick), [occurrenceHandler, onEventDoubleClick]);

	const handleEventUpdate = React.useMemo(
		() =>
			onEventUpdate === undefined
				? undefined
				: (update: EventCalendarProposedUpdate): EventCalendarUpdateResult => {
						const typed = retypeUpdate(update, eventsById);
						return typed === null ? false : onEventUpdate(typed);
					},
		[onEventUpdate, eventsById],
	);
	const handleCanDrop = React.useMemo(
		() =>
			canDropEvent === undefined
				? undefined
				: (update: EventCalendarProposedUpdate): boolean => {
						const typed = retypeUpdate(update, eventsById);
						return typed !== null && canDropEvent(typed);
					},
		[canDropEvent, eventsById],
	);
	const handleDragBlocked = React.useMemo(
		() =>
			onDragBlocked === undefined
				? undefined
				: (occurrence: EventCalendarOccurrence, info: EventCalendarDragBlockedInfo): void => {
						const typed = retypeOccurrence(occurrence, eventsById);
						if (typed !== null) {
							onDragBlocked(typed, info);
						}
					},
		[onDragBlocked, eventsById],
	);
	const handleMoreClick = React.useMemo(
		() =>
			onMoreClick === undefined
				? undefined
				: (day: Date, occurrences: readonly EventCalendarOccurrence[], event: React.MouseEvent<HTMLElement>): void => {
						const typed = occurrences
							.map((occurrence: EventCalendarOccurrence): EventCalendarOccurrence<TData> | null => retypeOccurrence(occurrence, eventsById))
							.filter((occurrence: EventCalendarOccurrence<TData> | null): occurrence is EventCalendarOccurrence<TData> => occurrence !== null);
						onMoreClick(day, typed, event);
					},
		[onMoreClick, eventsById],
	);
	const handleEventCommit = React.useMemo(
		() =>
			onEventsChange === undefined
				? undefined
				: (eventId: string, patch: EventCalendarUpdateAdjustment & { readonly resourceId?: string }): void => {
						onEventsChange(events.map((event: CalendarEvent<TData>): CalendarEvent<TData> => (event.id === eventId ? { ...event, ...patch } : event)));
					},
		[onEventsChange, events],
	);

	const typedEvent = React.useCallback((event: CalendarEvent): CalendarEvent<TData> | undefined => eventsById.get(event.id), [eventsById]);
	const handleEventPriority = React.useMemo(
		() =>
			getEventPriority === undefined
				? undefined
				: (event: CalendarEvent): number => {
						const typed = typedEvent(event);
						return typed === undefined ? 0 : getEventPriority(typed);
					},
		[getEventPriority, typedEvent],
	);
	const handleEventOrder = React.useMemo(
		() =>
			eventOrder === undefined
				? undefined
				: (left: EventCalendarOccurrence, right: EventCalendarOccurrence): number => {
						const typedLeft = retypeOccurrence(left, eventsById);
						const typedRight = retypeOccurrence(right, eventsById);
						return typedLeft === null || typedRight === null ? 0 : eventOrder(typedLeft, typedRight);
					},
		[eventOrder, eventsById],
	);
	const handleGetOccurrences = React.useMemo(
		() =>
			getOccurrences === undefined
				? undefined
				: (event: CalendarEvent, range: EventCalendarDateRange, context: { readonly timeZone: string }): readonly EventCalendarDateRange[] | null => {
						const typed = typedEvent(event);
						return typed === undefined ? null : getOccurrences(typed, range, context);
					},
		[getOccurrences, typedEvent],
	);

	const renderProp = React.useCallback(
		(
			render: ((renderProps: EventCalendarRenderEventProps<TData>) => React.ReactNode) | undefined,
		): ((renderProps: EventCalendarRenderEventProps) => React.ReactNode) | undefined =>
			render === undefined
				? undefined
				: (renderProps: EventCalendarRenderEventProps): React.ReactNode => {
						const typed = retypeRenderProps(renderProps, eventsById);
						return typed === null ? null : render(typed);
					},
		[eventsById],
	);
	const handleRenderEvent = React.useMemo(() => renderProp(renderEvent), [renderProp, renderEvent]);
	const handleRenderAgendaEvent = React.useMemo(() => renderProp(renderAgendaEvent), [renderProp, renderAgendaEvent]);
	const handleRenderAgendaDetails = React.useMemo(
		() =>
			renderAgendaEventDetails === undefined
				? undefined
				: (occurrence: EventCalendarOccurrence): React.ReactNode => {
						const typed = retypeOccurrence(occurrence, eventsById);
						return typed === null ? null : renderAgendaEventDetails(typed);
					},
		[renderAgendaEventDetails, eventsById],
	);

	return (
		<EventCalendarRoot
			ref={ref}
			events={events}
			{...rest}
			{...(handleEventClick === undefined ? {} : { onEventClick: handleEventClick })}
			{...(handleEventDoubleClick === undefined ? {} : { onEventDoubleClick: handleEventDoubleClick })}
			{...(handleEventUpdate === undefined ? {} : { onEventUpdate: handleEventUpdate })}
			{...(handleCanDrop === undefined ? {} : { canDropEvent: handleCanDrop })}
			{...(handleDragBlocked === undefined ? {} : { onDragBlocked: handleDragBlocked })}
			{...(handleMoreClick === undefined ? {} : { onMoreClick: handleMoreClick })}
			{...(handleEventCommit === undefined ? {} : { onEventCommit: handleEventCommit })}
			{...(handleEventPriority === undefined ? {} : { getEventPriority: handleEventPriority })}
			{...(handleEventOrder === undefined ? {} : { eventOrder: handleEventOrder })}
			{...(handleGetOccurrences === undefined ? {} : { getOccurrences: handleGetOccurrences })}
			{...(handleRenderEvent === undefined ? {} : { renderEvent: handleRenderEvent })}
			{...(handleRenderAgendaEvent === undefined ? {} : { renderAgendaEvent: handleRenderAgendaEvent })}
			{...(handleRenderAgendaDetails === undefined ? {} : { renderAgendaEventDetails: handleRenderAgendaDetails })}
		/>
	);
}

export { EventCalendarRoot };

/** The calendar context; throws outside `<EventCalendar>`. */
export function useEventCalendar(): EventCalendarContextValue {
	const context = React.useContext(EventCalendarContext);
	if (context === null) {
		throw new Error("useEventCalendar must be used within <EventCalendar>");
	}
	return context;
}

/** Resolved settings incl. merged copy. */
export function useEventCalendarSettings(): EventCalendarSettings {
	return useEventCalendar().settings;
}

/** Root-level display props + render overrides, for view components. */
export function useEventCalendarViewConfig(): EventCalendarViewConfig {
	return React.useContext(EventCalendarViewConfigContext);
}

/** The live drag / drag-create proposal (display state). */
export function useEventCalendarDrag(): EventCalendarDragContextValue {
	return React.useContext(EventCalendarDragContext);
}

/** Key of the occurrence a gesture is dragging, or null. */
export function useEventCalendarDraggingKey(): string | null {
	return React.useContext(EventCalendarDraggingKeyContext);
}

/** The calendar clock in epoch ms. */
export function useEventCalendarNow(): number {
	return React.useContext(EventCalendarClockContext);
}

/** The rendering view of the nearest view component ("month", "week", ...). */
export function useEventCalendarViewContext(): EventCalendarViewContextValue {
	const context = React.useContext(EventCalendarViewContext);
	if (context === null) {
		throw new Error("useEventCalendarViewContext must be used inside a calendar view");
	}
	return context;
}

export interface UseEventCalendarViewResult {
	readonly view: CalendarView;
	readonly dayCount: number;
	readonly availableViews: readonly CalendarView[];
	readonly viewName: string;
	readonly setView: (view: CalendarView, options?: EventCalendarSetViewOptions) => void;
}

export function useEventCalendarView(): UseEventCalendarViewResult {
	const { state, settings, api } = useEventCalendar();
	return {
		view: state.view,
		dayCount: state.dayCount,
		availableViews: settings.views,
		viewName: getViewName(settings.i18n.viewNames, state.view, state.dayCount),
		setView: api.setView,
	};
}

export interface UseEventCalendarNavigationResult {
	readonly date: Date;
	/** i18n.functions.formatTitle output for the current view. */
	readonly title: string;
	readonly visibleRange: EventCalendarDateRange;
	readonly activeRange: EventCalendarDateRange;
	readonly next: () => void;
	readonly prev: () => void;
	readonly today: () => void;
	readonly goTo: (date: Date) => void;
	/** True when the active period contains now. */
	readonly isToday: boolean;
}

export function useEventCalendarNavigation(): UseEventCalendarNavigationResult {
	const { state, settings, api } = useEventCalendar();
	const nowMs = useEventCalendarNow();
	const { timeZone, locale, i18n } = settings;
	const title = i18n.functions.formatTitle(state.view, {
		date: toZoned(state.date, timeZone),
		activeRange: { start: toZoned(state.activeRange.start, timeZone), end: toZoned(state.activeRange.end, timeZone) },
		visibleRange: state.visibleRange,
		locale,
	});
	return {
		date: state.date,
		title,
		visibleRange: state.visibleRange,
		activeRange: state.activeRange,
		next: api.next,
		prev: api.prev,
		today: api.today,
		goTo: api.goTo,
		isToday: nowMs >= state.activeRange.start.getTime() && nowMs < state.activeRange.end.getTime(),
	};
}

export interface UseEventCalendarSelectionResult {
	readonly selection: EventCalendarSelection;
	readonly select: EventCalendarApi["select"];
	readonly selectEvent: EventCalendarApi["selectEvent"];
	readonly clearSelection: EventCalendarApi["clearSelection"];
}

export function useEventCalendarSelection(): UseEventCalendarSelectionResult {
	const { state, api } = useEventCalendar();
	return { selection: state.selection, select: api.select, selectEvent: api.selectEvent, clearSelection: api.clearSelection };
}

export interface UseEventCalendarInteractionsResult {
	readonly interactions: EventCalendarInteractions;
	readonly setInteractions: EventCalendarApi["setInteractions"];
}

export function useEventCalendarInteractions(): UseEventCalendarInteractionsResult {
	const { state, api } = useEventCalendar();
	return { interactions: state.interactions, setInteractions: api.setInteractions };
}

/** Expanded, sorted occurrences of the visible range (optionally narrowed to `range`). */
export function useEventCalendarOccurrences(range?: EventCalendarDateRange): readonly EventCalendarOccurrence[] {
	const { index } = useEventCalendar();
	const rangeStart = range?.start.getTime();
	const rangeEnd = range?.end.getTime();
	return React.useMemo(
		(): readonly EventCalendarOccurrence[] =>
			rangeStart === undefined || rangeEnd === undefined
				? index.occurrences
				: index.occurrences.filter((occurrence: EventCalendarOccurrence): boolean => eventsOverlap(occurrence, { start: new Date(rangeStart), end: new Date(rangeEnd) })),
		[index, rangeStart, rangeEnd],
	);
}

export interface UseEventCalendarDayResult {
	readonly segments: EventCalendarDayBucket;
	readonly isToday: boolean;
	readonly isOutside: boolean;
}

/** One day's segments and flags. */
export function useEventCalendarDay(day: Date): UseEventCalendarDayResult {
	const { index, settings, state } = useEventCalendar();
	const nowMs = useEventCalendarNow();
	const { timeZone } = settings;
	const dayKey = getDayKey(day, timeZone);
	const dayStartMs = zonedStartOfDay(day, timeZone).getTime();
	return {
		segments: index.byDay.get(dayKey) ?? EMPTY_BUCKET,
		isToday: getDayKey(new Date(nowMs), timeZone) === dayKey,
		isOutside: dayStartMs < state.activeRange.start.getTime() || dayStartMs >= state.activeRange.end.getTime(),
	};
}

export interface UseEventCalendarWeekResult {
	readonly bars: readonly EventCalendarSegment[];
	readonly laneCount: number;
	readonly rowStart: Date | null;
}

/**
 * The laned multi-day/all-day bars of the week row containing `day` (matched
 * by containment, so a weekends-hidden row still resolves).
 */
export function useEventCalendarWeek(day: Date): UseEventCalendarWeekResult {
	const { index, settings } = useEventCalendar();
	const { timeZone } = settings;
	const dayStartMs = zonedStartOfDay(day, timeZone).getTime();
	return React.useMemo((): UseEventCalendarWeekResult => {
		const row = index.weekRows.find((candidate): boolean => {
			const startMs = zonedStartOfDay(candidate.rowStart, timeZone).getTime();
			const endMs = addZonedDays(candidate.rowStart, DAYS_IN_ROW, timeZone).getTime();
			return dayStartMs >= startMs && dayStartMs < endMs;
		});
		const bars = row?.bars ?? EMPTY_SEGMENTS;
		const laneCount = bars.reduce((max: number, bar: EventCalendarSegment): number => Math.max(max, (bar.lane ?? 0) + 1), 0);
		return { bars, laneCount, rowStart: row?.rowStart ?? null };
	}, [index, timeZone, dayStartMs]);
}

const DAYS_IN_ROW = 7;

export interface UseEventCalendarViewSettingsResult {
	readonly viewSettings: EventCalendarViewSettings;
	readonly setViewSettings: EventCalendarApi["setViewSettings"];
	readonly effective: Required<EventCalendarViewSettings>;
}

/** User view settings plus their effective values after falling back to the view-config props. */
export function useEventCalendarViewSettings(): UseEventCalendarViewSettingsResult {
	const { state, api } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const { viewSettings } = state;
	const effective = React.useMemo(
		(): Required<EventCalendarViewSettings> => ({
			weekends: viewSettings.weekends ?? true,
			weekNumbers: viewSettings.weekNumbers ?? viewConfig.showWeekNumbers,
			nowIndicator: viewSettings.nowIndicator ?? viewConfig.nowIndicator,
			offDays: viewSettings.offDays ?? (viewConfig.offDays !== undefined && viewConfig.offDays !== false),
		}),
		[viewSettings, viewConfig.showWeekNumbers, viewConfig.nowIndicator, viewConfig.offDays],
	);
	return { viewSettings, setViewSettings: api.setViewSettings, effective };
}
