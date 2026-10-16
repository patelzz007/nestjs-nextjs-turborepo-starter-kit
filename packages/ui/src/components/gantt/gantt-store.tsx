/**
 * The gantt's headless engine: a subscribable store that resolves the
 * controlled / uncontrolled state pairs, the visible range (with infinite
 * scroll growth), the occurrence index and the CRUD contract. React-free — the
 * hooks in `gantt.tsx` adapt it with `useSyncExternalStore`.
 *
 * Every state pair is either CONTROLLED (`events`, `scale`, `date`,
 * `selection`, `interactions` passed in; changes are proposed through the
 * matching `on…Change` callback and only land when the parent adopts them) or
 * UNCONTROLLED (`default…` seeds internal state). Never both for one key.
 */
import { hasGlobalValue } from "@workspace/shared";
import type { Locale } from "date-fns";
import type * as React from "react";

import { mergeGanttI18n, type GanttI18nConfig, type GanttI18nOverrides, type GanttLabels } from "./gantt-i18n";
import {
	buildEventIndex,
	defaultEventOrder,
	eventsOverlap,
	getGanttDateRange,
	getRangeKey,
	stepGanttDate,
	SYSTEM_GANTT_CLOCK,
	toZoned,
	type GanttIndex,
	type GanttOccurrencesResolver,
	type GanttStepDirection,
	type WeekStartsOn,
} from "./gantt-lib";
import type {
	GanttBarId,
	GanttClock,
	GanttData,
	GanttDateRange,
	GanttDragState,
	GanttEvent,
	GanttHandler,
	GanttInteractions,
	GanttOccurrence,
	GanttOverlapPolicy,
	GanttProposedUpdate,
	GanttRangeInfo,
	GanttResource,
	GanttResourceReorder,
	GanttRowAlign,
	GanttScale,
	GanttScheduleMode,
	GanttSelection,
	GanttSlotDraft,
	GanttSlotInfo,
	GanttState,
	GanttUpdateResult,
} from "./gantt-types";

export const DEFAULT_INTERACTIONS: GanttInteractions = { drag: true, resize: true, selectSlot: true };

/** Infinite-scroll growth cap, in whole periods per side. */
export const MAX_RANGE_WINDOW = 12;

/** A node holds as many concurrent schedules as it needs unless told otherwise. */
export const DEFAULT_SCHEDULE_MODE: GanttScheduleMode = "multiple";

/** Tree label sits on the first schedule's baseline, not the grown row's middle. */
export const DEFAULT_ROW_ALIGN: GanttRowAlign = "start";

/** Default drag-create length in minutes when a bare click yields a slot. */
export const DEFAULT_SLOT_DURATION_MIN = 30;

/** Default day-scale snap step in minutes. */
export const DEFAULT_SNAP_DURATION_MIN = 15;

/** Default week start without a locale: Sunday. */
const DEFAULT_WEEK_STARTS_ON: WeekStartsOn = 0;

/** How often a mounted now-line / today highlight re-reads the clock. */
export const NOW_TICK_MS = 30_000;

export const EMPTY_SELECTION: GanttSelection = { eventKeys: [], slot: null };

const NO_RESOURCES: readonly GanttResource[] = [];

/**
 * A node's cardinality: its own override wins over the view-level default.
 * Shared by the layout pass and the gesture engine so both read one rule.
 */
export function resolveScheduleMode(node: GanttResource | null | undefined, scheduleMode: GanttScheduleMode | undefined): GanttScheduleMode {
	return node?.scheduleMode ?? scheduleMode ?? DEFAULT_SCHEDULE_MODE;
}

/** Row context handed to tree-panel column and label renderers. */
export interface GanttColumnContext {
	readonly resource: GanttResource;
	readonly depth: number;
	readonly isGroup: boolean;
	readonly collapsed: boolean;
}

/** The "add task" hint's create position. */
export interface GanttCreateTaskContext {
	readonly parentId: string | null;
	readonly index: number;
}

/** Pointer-activation thresholds; unset keys keep the dnd-kit parity defaults. */
export interface GanttActivationConfig {
	/** Mouse travel (px) before a bar move starts. Default 5. */
	readonly moveDistancePx?: number | undefined;
	/** Mouse travel (px) before a drag-create starts. Default 4. */
	readonly createDistancePx?: number | undefined;
	/** Touch long-press delay in ms. Default 250. */
	readonly touchDelayMs?: number | undefined;
	/** Touch movement tolerance (px) during the long-press. Default 5. */
	readonly touchTolerancePx?: number | undefined;
}

