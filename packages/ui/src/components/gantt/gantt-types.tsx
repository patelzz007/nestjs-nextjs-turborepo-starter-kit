/**
 * Public TypeScript contract for the headless gantt: events, occurrences,
 * segments, state and callbacks. Every instant is a plain `Date` (a UTC
 * instant); conversion to the display time zone happens only at the render
 * edge (`gantt-lib` → `toZoned`).
 *
 * `TData` is the consumer's payload on an event (`event.data`). It defaults to
 * `RuntimeValue` — "any value", which the kit never reads — so a consumer that
 * needs the payload either types it (`GanttEvent<Task>`) or narrows it with a
 * zod schema at the read site.
 */
import type { RuntimeValue } from "@workspace/shared";

/** The payload constraint: any value a JS expression can hold. */
export type GanttData = RuntimeValue;

/**
 * A callback type that is bivariant in its parameters (the `bivarianceHack`
 * React's own event-handler types use). It lets a `GanttInstance<Task>` live in
 * the gantt's type-erased context (`GanttInstance<GanttData>`), while every
 * call site still receives exactly the events the consumer passed in.
 */
export type GanttHandler<TArgs extends readonly GanttData[], TResult> = {
	bivarianceHack(...args: TArgs): TResult;
}["bivarianceHack"];

export type GanttBarId = string;

export type GanttScale = "day" | "week" | "month" | "quarter" | "year";

/** Row drag-reorder proposal: `parentId` null is root, `resources` is the tree with the move applied. */
export interface GanttResourceReorder {
	readonly resourceId: string;
	readonly parentId: string | null;
	/** Position among the new parent's children, the moved row excluded. */
	readonly index: number;
	readonly resources: readonly GanttResource[];
}

/**
 * "single" keeps the node on one track and refuses any gesture that would
 * create a concurrent schedule; "multiple" stacks them into stable lanes.
 */
export type GanttScheduleMode = "single" | "multiple";

/**
 * Drop policy for a gesture overlapping another schedule in the SAME node.
 * Policy only — overlapping data always renders. "allow" (default) commits as
 * proposed, "clamp" stops at the neighbour's edge, "reject" never commits.
 */
export type GanttOverlapPolicy = "allow" | "reject" | "clamp";

/** Vertical placement of row content when the node holds several lanes; "start" pins it to the first lane. */
export type GanttRowAlign = "start" | "center";

/** One tree node, not domain-bound: a task (one schedule) or a resource lane (many). Children nest as collapsible groups. */
export interface GanttResource {
	readonly id: string;
	readonly title: string;
	/** A colour token or CSS colour (`GANTT_COLORS` lists the kit's tone tokens). */
	readonly color?: string | undefined;
	/** Per-node cardinality; falls back to the view-level default. */
	readonly scheduleMode?: GanttScheduleMode | undefined;
	/**
	 * Planned (as-built baseline) window for the WHOLE node, ghosted as a band
	 * behind its lanes — independent of any per-event baselines. Half open; set
	 * both or neither. Equal instants mark a planned milestone.
	 */
	readonly baselineStart?: Date | undefined;
	readonly baselineEnd?: Date | undefined;
	readonly children?: readonly GanttResource[] | undefined;
}

/** Preferred name for a tree node; `GanttResource` is the legacy alias. */
export type GanttNode = GanttResource;

/** Half-open: `start` inclusive, `end` exclusive. */
export interface GanttDateRange {
	readonly start: Date;
	readonly end: Date;
}

export type GanttWeekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

/** A BYDAY entry with an ordinal ("2nd Monday"); parsed and serialized, rejected by the built-in expander. */
export interface GanttOrdinalWeekday {
	readonly day: GanttWeekday;
	readonly ordinal: number;
}

export type GanttRecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface GanttRecurrenceRule {
	readonly freq: GanttRecurrenceFrequency;
	readonly interval?: number | undefined;
	readonly count?: number | undefined;
	/** Inclusive, unlike the exclusive `end` of a range. */
	readonly until?: Date | undefined;
	readonly byWeekday?: readonly (GanttWeekday | GanttOrdinalWeekday)[] | undefined;
	readonly byMonthDay?: readonly number[] | undefined;
	readonly byMonth?: readonly number[] | undefined;
	readonly weekStart?: GanttWeekday | undefined;
	readonly exDates?: readonly Date[] | undefined;
	readonly rDates?: readonly Date[] | undefined;
}

