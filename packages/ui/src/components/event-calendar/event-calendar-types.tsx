// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-types.json): the
// public TypeScript contract of the event calendar — events, occurrences,
// segments, selection, drag state and callbacks. Names and shapes match ReUI,
// with these deliberate deviations:
// - `TData` defaults to `EventCalendarEventData` (any payload except
//   `undefined`/symbols) instead of an open top type, which the repo bans; a typed
//   payload still flows through every callback unchanged.
// - `CalendarEvent.color` is an `EventCalendarTone` (the kit's categorical tone
//   palette) instead of a free CSS colour, so event chips stay on design tokens
//   and keep WCAG contrast in both themes.
// - Collections are `readonly` — the calendar never mutates what it is given.
// - `EventCalendarState`, `EventCalendarDataAdapter` and the `"api"` update
//   source are dropped: the calendar is fully controlled (state lives with the
//   parent), so there is no internal store snapshot or imperative API.
import { z } from "zod";

/** Every view the calendar can render. */
export const CALENDAR_VIEWS: readonly ["month", "week", "day", "days", "agenda", "resource"] = ["month", "week", "day", "days", "agenda", "resource"];

export const CalendarViewSchema = z.enum(CALENDAR_VIEWS);

export type CalendarView = z.infer<typeof CalendarViewSchema>;

/** The categorical colours an event can carry — the kit's tone palette (`--tone-*`) plus brand and neutral. */
export const EVENT_CALENDAR_TONES: readonly ["brand", "neutral", "blue", "green", "violet", "red", "yellow", "teal", "orange"] = [
	"brand",
	"neutral",
	"blue",
	"green",
	"violet",
	"red",
	"yellow",
	"teal",
	"orange",
];

export const EventCalendarToneSchema = z.enum(EVENT_CALENDAR_TONES);

export type EventCalendarTone = z.infer<typeof EventCalendarToneSchema>;

/** RFC 5545 weekday codes. Index order follows `Date#getDay()` (Sunday first). */
export const EVENT_CALENDAR_WEEKDAYS: readonly ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export const EventCalendarWeekdaySchema = z.enum(EVENT_CALENDAR_WEEKDAYS);

export type EventCalendarWeekday = z.infer<typeof EventCalendarWeekdaySchema>;

/** Recurrence frequencies of the supported RFC 5545 subset. */
export const EVENT_CALENDAR_FREQUENCIES: readonly ["daily", "weekly", "monthly", "yearly"] = ["daily", "weekly", "monthly", "yearly"];

export const EventCalendarFrequencySchema = z.enum(EVENT_CALENDAR_FREQUENCIES);

export type EventCalendarFrequency = z.infer<typeof EventCalendarFrequencySchema>;

/** A payload a consumer attaches to an event: anything but `undefined`, symbols and bigints. */
export type EventCalendarEventData = object | string | number | boolean | null;

export type EventCalendarEventId = string;

/** Week start, `Date#getDay()` numbering (0 = Sunday). */
export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Bookable resource. The resource view flattens children and renders leaves
 * only, as booking columns; a parent's own title never renders.
 */
export interface EventCalendarResource {
	readonly id: string;
	readonly title: string;
	readonly color?: EventCalendarTone;
	readonly children?: readonly EventCalendarResource[];
}

/** Half-open: start is inclusive, end is exclusive. */
export interface EventCalendarDateRange {
	readonly start: Date;
	readonly end: Date;
}

/** An ordinal weekday inside a month/year (`2TU` = second Tuesday, `-1FR` = last Friday). */
export interface EventCalendarOrdinalWeekday {
	readonly day: EventCalendarWeekday;
	readonly ordinal: number;
}

export type EventCalendarByWeekday = EventCalendarWeekday | EventCalendarOrdinalWeekday;

export interface EventCalendarRecurrenceRule {
	readonly freq: EventCalendarFrequency;
	readonly interval?: number;
	readonly count?: number;
	/** Inclusive instant. */
	readonly until?: Date;
	readonly byWeekday?: readonly EventCalendarByWeekday[];
	readonly byMonthDay?: readonly number[];
	readonly byMonth?: readonly number[];
	readonly weekStart?: EventCalendarWeekday;
	readonly exDates?: readonly Date[];
	readonly rDates?: readonly Date[];
}

export interface CalendarEvent<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly id: EventCalendarEventId;
	readonly title: string;
	readonly start: Date;
	/** Exclusive; must be >= start. */
	readonly end: Date;
	/**
	 * Start and end must be midnights in the display time zone: segmentation
	 * walks raw instants, so another zone's midnight paints the wrong days.
	 */
	readonly allDay?: boolean;
	/** Structured rule or a raw "RRULE:..." line. */
	readonly recurrence?: EventCalendarRecurrenceRule | string;
	/** This event is an edited single occurrence of that series. */
	readonly recurringEventId?: EventCalendarEventId;
	/** Which occurrence it replaces (RECURRENCE-ID semantics). */
	readonly originalStart?: Date;
	/** Tone of the chip; defaults to the brand colour. */
	readonly color?: EventCalendarTone;
	/** Excluded from drag and resize regardless of interactions state. */
	readonly readOnly?: boolean;
	/** Per-event overrides; defaults come from interactions.drag / .resize. */
	readonly draggable?: boolean;
	readonly resizable?: boolean;
	/** Packing prominence; feeds getEventPriority ordering. */
	readonly priority?: number;
	/** Verbatim stacking override inside a day column. */
	readonly zIndex?: number;
	readonly resourceId?: string;
	readonly data?: TData;
}