/** Hard travel bounds for infinite scrolling; either side may be omitted. */
export interface GanttRangeBounds {
	readonly min?: Date | undefined;
	readonly max?: Date | undefined;
}

type GanttMouseEvent = React.MouseEvent<HTMLElement>;

export interface GanttCallbacks<TData extends GanttData = GanttData> {
	readonly onEventClick?: GanttHandler<[occurrence: GanttOccurrence<TData>, event: GanttMouseEvent], void> | undefined;
	readonly onEventDoubleClick?: GanttHandler<[occurrence: GanttOccurrence<TData>, event: GanttMouseEvent], void> | undefined;
	/** The commit gate: return false to revert, an adjustment object to accept with changes. */
	readonly onEventUpdate?: GanttHandler<[update: GanttProposedUpdate<TData>], GanttUpdateResult> | undefined;
	/** Live validity while a gesture is in flight (advisory unless enforceCanDrop). */
	readonly canDropEvent?: GanttHandler<[update: GanttProposedUpdate<TData>], boolean> | undefined;
	readonly onSlotClick?: GanttHandler<[slot: GanttSlotInfo, event: GanttMouseEvent], void> | undefined;
	readonly onSelectSlot?: GanttHandler<[slot: GanttSlotDraft], void> | undefined;
	readonly canSelectSlot?: GanttHandler<[slot: GanttSlotDraft], boolean> | undefined;
	/** Fires when the "add task" hint is activated; create a new tree row. */
	readonly onCreateTask?: GanttHandler<[context: GanttCreateTaskContext], void> | undefined;
	/** Gates the "add task" hint (the shipped view offers root-level creation only). */
	readonly canCreateTask?: GanttHandler<[context: { readonly parentId: string | null }], boolean> | undefined;
	/** Click on a tree row's surface (chevron/checkbox/grip clicks excluded). */
	readonly onResourceClick?: GanttHandler<[context: GanttColumnContext, event: GanttMouseEvent], void> | undefined;
	readonly onResourceDoubleClick?: GanttHandler<[context: GanttColumnContext, event: GanttMouseEvent], void> | undefined;
	readonly onRangeChange?: GanttHandler<[info: GanttRangeInfo], void> | undefined;
	readonly onScaleChange?: GanttHandler<[scale: GanttScale], void> | undefined;
	readonly onDateChange?: GanttHandler<[date: Date], void> | undefined;
	readonly onSelectionChange?: GanttHandler<[selection: GanttSelection], void> | undefined;
	readonly onInteractionsChange?: GanttHandler<[interactions: GanttInteractions], void> | undefined;
	readonly onEventsChange?: GanttHandler<[events: readonly GanttEvent<TData>[]], void> | undefined;
	/**
	 * Commit gate for row drag reorder. Return false to reject; apply the move
	 * by adopting proposal.resources into your `resources` state (controlled —
	 * the gantt never self-mutates its tree).
	 */
	readonly onResourceReorder?: GanttHandler<[proposal: GanttResourceReorder], false | undefined> | undefined;
	/** Live validity predicate while a resource row is being dragged. */
	readonly canReorderResource?: GanttHandler<[proposal: GanttResourceReorder], boolean> | undefined;
	/** Fires when a reorder is released on a position `canReorderResource` rejected. */
	readonly onResourceReorderReject?: GanttHandler<[proposal: GanttResourceReorder], void> | undefined;
}