export interface GanttEvent<TData extends GanttData = GanttData> {
	readonly id: GanttBarId;
	readonly title: string;
	/** Plain instants, not ISO strings. `end` is exclusive and must be >= start. */
	readonly start: Date;
	readonly end: Date;
	readonly allDay?: boolean | undefined;
	/** Structured rule or a raw "RRULE:..." line. */
	readonly recurrence?: GanttRecurrenceRule | string | undefined;
	/** An edited single occurrence of that series; `originalStart` is the RECURRENCE-ID it replaces. */
	readonly recurringEventId?: GanttBarId | undefined;
	readonly originalStart?: Date | undefined;
	/** Colour token or CSS colour; flows to the `--gantt-event-color` CSS variable. */
	readonly color?: string | undefined;
	/** Vetoes only, ANDed with interactions.drag / .resize: readOnly blocks both, draggable/resizable one each. */
	readonly readOnly?: boolean | undefined;
	readonly draggable?: boolean | undefined;
	readonly resizable?: boolean | undefined;
	/** Feeds the default getEventPriority; higher orders and packs first. */
	readonly priority?: number | undefined;
	/** Completion 0-100, not 0-1. */
	readonly progress?: number | undefined;
	/**
	 * Planned (as-built baseline) window, drawn behind the bar so the actual
	 * start/end read against it. Half-open like start/end; set both or neither.
	 * Equal instants mark a planned milestone. A recurring series has no single
	 * planned window, so events with `recurrence` render none.
	 */
	readonly baselineStart?: Date | undefined;
	readonly baselineEnd?: Date | undefined;
	/** Explicit stacking override; wins over the computed z. */
	readonly zIndex?: number | undefined;
	readonly resourceId?: string | undefined;
	/**
	 * Ids of the events this one waits on (finish-to-start). The view draws an
	 * elbow arrow from each named event's end into this one's start; unknown
	 * ids, recurring series, and endpoints on hidden rows are skipped.
	 * Rendering only — the gantt never reschedules dependents.
	 */
	readonly dependencies?: readonly GanttBarId[] | undefined;
	readonly data?: TData | undefined;
}

export interface GanttOccurrence<TData extends GanttData = GanttData> {
	/** Stable per instance: `${event.id}::${startISO}`. */
	readonly key: string;
	readonly eventId: GanttBarId;
	readonly event: GanttEvent<TData>;
	readonly start: Date;
	readonly end: Date;
	readonly allDay: boolean;
	readonly isRecurring: boolean;
	readonly recurrenceIndex?: number | undefined;
}

export interface GanttSegment<TData extends GanttData = GanttData> {
	readonly occurrence: GanttOccurrence<TData>;
	/** Range-start reference instant of the segment's timeline slice. */
	readonly day: Date;
	readonly isStart: boolean;
	readonly isEnd: boolean;
	readonly continuesBefore: boolean;
	readonly continuesAfter: boolean;
	/** Minutes from the visible range start, clamped to the range. */
	readonly startMin?: number | undefined;
	readonly endMin?: number | undefined;
	/** Lane packing: 0-based lane index, then the lanes the node's row resolved to. */
	readonly column?: number | undefined;
	readonly columnCount?: number | undefined;
	readonly columnSpan?: number | undefined;
}

/** A validated planned window; `milestone` when start and end coincide. */
export interface GanttBaseline {
	readonly start: Date;
	readonly end: Date;
	readonly milestone: boolean;
}

/** Actual end against the planned end: before it, after it, or exactly on it. */
export type GanttBaselineVariance = "early" | "late" | "on-time";

export interface GanttSlotSelection {
	readonly start: Date;
	readonly end: Date;
	readonly allDay: boolean;
}

export interface GanttSelection {
	readonly eventKeys: readonly string[];
	readonly slot: GanttSlotSelection | null;
}