export interface EventCalendarOccurrence<TData extends EventCalendarEventData = EventCalendarEventData> {
	/** Stable per instance: `${event.id}::${startISO}`. */
	readonly key: string;
	readonly eventId: EventCalendarEventId;
	readonly event: CalendarEvent<TData>;
	readonly start: Date;
	readonly end: Date;
	readonly allDay: boolean;
	readonly isRecurring: boolean;
	readonly recurrenceIndex?: number;
}

/** Placement of a segment, written by the layout helpers (never by consumers). */
export interface EventCalendarSegmentLayout {
	/** Lane stacks month bars and all-day lanes. */
	readonly lane?: number;
	/** column/columnCount/columnSpan pack time-grid overlaps. */
	readonly column?: number;
	readonly columnCount?: number;
	readonly columnSpan?: number;
	/** rowIndex/colStart/colSpan place a bar in the week row. */
	readonly rowIndex?: number;
	readonly colStart?: number;
	readonly colSpan?: number;
}

export interface EventCalendarSegment<TData extends EventCalendarEventData = EventCalendarEventData> extends EventCalendarSegmentLayout {
	readonly occurrence: EventCalendarOccurrence<TData>;
	/** Zoned midnight of the segment's day; startMin/endMin count from it. */
	readonly day: Date;
	readonly isStart: boolean;
	readonly isEnd: boolean;
	readonly continuesBefore: boolean;
	readonly continuesAfter: boolean;
	/** Timed only: minutes from the zoned day start. */
	readonly startMin?: number;
	readonly endMin?: number;
}

export interface EventCalendarSlot {
	readonly start: Date;
	readonly end: Date;
	readonly allDay: boolean;
}

export interface EventCalendarSelection {
	readonly eventKeys: readonly string[];
	/** Committed slot selection; EventCalendarSlotDraft holds the in-gesture one. */
	readonly slot: EventCalendarSlot | null;
}

export interface EventCalendarInteractions {
	readonly drag: boolean;
	readonly resize: boolean;
	readonly selectSlot: boolean;
}

export type EventCalendarDragKind = "move" | "resize-start" | "resize-end";

export interface EventCalendarDragState<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly kind: EventCalendarDragKind;
	readonly occurrence: EventCalendarOccurrence<TData>;
	readonly proposedStart: Date;
	readonly proposedEnd: Date;
	readonly proposedAllDay: boolean;
	/** Day-granular proposal (month cells, all-day lane), not minute columns. */
	readonly proposedDayGranular: boolean;
	readonly proposedResourceId?: string;
	/** Last canDropEvent verdict; drives data-drop-invalid styling. */
	readonly valid: boolean;
}

/** The in-progress drag-create rectangle only; cleared on commit or cancel. */
export interface EventCalendarSlotDraft {
	readonly start: Date;
	readonly end: Date;
	readonly allDay: boolean;
	readonly view: CalendarView;
	readonly resourceId?: string;
}

/** "View settings" toggles; undefined defers to the root view-config prop. */
export interface EventCalendarViewSettings {
	readonly weekends?: boolean;
	readonly weekNumbers?: boolean;
	readonly nowIndicator?: boolean;
	readonly offDays?: boolean;
}

export interface EventCalendarRangeInfo {
	readonly range: EventCalendarDateRange;
	readonly activeRange: EventCalendarDateRange;
	readonly view: CalendarView;
	readonly date: Date;
	readonly timeZone: string;
}

export type EventCalendarUpdateSource = "drag" | "resize-start" | "resize-end" | "keyboard";

export interface EventCalendarProposedUpdate<TData extends EventCalendarEventData = EventCalendarEventData> {
	readonly event: CalendarEvent<TData>;
	readonly occurrence: EventCalendarOccurrence<TData>;
	readonly start: Date;
	readonly end: Date;
	readonly allDay: boolean;
	readonly resourceId?: string;
	readonly source: EventCalendarUpdateSource;
}

/** An accepted update with the consumer's adjustment applied. */
export interface EventCalendarUpdateAdjustment {
	readonly start?: Date;
	readonly end?: Date;
	readonly allDay?: boolean;
}

/** false = reject/revert; true = accept; object = accept with adjustment. */
export type EventCalendarUpdateResult = boolean | EventCalendarUpdateAdjustment;

/** A click is a point, not a range; `end` is present for timed slots. */
export interface EventCalendarSlotInfo {
	readonly date: Date;
	readonly end?: Date;
	readonly allDay: boolean;
	readonly view: CalendarView;
	readonly resourceId?: string;
}

/** Off-days; `true` = weekend defaults. Marked cells carry `data-off`. */
export interface EventCalendarOffDaysConfig {
	/** Weekday numbers treated as off (0 = Sunday). Default [0, 6]. */
	readonly weekendDays?: readonly number[];
	/** Additional explicit off dates (compared by day in the display zone). */
	readonly dates?: readonly Date[];
	/** Full custom predicate; runs in addition to weekendDays/dates. */
	readonly isOffDay?: (day: Date) => boolean;
	/** Marker classes; default "bg-muted/40". */
	readonly className?: string;
}

/** Why a drag was refused (see `onDragBlocked`). */
export type EventCalendarDragBlockedReason = "readOnly" | "disabled" | "interactions-off";

export interface EventCalendarDragBlockedInfo {
	readonly gesture: "move" | "resize";
	readonly reason: EventCalendarDragBlockedReason;
}