export interface UseGanttStateOptions<TData extends GanttData = GanttData> extends GanttCallbacks<TData> {
	readonly events?: readonly GanttEvent<TData>[] | undefined;
	readonly defaultEvents?: readonly GanttEvent<TData>[] | undefined;
	readonly scale?: GanttScale | undefined;
	readonly defaultScale?: GanttScale | undefined;
	readonly date?: Date | undefined;
	readonly defaultDate?: Date | undefined;
	readonly selection?: GanttSelection | undefined;
	readonly defaultSelection?: GanttSelection | undefined;
	readonly interactions?: Partial<GanttInteractions> | undefined;
	readonly defaultInteractions?: Partial<GanttInteractions> | undefined;
	readonly loading?: boolean | undefined;
	/** IANA display zone; defaults to the runtime's zone. */
	readonly timeZone?: string | undefined;
	readonly locale?: Locale | undefined;
	readonly weekStartsOn?: WeekStartsOn | undefined;
	readonly slotDuration?: number | undefined;
	readonly snapDuration?: number | undefined;
	/** Per-usage overrides of the provider's `gantt` labels. */
	readonly i18n?: GanttI18nOverrides | undefined;
	readonly rangeBounds?: GanttRangeBounds | undefined;
	/** Pointer-activation threshold overrides for drag/resize/create. */
	readonly activation?: GanttActivationConfig | undefined;
	/** Infinite-scroll growth cap in whole periods per side; past it the anchor slides. Default 12. */
	readonly maxRangeWindow?: number | undefined;
	/** Tree nodes of the gantt (GanttNode is the preferred type name). */
	readonly resources?: readonly GanttResource[] | undefined;
	/** What a gesture may do when it would overlap another schedule in the SAME node. */
	readonly overlap?: GanttOverlapPolicy | undefined;
	/** Make canDropEvent binding: a release whose last verdict was invalid reverts. */
	readonly enforceCanDrop?: boolean | undefined;
	readonly getEventPriority?: GanttHandler<[event: GanttEvent<TData>], number> | undefined;
	readonly eventOrder?: GanttHandler<[a: GanttOccurrence<TData>, b: GanttOccurrence<TData>], number> | undefined;
	readonly getOccurrences?: GanttOccurrencesResolver<TData> | undefined;
	/** The source of "now" (Today, the now-line, past bars). Defaults to the system clock. */
	readonly clock?: GanttClock | undefined;
}

/** Store construction input: the options plus the provider's `gantt` labels. */
export interface GanttStoreOptions<TData extends GanttData = GanttData> extends UseGanttStateOptions<TData> {
	readonly labels: GanttLabels;
}

/**
 * Resolved configuration: every option except the state pairs, with
 * defaults applied and i18n merged. Read via ref semantics — callback identity
 * changes never re-render the grid.
 */
export interface GanttSettings<TData extends GanttData = GanttData> extends GanttCallbacks<TData> {
	readonly timeZone: string;
	readonly locale?: Locale | undefined;
	readonly weekStartsOn: WeekStartsOn;
	readonly slotDuration: number;
	readonly snapDuration: number;
	readonly i18n: GanttI18nConfig;
	readonly rangeBounds?: GanttRangeBounds | undefined;
	readonly activation?: GanttActivationConfig | undefined;
	readonly maxRangeWindow?: number | undefined;
	readonly resources: readonly GanttResource[];
	readonly overlap: GanttOverlapPolicy;
	readonly enforceCanDrop?: boolean | undefined;
	readonly getEventPriority: GanttHandler<[event: GanttEvent<TData>], number>;
	readonly eventOrder: GanttHandler<[a: GanttOccurrence<TData>, b: GanttOccurrence<TData>], number>;
	readonly getOccurrences?: GanttOccurrencesResolver<TData> | undefined;
	readonly clock: GanttClock;
}

export interface GanttOverlapQuery {
	readonly start: Date;
	readonly end: Date;
	readonly excludeEventId?: string | undefined;
}

export interface GanttSelectEventOptions {
	readonly additive?: boolean | undefined;
}

export interface GanttApi<TData extends GanttData = GanttData> {
	readonly next: () => void;
	readonly prev: () => void;
	readonly today: () => void;
	readonly goTo: (date: Date) => void;
	readonly setScale: (scale: GanttScale) => void;
	readonly getEvents: () => readonly GanttEvent<TData>[];
	readonly getEvent: (id: GanttBarId) => GanttEvent<TData> | undefined;
	readonly setEvents: GanttHandler<[events: readonly GanttEvent<TData>[]], void>;
	readonly addEvent: GanttHandler<[event: GanttEvent<TData>], void>;
	readonly updateEvent: GanttHandler<[id: GanttBarId, patch: Partial<GanttEvent<TData>>], void>;
	readonly removeEvent: (id: GanttBarId) => void;
	readonly getOccurrences: (range?: GanttDateRange) => readonly GanttOccurrence<TData>[];
	readonly findOverlapping: (candidate: GanttOverlapQuery) => readonly GanttOccurrence<TData>[];
	readonly select: (selection: Partial<GanttSelection>) => void;
	readonly selectEvent: (key: string, options?: GanttSelectEventOptions) => void;
	readonly clearSelection: () => void;
	readonly setInteractions: (patch: Partial<GanttInteractions>) => void;
	readonly getVisibleRange: () => GanttDateRange;
	readonly getActiveRange: () => GanttDateRange;
	/** TZDate in the gantt's display time zone. */
	readonly toZoned: (date: Date) => Date;
}

export type GanttRangeDirection = "before" | "after";