export interface GanttInteractions {
	/** Horizontal move within the bar's own row; never across rows. */
	readonly drag: boolean;
	readonly resize: boolean;
	readonly selectSlot: boolean;
}

export type GanttDragKind = "move" | "resize-start" | "resize-end";

export interface GanttDragState<TData extends GanttData = GanttData> {
	readonly kind: GanttDragKind;
	readonly occurrence: GanttOccurrence<TData>;
	readonly proposedStart: Date;
	readonly proposedEnd: Date;
	readonly proposedAllDay: boolean;
	readonly proposedResourceId?: string | undefined;
	/** Last canDropEvent verdict; drives data-drop-invalid styling. */
	readonly valid: boolean;
}

/** The in-gesture drag-create rectangle only; the committed slot is GanttSelection.slot. */
export interface GanttSlotDraft {
	readonly start: Date;
	readonly end: Date;
	readonly allDay: boolean;
	readonly resourceId?: string | undefined;
}

export interface GanttState<TData extends GanttData = GanttData> {
	readonly scale: GanttScale;
	readonly date: Date;
	/** Full rendered axis range — fetch remote data for THIS, not for activeRange (the logical month/week). */
	readonly visibleRange: GanttDateRange;
	readonly activeRange: GanttDateRange;
	readonly events: readonly GanttEvent<TData>[];
	readonly selection: GanttSelection;
	readonly interactions: GanttInteractions;
	readonly loading: boolean;
	readonly drag: GanttDragState<TData> | null;
	readonly slotDraft: GanttSlotDraft | null;
	/** Center of the scrolled viewport; the nav title follows it. null falls back to the anchor date. */
	readonly viewportCenter: Date | null;
}

export interface GanttRangeInfo {
	readonly range: GanttDateRange;
	readonly activeRange: GanttDateRange;
	readonly scale: GanttScale;
	readonly date: Date;
	readonly timeZone: string;
}

export type GanttUpdateSource = "drag" | "resize-start" | "resize-end" | "keyboard" | "api";

export interface GanttProposedUpdate<TData extends GanttData = GanttData> {
	readonly event: GanttEvent<TData>;
	/** null when source === "api". */
	readonly occurrence: GanttOccurrence<TData> | null;
	readonly start: Date;
	readonly end: Date;
	readonly allDay: boolean;
	readonly resourceId?: string | undefined;
	readonly source: GanttUpdateSource;
}

/** An accepted update with the consumer's adjustment (snapped times, a forced all-day…). */
export interface GanttUpdateAdjustment {
	readonly start?: Date | undefined;
	readonly end?: Date | undefined;
	readonly allDay?: boolean | undefined;
}

/** false = reject/revert; undefined (no return) or true = accept; object = accept with adjustment. */
export type GanttUpdateResult = boolean | undefined | GanttUpdateAdjustment;

/** A click is a point, not a range; `end` is reserved for future gestures. */
export interface GanttSlotInfo {
	readonly date: Date;
	readonly end?: Date | undefined;
	readonly allDay: boolean;
	readonly resourceId?: string | undefined;
}

/** Off-day marking; `true` takes the defaults. Marked cells carry `data-off` for CSS customization. */
export interface GanttOffDaysConfig {
	/** Weekday numbers treated as off (0 = Sunday). Default [0, 6]. */
	readonly weekendDays?: readonly number[] | undefined;
	/** Extra off dates compared by day in the display zone. */
	readonly dates?: readonly Date[] | undefined;
	/** Runs in addition to weekendDays and dates, not instead; any match marks the day off. */
	readonly isOffDay?: GanttHandler<[day: Date], boolean> | undefined;
	/** Marker classes; default a muted wash. */
	readonly className?: string | undefined;
}

/** External-data contract; OAuth, tokens, and sync loops are application backend territory. */
export interface GanttDataAdapter<TData extends GanttData = GanttData> {
	getEvents(range: GanttDateRange, signal?: AbortSignal): Promise<GanttEvent<TData>[]>;
}

/** The source of "now" (rules/00: time is injected so it is controllable in tests). */
export interface GanttClock {
	nowEpochMs(): number;
}