/** Cross-file plumbing for the sibling view/interaction modules; not public API. */
export interface GanttInternals<TData extends GanttData = GanttData> {
	readonly getIndex: () => GanttIndex<TData>;
	readonly setDrag: GanttHandler<[drag: GanttDragState<TData> | null], void>;
	readonly setSlotDraft: (draft: GanttSlotDraft | null) => void;
	/** The one validation funnel every gesture, key press and api update commits through. */
	readonly applyProposedUpdate: GanttHandler<[update: GanttProposedUpdate<TData>], boolean>;
	readonly getSettingsVersion: () => number;
	/** Grow visibleRange by whole periods for infinite scrolling; false once the cap is reached. */
	readonly extendRange: (direction: GanttRangeDirection) => boolean;
	/** True when the LAST anchor-date change was an extendRange window slide (not a navigation). */
	readonly didAnchorSlide: () => boolean;
	/** View reports the visible-center instant (or null) for the nav title. */
	readonly setViewportCenter: (date: Date | null) => void;
	/** Subscribes to the clock tick (the now-line, Today, past bars). */
	readonly subscribeNow: (listener: () => void) => () => void;
	/** The current tick's instant in epoch ms (stable between ticks). */
	readonly getNowMs: () => number;
}

export interface GanttInstance<TData extends GanttData = GanttData> {
	readonly getState: () => GanttState<TData>;
	readonly subscribe: (listener: () => void) => () => void;
	readonly api: GanttApi<TData>;
	readonly settings: GanttSettings<TData>;
	readonly internals: GanttInternals<TData>;
}

export interface GanttStore<TData extends GanttData = GanttData> {
	readonly instance: GanttInstance<TData>;
	/** Adopt the latest options; returns whether anything observable changed. */
	readonly setOptions: (next: GanttStoreOptions<TData>) => boolean;
	/** Notify subscribers once if a `setOptions` call changed something since the last flush. */
	readonly flushPendingNotify: () => void;
	readonly notify: () => void;
	readonly emitRangeIfChanged: () => void;
}

function runtimeTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Resolves the settings for one options object. Pass the previous merged
 * `i18n` when neither the labels nor the overrides changed, so its identity
 * (which the view memoizes on) survives re-renders.
 */
export function resolveSettings<TData extends GanttData>(options: GanttStoreOptions<TData>, reuseI18n?: GanttI18nConfig): GanttSettings<TData> {
	const {
		events: eventsPair,
		defaultEvents: defaultEventsPair,
		scale: scalePair,
		defaultScale: defaultScalePair,
		date: datePair,
		defaultDate: defaultDatePair,
		selection: selectionPair,
		defaultSelection: defaultSelectionPair,
		interactions: interactionsPair,
		defaultInteractions: defaultInteractionsPair,
		loading: loadingPair,
		labels,
		i18n,
		timeZone,
		locale,
		weekStartsOn,
		slotDuration,
		snapDuration,
		resources,
		overlap,
		getEventPriority: getPriority,
		eventOrder,
		clock,
		...rest
	} = options;
	const getEventPriority = getPriority ?? ((event: GanttEvent<TData>): number => event.priority ?? 0);
	return {
		...rest,
		timeZone: timeZone ?? runtimeTimeZone(),
		locale,
		// locale-first default: a de/fr locale gets Monday weeks; an explicit weekStartsOn always wins
		weekStartsOn: weekStartsOn ?? locale?.options?.weekStartsOn ?? DEFAULT_WEEK_STARTS_ON,
		slotDuration: slotDuration ?? DEFAULT_SLOT_DURATION_MIN,
		snapDuration: snapDuration ?? DEFAULT_SNAP_DURATION_MIN,
		i18n: reuseI18n ?? mergeGanttI18n(labels, i18n),
		resources: resources ?? NO_RESOURCES,
		overlap: overlap ?? "allow",
		getEventPriority,
		// priority-aware default: higher getEventPriority packs/orders first
		eventOrder:
			eventOrder ?? ((a: GanttOccurrence<TData>, b: GanttOccurrence<TData>): number => getEventPriority(b.event) - getEventPriority(a.event) || defaultEventOrder(a, b)),
		clock: clock ?? SYSTEM_GANTT_CLOCK,
	};
}

/** The option keys whose change must re-render state subscribers. */
const STATE_KEYS: readonly (keyof UseGanttStateOptions)[] = ["events", "scale", "date", "selection", "interactions", "loading"];

/** The option keys that change the resolved settings (and bump the settings version). */
const SETTINGS_KEYS: readonly (keyof GanttStoreOptions)[] = [
	"labels",
	"timeZone",
	"locale",
	"weekStartsOn",
	"slotDuration",
	"snapDuration",
	"i18n",
	"rangeBounds",
	"activation",
	"maxRangeWindow",
	"resources",
	"overlap",
	"enforceCanDrop",
	"getEventPriority",
	"eventOrder",
	"getOccurrences",
	"clock",
];

interface RangeWindow {
	readonly before: number;
	readonly after: number;
}

const NO_RANGE_WINDOW: RangeWindow = { before: 0, after: 0 };

interface InternalState<TData extends GanttData> {
	scale: GanttScale;
	date: Date;
	events: readonly GanttEvent<TData>[];
	selection: GanttSelection;
	interactions: GanttInteractions;
	drag: GanttDragState<TData> | null;
	slotDraft: GanttSlotDraft | null;
	/** Whole extra periods rendered on each side (infinite scroll). */
	rangeWindow: RangeWindow;
	/** Visible-center instant reported by the view; drives the nav title. */
	viewportCenter: Date | null;
}

interface IndexCache<TData extends GanttData> {
	readonly events: readonly GanttEvent<TData>[];
	readonly rangeKey: string;
	readonly settingsVersion: number;
	readonly index: GanttIndex<TData>;
}

/** The visible range at `date`, widened by whole periods on each side for infinite scroll. */
export function resolveVisibleRange(
	scale: GanttScale,
	date: Date,
	window: RangeWindow,
	options: { readonly timeZone: string; readonly weekStartsOn: WeekStartsOn },
): GanttDateRange {
	const base = getGanttDateRange(scale, date, options).visibleRange;
	if (window.before <= 0 && window.after <= 0) {
		return base;
	}
	let earlier = date;
	for (let step = 0; step < window.before; step += 1) {
		earlier = stepGanttDate(scale, earlier, -1, options);
	}
	let later = date;
	for (let step = 0; step < window.after; step += 1) {
		later = stepGanttDate(scale, later, 1, options);
	}
	return { start: getGanttDateRange(scale, earlier, options).visibleRange.start, end: getGanttDateRange(scale, later, options).visibleRange.end };
}

/**
 * Creates the headless store. Pure apart from the optional clock ticker,
 * which only runs while something subscribes to "now".
 */
export function createGanttStore<TData extends GanttData>(initial: GanttStoreOptions<TData>): GanttStore<TData> {
	let options = initial;
	let settings = resolveSettings(initial);
	let settingsVersion = 0;
	let pendingNotify = false;
	const listeners = new Set<() => void>();
	const internal: InternalState<TData> = {
		scale: initial.defaultScale ?? "day",
		date: initial.defaultDate ?? new Date(settings.clock.nowEpochMs()),
		events: initial.defaultEvents ?? [],
		selection: initial.defaultSelection ?? EMPTY_SELECTION,
		interactions: { ...DEFAULT_INTERACTIONS, ...initial.defaultInteractions },
		drag: null,
		slotDraft: null,
		rangeWindow: NO_RANGE_WINDOW,
		viewportCenter: null,
	};
	let snapshot: GanttState<TData> | null = null;
	let indexCache: IndexCache<TData> | null = null;
	let lastEmittedRangeKey: string | null = null;
	let lastAnchorChangeWasSlide = false;

	const invalidate = (): void => {
		snapshot = null;
	};

	const getState = (): GanttState<TData> => {
		if (snapshot !== null) {
			return snapshot;
		}
		const scale = options.scale ?? internal.scale;
		const date = options.date ?? internal.date;
		const rangeOptions = { timeZone: settings.timeZone, weekStartsOn: settings.weekStartsOn };
		const { activeRange } = getGanttDateRange(scale, date, rangeOptions);
		snapshot = {
			scale,
			date,
			visibleRange: resolveVisibleRange(scale, date, internal.rangeWindow, rangeOptions),
			activeRange,
			events: options.events ?? internal.events,
			selection: options.selection ?? internal.selection,
			interactions: options.interactions === undefined ? internal.interactions : { ...DEFAULT_INTERACTIONS, ...options.interactions },
			loading: options.loading ?? false,
			drag: internal.drag,
			slotDraft: internal.slotDraft,
			viewportCenter: internal.viewportCenter,
		};
		return snapshot;
	};

	const emitRangeIfChanged = (): void => {
		const onRangeChange = settings.onRangeChange;
		if (onRangeChange === undefined) {
			return;
		}
		const state = getState();
		const key = `${state.scale}:${getRangeKey(state.visibleRange)}:${settings.timeZone}`;
		if (key === lastEmittedRangeKey) {
			return;
		}
		lastEmittedRangeKey = key;
		onRangeChange({ range: state.visibleRange, activeRange: state.activeRange, scale: state.scale, date: state.date, timeZone: settings.timeZone });
	};

	const notify = (): void => {
		for (const listener of [...listeners]) {
			listener();
		}
		emitRangeIfChanged();
	};

	/** Navigating re-anchors the axis: drop infinite-scroll growth and let the title follow the anchor again. */
	const resetNavigation = (): void => {
		internal.rangeWindow = NO_RANGE_WINDOW;
		internal.viewportCenter = null;
		lastAnchorChangeWasSlide = false;
		invalidate();
	};

	const setDate = (date: Date): void => {
		if (getState().date.getTime() === date.getTime()) {
			return;
		}
		resetNavigation();
		const controlled = options.date !== undefined;
		if (!controlled) {
			internal.date = date;
			invalidate();
		}
		settings.onDateChange?.(date);
		if (!controlled) {
			notify();
		}
	};

	const setScale = (scale: GanttScale): void => {
		if (getState().scale === scale) {
			return;
		}
		resetNavigation();
		const controlled = options.scale !== undefined;
		if (!controlled) {
			internal.scale = scale;
			invalidate();
		}
		settings.onScaleChange?.(scale);
		if (!controlled) {
			notify();
		}
	};

	const setEvents = (events: readonly GanttEvent<TData>[]): void => {
		const controlled = options.events !== undefined;
		if (!controlled) {
			internal.events = events;
			invalidate();
		}
		settings.onEventsChange?.(events);
		if (!controlled) {
			notify();
		}
	};

	const setSelection = (selection: GanttSelection): void => {
		const controlled = options.selection !== undefined;
		if (!controlled) {
			internal.selection = selection;
			invalidate();
		}
		settings.onSelectionChange?.(selection);
		if (!controlled) {
			notify();
		}
	};

	const setInteractions = (interactions: GanttInteractions): void => {
		const controlled = options.interactions !== undefined;
		if (!controlled) {
			internal.interactions = interactions;
			invalidate();
		}
		settings.onInteractionsChange?.(interactions);
		if (!controlled) {
			notify();
		}
	};

	const applyUpdate = (update: GanttProposedUpdate<TData>, extra?: Partial<GanttEvent<TData>>): boolean => {
		const result = settings.onEventUpdate?.(update);
		if (result === false) {
			return false;
		}
		const adjustment = result === true || result === undefined ? null : result;
		const timing: Partial<GanttEvent<TData>> = {
			start: adjustment?.start ?? update.start,
			end: adjustment?.end ?? update.end,
			allDay: adjustment?.allDay ?? update.allDay,
			...(update.resourceId === undefined ? {} : { resourceId: update.resourceId }),
		};
		// extra non-timing fields commit in the SAME events emission
		const merged: Partial<GanttEvent<TData>> = { ...extra, ...timing };
		setEvents(getState().events.map((event: GanttEvent<TData>): GanttEvent<TData> => (event.id === update.event.id ? { ...event, ...merged } : event)));
		return true;
	};

	const buildIndex = (events: readonly GanttEvent<TData>[], range: GanttDateRange): GanttIndex<TData> =>
		buildEventIndex(events, range, { timeZone: settings.timeZone, eventOrder: settings.eventOrder, getOccurrences: settings.getOccurrences });

	const getIndex = (): GanttIndex<TData> => {
		const state = getState();
		const rangeKey = getRangeKey(state.visibleRange);
		if (indexCache?.events === state.events && indexCache.rangeKey === rangeKey && indexCache.settingsVersion === settingsVersion) {
			return indexCache.index;
		}
		const index = buildIndex(state.events, state.visibleRange);
		indexCache = { events: state.events, rangeKey, settingsVersion, index };
		return index;
	};

	/** Anchor clamp: navigation may never leave the configured bounds. */
	const clampToBounds = (date: Date): Date => {
		const bounds = settings.rangeBounds;
		if (bounds?.min !== undefined && date.getTime() < bounds.min.getTime()) {
			return bounds.min;
		}
		if (bounds?.max !== undefined && date.getTime() > bounds.max.getTime()) {
			return bounds.max;
		}
		return date;
	};

	const step = (direction: GanttStepDirection): void => {
		const state = getState();
		setDate(clampToBounds(stepGanttDate(state.scale, state.date, direction, { timeZone: settings.timeZone })));
	};

	const api: GanttApi<TData> = {
		next(): void {
			step(1);
		},
		prev(): void {
			step(-1);
		},
		today(): void {
			setDate(clampToBounds(new Date(settings.clock.nowEpochMs())));
		},
		goTo(date: Date): void {
			setDate(clampToBounds(date));
		},
		setScale(scale: GanttScale): void {
			setScale(scale);
		},
		getEvents(): readonly GanttEvent<TData>[] {
			return getState().events;
		},
		getEvent(id: GanttBarId): GanttEvent<TData> | undefined {
			return getState().events.find((event: GanttEvent<TData>): boolean => event.id === id);
		},
		setEvents(events: readonly GanttEvent<TData>[]): void {
			setEvents(events);
		},
		addEvent(event: GanttEvent<TData>): void {
			setEvents([...getState().events, event]);
		},
		updateEvent(id: GanttBarId, patch: Partial<GanttEvent<TData>>): void {
			const event = api.getEvent(id);
			if (event === undefined) {
				return;
			}
			const merged: GanttEvent<TData> = { ...event, ...patch };
			const { start, end, allDay, ...rest } = patch;
			const timingChanged = start !== undefined || end !== undefined || allDay !== undefined;
			if (timingChanged && settings.onEventUpdate !== undefined) {
				// timing + rest commit as ONE events emission (a rejected update drops the whole patch)
				applyUpdate({ event: merged, occurrence: null, start: merged.start, end: merged.end, allDay: merged.allDay ?? false, source: "api" }, rest);
				return;
			}
			setEvents(getState().events.map((candidate: GanttEvent<TData>): GanttEvent<TData> => (candidate.id === id ? merged : candidate)));
		},
		removeEvent(id: GanttBarId): void {
			setEvents(getState().events.filter((event: GanttEvent<TData>): boolean => event.id !== id));
		},
		getOccurrences(range?: GanttDateRange): readonly GanttOccurrence<TData>[] {
			if (range === undefined) {
				return getIndex().occurrences;
			}
			const state = getState();
			if (range.start >= state.visibleRange.start && range.end <= state.visibleRange.end) {
				return getIndex().occurrences.filter((occurrence: GanttOccurrence<TData>): boolean => eventsOverlap(occurrence, range));
			}
			return buildIndex(state.events, range).occurrences;
		},
		findOverlapping(candidate: GanttOverlapQuery): readonly GanttOccurrence<TData>[] {
			return api
				.getOccurrences({ start: candidate.start, end: candidate.end })
				.filter((occurrence: GanttOccurrence<TData>): boolean => occurrence.eventId !== candidate.excludeEventId);
		},
		select(partial: Partial<GanttSelection>): void {
			const current = getState().selection;
			setSelection({ eventKeys: partial.eventKeys ?? current.eventKeys, slot: partial.slot === undefined ? current.slot : partial.slot });
		},
		selectEvent(key: string, selectOptions?: GanttSelectEventOptions): void {
			const current = getState().selection;
			const isAdditive = selectOptions?.additive === true;
			const toggled = current.eventKeys.includes(key) ? current.eventKeys.filter((candidate: string): boolean => candidate !== key) : [...current.eventKeys, key];
			setSelection({ ...current, eventKeys: isAdditive ? toggled : [key] });
		},
		clearSelection(): void {
			setSelection(EMPTY_SELECTION);
		},
		setInteractions(patch: Partial<GanttInteractions>): void {
			setInteractions({ ...getState().interactions, ...patch });
		},
		getVisibleRange(): GanttDateRange {
			return getState().visibleRange;
		},
		getActiveRange(): GanttDateRange {
			return getState().activeRange;
		},
		toZoned(date: Date): Date {
			return toZoned(date, settings.timeZone);
		},
	};

	// ── clock: one ticker per store, alive only while something reads "now" ──
	let nowSnapshot: number | null = null;
	let nowTimer: ReturnType<typeof setInterval> | undefined;
	const nowListeners = new Set<() => void>();
	const readNow = (): number => {
		nowSnapshot ??= settings.clock.nowEpochMs();
		return nowSnapshot;
	};
	const tickNow = (): void => {
		const next = settings.clock.nowEpochMs();
		if (next === nowSnapshot) {
			return;
		}
		nowSnapshot = next;
		for (const listener of [...nowListeners]) {
			listener();
		}
	};
	const startNowTicker = (): void => {
		nowTimer = setInterval(tickNow, NOW_TICK_MS);
		if (hasGlobalValue("document")) {
			document.addEventListener("visibilitychange", tickNow);
			window.addEventListener("focus", tickNow);
		}
	};
	const stopNowTicker = (): void => {
		if (nowTimer !== undefined) {
			clearInterval(nowTimer);
			nowTimer = undefined;
		}
		if (hasGlobalValue("document")) {
			document.removeEventListener("visibilitychange", tickNow);
			window.removeEventListener("focus", tickNow);
		}
		nowSnapshot = null;
	};

	const internals: GanttInternals<TData> = {
		getIndex,
		setDrag(drag: GanttDragState<TData> | null): void {
			internal.drag = drag;
			invalidate();
			notify();
		},
		setSlotDraft(draft: GanttSlotDraft | null): void {
			internal.slotDraft = draft;
			invalidate();
			notify();
		},
		setViewportCenter(date: Date | null): void {
			if (internal.viewportCenter?.getTime() === date?.getTime()) {
				return;
			}
			internal.viewportCenter = date;
			invalidate();
			notify();
		},
		applyProposedUpdate(update: GanttProposedUpdate<TData>): boolean {
			return applyUpdate(update);
		},
		getSettingsVersion(): number {
			return settingsVersion;
		},
		extendRange(direction: GanttRangeDirection): boolean {
			const state = getState();
			const bounds = settings.rangeBounds;
			if (direction === "before" && bounds?.min !== undefined && state.visibleRange.start.getTime() <= bounds.min.getTime()) {
				return false;
			}
			if (direction === "after" && bounds?.max !== undefined && state.visibleRange.end.getTime() >= bounds.max.getTime()) {
				return false;
			}
			const cap = Math.max(1, settings.maxRangeWindow ?? MAX_RANGE_WINDOW);
			const { before, after } = internal.rangeWindow;
			const canGrow = direction === "before" ? before < cap : after < cap;
			if (canGrow) {
				internal.rangeWindow = direction === "before" ? { before: before + 1, after } : { before, after: after + 1 };
			} else {
				// window at capacity: SLIDE the anchor one period, so travel stays unbounded while the DOM stays bounded
				const next = stepGanttDate(state.scale, state.date, direction === "before" ? -1 : 1, { timeZone: settings.timeZone });
				if (options.date !== undefined) {
					// controlled anchor: propose the slide; nothing changes until the parent adopts it
					settings.onDateChange?.(next);
					return false;
				}
				internal.date = next;
				lastAnchorChangeWasSlide = true;
				settings.onDateChange?.(next);
			}
			invalidate();
			notify();
			return true;
		},
		didAnchorSlide(): boolean {
			return lastAnchorChangeWasSlide;
		},
		subscribeNow(listener: () => void): () => void {
			nowListeners.add(listener);
			if (nowListeners.size === 1) {
				startNowTicker();
			}
			return (): void => {
				nowListeners.delete(listener);
				if (nowListeners.size === 0) {
					stopNowTicker();
				}
			};
		},
		getNowMs(): number {
			return readNow();
		},
	};

	const instance: GanttInstance<TData> = {
		getState,
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return (): void => {
				listeners.delete(listener);
			};
		},
		api,
		get settings(): GanttSettings<TData> {
			return settings;
		},
		internals,
	};

	return {
		instance,
		setOptions(next: GanttStoreOptions<TData>): boolean {
			const previous = options;
			options = next;
			// compare by value: a freshly constructed but equal controlled date must not wipe infinite-scroll growth
			if (previous.date?.getTime() !== next.date?.getTime() || previous.scale !== next.scale) {
				internal.rangeWindow = NO_RANGE_WINDOW;
				lastAnchorChangeWasSlide = false;
			}
			const stateChanged = STATE_KEYS.some((key: keyof UseGanttStateOptions): boolean => previous[key] !== next[key]);
			const settingsChanged = SETTINGS_KEYS.some((key: keyof GanttStoreOptions): boolean => previous[key] !== next[key]);
			const previousClock = settings.clock;
			const keepI18n = previous.labels === next.labels && previous.i18n === next.i18n;
			settings = resolveSettings(next, keepI18n ? settings.i18n : undefined);
			if (settings.clock !== previousClock) {
				nowSnapshot = null;
			}
			if (settingsChanged) {
				settingsVersion += 1;
			}
			const changed = stateChanged || settingsChanged;
			if (changed) {
				invalidate();
				pendingNotify = true;
			}
			return changed;
		},
		flushPendingNotify(): void {
			if (!pendingNotify) {
				return;
			}
			pendingNotify = false;
			notify();
		},
		notify,
		emitRangeIfChanged,
	};
}
