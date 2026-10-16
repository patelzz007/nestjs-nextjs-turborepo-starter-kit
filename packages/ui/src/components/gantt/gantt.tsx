"use client";

// Ported from ReUI (https://reui.io/r/base-vega/gantt.json). Part names, props,
// hooks and `data-slot` attributes match ReUI, so its examples apply, with these
// deliberate deviations:
// - Copy comes from the UI kit labels system (`gantt` family of `UiKitLabels`);
//   the `i18n` prop overrides individual keys for one usage. There is no
//   built-in English fallback (`DEFAULT_GANTT_I18N` is not exported).
// - The event payload type defaults to `GanttData` (any value) instead of
//   `unknown`. The context is payload-erased, so `useGantt()`,
//   `useGanttSettings()`, `useGanttViewConfig()` and `useGanttOccurrences()`
//   take no type argument; a typed instance comes from `useGanttState<TData>()`.
// - "Now" is injectable (`clock`), and the root forwards its ref.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { eventsOverlap, findResource, getGanttDateRange, getRangeKey, toZoned } from "./gantt-lib";
import {
	createGanttStore,
	DEFAULT_ROW_ALIGN,
	DEFAULT_SCHEDULE_MODE,
	resolveScheduleMode,
	type GanttApi,
	type GanttColumnContext,
	type GanttInstance,
	type GanttSettings,
	type UseGanttStateOptions,
} from "./gantt-store";
import type {
	GanttBaseline,
	GanttBaselineVariance,
	GanttData,
	GanttDateRange,
	GanttDragKind,
	GanttEvent,
	GanttHandler,
	GanttInteractions,
	GanttOccurrence,
	GanttOffDaysConfig,
	GanttResource,
	GanttRowAlign,
	GanttScale,
	GanttScheduleMode,
	GanttSegment,
	GanttSelection,
	GanttState,
} from "./gantt-types";

export {
	DEFAULT_INTERACTIONS,
	DEFAULT_ROW_ALIGN,
	DEFAULT_SCHEDULE_MODE,
	EMPTY_SELECTION,
	MAX_RANGE_WINDOW,
	resolveScheduleMode,
	type GanttActivationConfig,
	type GanttApi,
	type GanttCallbacks,
	type GanttColumnContext,
	type GanttCreateTaskContext,
	type GanttInstance,
	type GanttInternals,
	type GanttRangeBounds,
	type GanttSettings,
	type UseGanttStateOptions,
} from "./gantt-store";

/* -------------------------------------------------------------------------- */
/*                               View config                                  */
/* -------------------------------------------------------------------------- */

export interface GanttClassNames {
	readonly nav?: string | undefined;
	readonly toolbar?: string | undefined;
	/** The gantt body (tree + track). */
	readonly view?: string | undefined;
	readonly event?: string | undefined;
	/** The planned-window (baseline) ghost drawn behind a bar. */
	readonly baseline?: string | undefined;
	/** The dependency-arrow layer (an SVG; colour flows from currentColor). */
	readonly dependencies?: string | undefined;
}

export type GanttColumnAlign = "start" | "center" | "end";

/** One extra tree-panel column after the built-in name column. */
export interface GanttColumn {
	/** Stable id; doubles as the default header label. */
	readonly id: string;
	readonly title?: React.ReactNode;
	/** Fixed column width in px. Default 96. */
	readonly width?: number | undefined;
	/** Cell content alignment. Default "start". */
	readonly align?: GanttColumnAlign | undefined;
	/** Cell content per row; omit or return null for an empty cell. */
	readonly render?: ((context: GanttColumnContext) => React.ReactNode) | undefined;
	/** Extra classes on every cell of this column (header included). */
	readonly className?: string | undefined;
}

/** A gridline: false to hide it, true for the default solid stroke, or a style. */
export type GanttGridLine = boolean | "solid" | "dashed";

export interface GanttTimelineLines {
	/** Unit boundary lines running down the timeline. Default solid. */
	readonly vertical?: GanttGridLine | undefined;
	/** Row separator lines running across the timeline. Default solid. */
	readonly horizontal?: GanttGridLine | undefined;
}

export type GanttLineStroke = "solid" | "dashed";

/** Resolved stroke per axis; null means the axis draws nothing. */
export interface GanttResolvedLines {
	readonly vertical: GanttLineStroke | null;
	readonly horizontal: GanttLineStroke | null;
}

export type GanttTimelineLinesOption = GanttTimelineLines | "vertical" | "both" | "none";

function resolveStroke(line: GanttGridLine | undefined): GanttLineStroke | null {
	if (line === false) {
		return null;
	}
	return line === true || line === undefined ? "solid" : line;
}

/**
 * One place decides what the grid draws, so the header lines, the body lines
 * and the row separators can never disagree.
 */
export function resolveTimelineLines(value: GanttTimelineLinesOption | undefined): GanttResolvedLines {
	if (value === "none") {
		return { vertical: null, horizontal: null };
	}
	if (value === "vertical") {
		return { vertical: "solid", horizontal: null };
	}
	if (value === "both" || value === undefined) {
		return { vertical: "solid", horizontal: "solid" };
	}
	return { vertical: resolveStroke(value.vertical), horizontal: resolveStroke(value.horizontal) };
}

/** Layout metrics (rem unless noted); every knob falls back to its default. */
export interface GanttMetrics {
	/** Height of one schedule bar. Default 1.25. */
	readonly laneHeight?: number | undefined;
	/** Gap between stacked schedules in one node. Default 0.1875. */
	readonly laneGap?: number | undefined;
	/** Vertical inset between the row's edges and its block of schedules. Default 0.5. */
	readonly rowPadding?: number | undefined;
	/** Minimum row height. Default 2.5. */
	readonly minRowHeight?: number | undefined;
	/** Drag-drop indicator height, published on the ghost as --gantt-ghost-height. Default 1.25. */
	readonly ghostHeight?: number | undefined;
	/** barLabel "auto" flips the title outside below this bar width. Default 7. */
	readonly autoLabelMin?: number | undefined;
	/** Unit width at zoom 1, per scale. Day scale = width per interval unit. */
	readonly unitWidths?: Partial<Record<GanttScale, number>> | undefined;
	/** Minimum timeline pane width in px. Default 200. */
	readonly minTimelineWidth?: number | undefined;
	/** Scroll distance (px) from an edge that grows the range. Default 160. */
	readonly infiniteScrollEdge?: number | undefined;
}

/** Live gesture snapshot handed to the drag/resize indicator render props. */
export interface GanttDragIndicatorProps<TData extends GanttData = GanttData> {
	readonly occurrence: GanttOccurrence<TData>;
	readonly kind: GanttDragKind;
	/** Proposed (snapped) range of the current gesture step. */
	readonly start: Date;
	readonly end: Date;
	readonly valid: boolean;
	/** The event's planned window, so a custom overlay can keep drawing it mid-gesture. */
	readonly baseline: GanttBaseline | null;
}

/** Slot handed to a custom schedule-hint renderer. */
export interface GanttScheduleHintProps {
	readonly start: Date;
	readonly end: Date;
	readonly resource: GanttResource;
}

/** Parent rollup handed to a custom summary renderer. */
export interface GanttSummaryProps {
	readonly resource: GanttResource;
	readonly start: Date;
	readonly end: Date;
	readonly progress: number | null;
}

/** Planned window handed to a custom baseline renderer. */
export interface GanttBaselineProps<TData extends GanttData = GanttData> {
	readonly event: GanttEvent<TData>;
	readonly start: Date;
	readonly end: Date;
	/** Planned start and end coincide: a point in the plan, not a window. */
	readonly milestone: boolean;
	readonly variance: GanttBaselineVariance;
}

/** Planned NODE window handed to a custom row-baseline renderer. */
export interface GanttRowBaselineProps {
	readonly resource: GanttResource;
	readonly start: Date;
	readonly end: Date;
	readonly milestone: boolean;
	/** Latest actual end across the node's (and a group's subtree's) events against the planned end. */
	readonly variance: GanttBaselineVariance | null;
}

/** Left tree-panel sizing and splitter behaviour. */
export interface GanttTreePanelConfig {
	/** Initial panel width in px. Default 288. */
	readonly width?: number | undefined;
	/** Splitter lower bound in px. Default 180. */
	readonly minWidth?: number | undefined;
	/** Splitter upper bound in px. Default 640. */
	readonly maxWidth?: number | undefined;
	/** Drag/keyboard splitter between the panels. Default true. */
	readonly resizable?: boolean | undefined;
	/** Width of the sticky name column in px. Default 208. */
	readonly nameColumnWidth?: number | undefined;
	/** Fires after any user resize (drag release, keyboard, double-click reset). */
	readonly onWidthChange?: ((width: number) => void) | undefined;
}

export interface GanttZoomRange {
	readonly min?: number | undefined;
	readonly max?: number | undefined;
	readonly step?: number | undefined;
}

/** Row windowing for large trees (rules/19): rows outside the viewport are not rendered. */
export interface GanttRowVirtualization {
	/** Windowing starts once the visible tree has more rows than this. Default 60; 0 always windows. */
	readonly threshold?: number | undefined;
	/** Extra rows rendered above and below the viewport. Default 8. */
	readonly overscanRows?: number | undefined;
}

export interface GanttRenderEventProps<TData extends GanttData = GanttData> {
	readonly occurrence: GanttOccurrence<TData>;
	readonly segment: GanttSegment<TData>;
	readonly isDragging: boolean;
	readonly isSelected: boolean;
}

export interface GanttSummaryProgressContext<TData extends GanttData = GanttData> {
	readonly resource: GanttResource;
	readonly events: readonly GanttEvent<TData>[];
}

export type GanttScrollbars = "custom" | "native";
export type GanttInitialCenter = "now" | "anchor" | Date;
export type GanttNavButtonVariant = "ghost" | "outline" | "secondary" | "default";
export type GanttNavButtonSize = "sm" | "default";
export type GanttBarLabel = "inside" | "outside" | "auto";

/**
 * View-layer configuration: display props and render overrides. These live on
 * <Gantt>, never in the headless options.
 */
export interface GanttViewConfig<TData extends GanttData = GanttData> {
	/** Now-line on the axis. Default on. */
	readonly nowIndicator: boolean;
	/** Day-scale unit interval in minutes: axis units and gridlines follow it. Default 60. */
	readonly interval: number;
	/** "custom" (kit ScrollArea, default) or "native" browser scrollbars. */
	readonly scrollbars: GanttScrollbars;
	/** Placement hint over empty timeline track that opens the schedule flow. Default off. */
	readonly displayScheduleHint: boolean;
	/** Where the viewport opens: "now" (default), "anchor", or an explicit instant. */
	readonly initialCenter: GanttInitialCenter;
	/** Empty-track presses on schedulable rows paint a range through onSelectSlot. Default off. */
	readonly dragCreate: boolean;
	/** "Add task" affordance at the foot of the tree (onCreateTask). Default off. */
	readonly displayCreateTaskHint: boolean;
	/** Floating zoom in/out control over the track. Default on. */
	readonly zoomControl: boolean;
	/** Ctrl/Cmd + wheel (and trackpad pinch) zooms the time range under the pointer. Default on. */
	readonly wheelZoom: boolean;
	/** Nav button variant; all nav buttons follow it. Default "ghost". */
	readonly navButtonVariant: GanttNavButtonVariant;
	/** Nav button size; icon buttons use the icon twin. Default "sm". */
	readonly navButtonSize: GanttNavButtonSize;
	/** Off-day (non-working day) marking on day/week/month scales. Default weekends. */
	readonly offDays?: boolean | GanttOffDaysConfig | undefined;
	/** Extra tree-panel columns after the built-in name column. */
	readonly columns?: readonly GanttColumn[] | undefined;
	/** Consumer slot pinned at the end of the tree-panel header (an add/remove-columns menu). */
	readonly columnsMenu?: React.ReactNode;
	/** Tree-panel width, splitter bounds, and resizability. */
	readonly treePanel?: GanttTreePanelConfig | undefined;
	/** Timeline gridlines: per-axis object form or the "none" / "vertical" / "both" shorthands. Default "vertical". */
	readonly timelineLines: GanttTimelineLinesOption;
	/** Bar title placement: "inside" (default), "outside", or "auto" (outside when too short). */
	readonly barLabel: GanttBarLabel;
	/** Edge chips that scroll to bars outside the visible timeline. Default on. */
	readonly offscreenIndicators: boolean;
	/** Extend the timeline into the past/future while scrolling near an edge. Default on. */
	readonly infiniteScroll: boolean;
	/** Zoom bounds and button step. Default 0.5 – 3, step 0.25. */
	readonly zoomRange?: GanttZoomRange | undefined;
	/** Layout metric overrides. */
	readonly metrics?: GanttMetrics | undefined;
	/** Sticky nav bar. Default off. */
	readonly stickyNav: boolean;
	/** Leaf-row selection checkboxes in the tree panel. Default on. */
	readonly rowCheckboxes: boolean;
	/** Controlled selected row ids; pairs with onSelectedRowsChange. */
	readonly selectedRows?: readonly string[] | undefined;
	readonly onSelectedRowsChange?: ((ids: readonly string[]) => void) | undefined;
	/** Controlled collapsed group ids; pairs with onCollapsedGroupsChange. */
	readonly collapsedGroups?: readonly string[] | undefined;
	/** Initial collapsed group ids (uncontrolled). */
	readonly defaultCollapsedGroups?: readonly string[] | undefined;
	readonly onCollapsedGroupsChange?: ((ids: readonly string[]) => void) | undefined;
	/** Controlled zoom multiplier; pairs with onZoomChange. */
	readonly zoom?: number | undefined;
	/** Initial zoom multiplier (uncontrolled). Default 1. */
	readonly defaultZoom?: number | undefined;
	readonly onZoomChange?: ((zoom: number) => void) | undefined;
	/** Allow drag-create and slot clicks on rows that have children. Default off. */
	readonly parentScheduling: boolean;
	/** Rollup strips on parent rows without bars of their own. Default on. */
	readonly summaryBars: boolean;
	/** Planned windows (baselines) behind bars and rows. Default on. */
	readonly baselineBars: boolean;
	/** Finish-to-start arrows between dependent bars. Default on. */
	readonly dependencyLines: boolean;
	/** How many schedules a tree node may hold. Default "multiple". */
	readonly scheduleMode: GanttScheduleMode;
	/** Vertical placement of a row's content once a node holds several lanes. Default "start". */
	readonly rowAlign: GanttRowAlign;
	/** Row windowing for large trees. */
	readonly rowVirtualization?: GanttRowVirtualization | undefined;
	readonly classNames?: GanttClassNames | undefined;
	readonly renderEvent?: GanttHandler<[props: GanttRenderEventProps<TData>], React.ReactNode> | undefined;
	/** Right-click menu for a bar: return ContextMenu items. */
	readonly renderEventMenu?: GanttHandler<[props: GanttRenderEventProps<TData>], React.ReactNode> | undefined;
	/** Tree-node label (icons, badges); default is the plain title. */
	readonly renderResourceLabel?: ((context: GanttColumnContext) => React.ReactNode) | undefined;
	/** Right-click menu for a tree row: return ContextMenu items. */
	readonly renderResourceMenu?: ((context: GanttColumnContext) => React.ReactNode) | undefined;
	/** Rendered in the timeline body when there are no resources. */
	readonly renderNoResources?: (() => React.ReactNode) | undefined;
	/** Replaces the cursor-following MOVE clone (the gantt owns the positioned wrapper). */
	readonly renderDragPreview?: GanttHandler<[props: GanttDragIndicatorProps<TData>], React.ReactNode> | undefined;
	/** Replaces the RESIZE edge line + status chip. */
	readonly renderResizeIndicator?: GanttHandler<[props: GanttDragIndicatorProps<TData>], React.ReactNode> | undefined;
	/** Replaces the schedule-hint ring + bubble. */
	readonly renderScheduleHint?: ((props: GanttScheduleHintProps) => React.ReactNode) | undefined;
	/** Replaces the parent rollup strip. */
	readonly renderSummary?: ((props: GanttSummaryProps) => React.ReactNode) | undefined;
	/** Replaces the baseline ghost's content. */
	readonly renderBaseline?: GanttHandler<[props: GanttBaselineProps<TData>], React.ReactNode> | undefined;
	/** Replaces the ROW baseline band's content. */
	readonly renderRowBaseline?: ((props: GanttRowBaselineProps) => React.ReactNode) | undefined;
	/** Replaces the rollup MATH: 0-100 (or null to hide) for a group. Default: duration-weighted mean. */
	readonly getSummaryProgress?: GanttHandler<[context: GanttSummaryProgressContext<TData>], number | null> | undefined;
}

/** Day-scale unit interval in minutes. */
const DEFAULT_INTERVAL_MIN = 60;

export const DEFAULT_VIEW_CONFIG: GanttViewConfig = {
	nowIndicator: true,
	interval: DEFAULT_INTERVAL_MIN,
	scrollbars: "custom",
	displayScheduleHint: false,
	initialCenter: "now",
	displayCreateTaskHint: false,
	dragCreate: false,
	zoomControl: true,
	wheelZoom: true,
	navButtonVariant: "ghost",
	navButtonSize: "sm",
	timelineLines: "vertical",
	barLabel: "inside",
	offscreenIndicators: true,
	infiniteScroll: true,
	stickyNav: false,
	rowCheckboxes: true,
	parentScheduling: false,
	summaryBars: true,
	baselineBars: true,
	dependencyLines: true,
	scheduleMode: DEFAULT_SCHEDULE_MODE,
	rowAlign: DEFAULT_ROW_ALIGN,
};

/* -------------------------------------------------------------------------- */
/*                                  Contexts                                  */
/* -------------------------------------------------------------------------- */

/** The payload-erased instance every gantt part reads. */
export const GanttContext = React.createContext<GanttInstance | null>(null);

export const GanttViewConfigContext = React.createContext<GanttViewConfig>(DEFAULT_VIEW_CONFIG);

/* -------------------------------------------------------------------------- */
/*                                   Hooks                                    */
/* -------------------------------------------------------------------------- */

/**
 * Headless root hook — the full gantt engine without any markup. Pass the
 * returned instance to <Gantt calendar={instance}> or drive fully custom UI
 * from instance.getState()/subscribe/api. Reads its copy from the nearest
 * `UiKitLabelsProvider`.
 */
export function useGanttState<TData extends GanttData = GanttData>(options: UseGanttStateOptions<TData> = {}): GanttInstance<TData> {
	const labels = useUiKitLabels("gantt");
	const storeOptions = { ...options, labels };
	const [store] = React.useState(() => createGanttStore<TData>(storeOptions));
	store.setOptions(storeOptions);
	React.useLayoutEffect((): void => {
		store.flushPendingNotify();
	});
	React.useEffect((): void => {
		// onRangeChange fires once for the initial range
		store.emitRangeIfChanged();
	}, [store]);
	return store.instance;
}

/** The stable gantt instance; throws outside <Gantt>. */
export function useGantt(): GanttInstance {
	const instance = React.useContext(GanttContext);
	if (instance === null) {
		throw new Error("useGantt must be used within <Gantt>");
	}
	return instance;
}

export interface UseGanttSelectorOptions<TData extends GanttData, TSelected> {
	/** Read a hoisted instance instead of the surrounding <Gantt>. */
	readonly calendar?: GanttInstance<TData> | undefined;
	readonly isEqual?: ((a: TSelected, b: TSelected) => boolean) | undefined;
}

interface SelectionCache<TSelected> {
	readonly resolve: (next: TSelected, isEqual: (a: TSelected, b: TSelected) => boolean) => TSelected;
}

/** Keeps the last selected value so equal selections keep their identity across renders and store ticks. */
function createSelectionCache<TSelected>(): SelectionCache<TSelected> {
	let last: { readonly value: TSelected } | null = null;
	return {
		resolve(next: TSelected, isEqual: (a: TSelected, b: TSelected) => boolean): TSelected {
			if (last !== null && isEqual(last.value, next)) {
				return last.value;
			}
			last = { value: next };
			return next;
		},
	};
}

/** Fine-grained subscription with equality memoization (Object.is default). */
export function useGanttSelector<TData extends GanttData = GanttData, TSelected = GanttData>(
	selector: GanttHandler<[state: GanttState<TData>], TSelected>,
	options?: UseGanttSelectorOptions<TData, TSelected>,
): TSelected {
	const contextInstance = React.useContext(GanttContext);
	const [cache] = React.useState(createSelectionCache<TSelected>);
	const explicit: GanttInstance | undefined = options?.calendar;
	const instance = explicit ?? contextInstance;
	if (instance === null) {
		throw new Error("useGanttSelector needs a <Gantt> ancestor or an explicit `calendar` option");
	}
	const select: GanttHandler<[state: GanttState], TSelected> = selector;
	const isEqual = options?.isEqual ?? Object.is;
	const getSnapshot = (): TSelected => cache.resolve(select(instance.getState()), isEqual);
	return React.useSyncExternalStore(instance.subscribe, getSnapshot, getSnapshot);
}

/** Subscribes to settings changes only (version counter, not state). */
export function useGanttSettingsVersion(instance: GanttInstance): number {
	return React.useSyncExternalStore(instance.subscribe, instance.internals.getSettingsVersion, instance.internals.getSettingsVersion);
}

/** Resolved settings incl. merged i18n; re-renders only when settings change. */
export function useGanttSettings(): GanttSettings {
	const instance = useGantt();
	useGanttSettingsVersion(instance);
	return instance.settings;
}

/** Root-level display props + render overrides, for view components. */
export function useGanttViewConfig(): GanttViewConfig {
	return React.useContext(GanttViewConfigContext);
}

function readServerNow(): null {
	return null;
}

/**
 * The gantt clock's current tick (epoch ms), refreshed every NOW_TICK_MS and
 * on tab focus. `null` during SSR and hydration, so server and client agree.
 */
export function useGanttNow(): number | null {
	const instance = useGantt();
	return React.useSyncExternalStore(instance.internals.subscribeNow, instance.internals.getNowMs, readServerNow);
}

export interface GanttScaleControls {
	readonly scale: GanttScale;
	readonly setScale: (scale: GanttScale) => void;
}

export function useGanttScale(): GanttScaleControls {
	const instance = useGantt();
	const scale = useGanttSelector((state: GanttState): GanttScale => state.scale);
	return { scale, setScale: instance.api.setScale };
}

interface NavigationSlice {
	readonly date: Date;
	readonly scale: GanttScale;
	readonly visibleRange: GanttDateRange;
	readonly activeRange: GanttDateRange;
	readonly viewportCenter: Date | null;
}

function selectNavigationSlice(state: GanttState): NavigationSlice {
	return { date: state.date, scale: state.scale, visibleRange: state.visibleRange, activeRange: state.activeRange, viewportCenter: state.viewportCenter };
}

function isSameNavigationSlice(a: NavigationSlice, b: NavigationSlice): boolean {
	return (
		a.date.getTime() === b.date.getTime() &&
		a.scale === b.scale &&
		a.viewportCenter?.getTime() === b.viewportCenter?.getTime() &&
		getRangeKey(a.visibleRange) === getRangeKey(b.visibleRange) &&
		getRangeKey(a.activeRange) === getRangeKey(b.activeRange)
	);
}

const NAVIGATION_SELECTOR_OPTIONS: UseGanttSelectorOptions<GanttData, NavigationSlice> = { isEqual: isSameNavigationSlice };

export interface GanttNavigation {
	readonly date: Date;
	/** i18n.functions.formatTitle output for the current view. */
	readonly title: string;
	readonly visibleRange: GanttDateRange;
	readonly activeRange: GanttDateRange;
	readonly next: () => void;
	readonly prev: () => void;
	readonly today: () => void;
	readonly goTo: (date: Date) => void;
	/** True when the anchor period contains now (false until the clock is read on the client). */
	readonly isToday: boolean;
}

export function useGanttNavigation(): GanttNavigation {
	const instance = useGantt();
	const { settings } = instance;
	const slice = useGanttSelector(selectNavigationSlice, NAVIGATION_SELECTOR_OPTIONS);
	useGanttSettingsVersion(instance);
	const nowMs = useGanttNow();
	const isToday = nowMs !== null && nowMs >= slice.activeRange.start.getTime() && nowMs < slice.activeRange.end.getTime();
	// The title names what you are LOOKING at: the visible-center period when the view reports one.
	const titleDate = slice.viewportCenter ?? slice.date;
	const titleActive =
		slice.viewportCenter === null
			? slice.activeRange
			: getGanttDateRange(slice.scale, slice.viewportCenter, { timeZone: settings.timeZone, weekStartsOn: settings.weekStartsOn }).activeRange;
	return {
		date: slice.date,
		title: settings.i18n.functions.formatTitle(slice.scale, {
			date: toZoned(titleDate, settings.timeZone),
			activeRange: titleActive,
			visibleRange: slice.visibleRange,
			locale: settings.locale,
		}),
		visibleRange: slice.visibleRange,
		activeRange: slice.activeRange,
		next: instance.api.next,
		prev: instance.api.prev,
		today: instance.api.today,
		goTo: instance.api.goTo,
		isToday,
	};
}

export interface GanttSelectionControls {
	readonly selection: GanttSelection;
	readonly select: GanttApi["select"];
	readonly selectEvent: GanttApi["selectEvent"];
	readonly clearSelection: GanttApi["clearSelection"];
}

export function useGanttSelection(): GanttSelectionControls {
	const instance = useGantt();
	const selection = useGanttSelector((state: GanttState): GanttSelection => state.selection);
	return { selection, select: instance.api.select, selectEvent: instance.api.selectEvent, clearSelection: instance.api.clearSelection };
}

export interface GanttInteractionControls {
	readonly interactions: GanttInteractions;
	readonly setInteractions: GanttApi["setInteractions"];
}

export function useGanttInteractions(): GanttInteractionControls {
	const instance = useGantt();
	const interactions = useGanttSelector((state: GanttState): GanttInteractions => state.interactions);
	return { interactions, setInteractions: instance.api.setInteractions };
}

/** Occurrence lists equal by key, end instant and event identity (keys encode id + start only). */
export function isSameOccurrenceList(a: readonly GanttOccurrence[], b: readonly GanttOccurrence[]): boolean {
	return (
		a.length === b.length &&
		a.every((occurrence: GanttOccurrence, index: number): boolean => {
			const other = b.at(index);
			return (
				occurrence.key === other?.key &&
				occurrence.start.getTime() === other.start.getTime() &&
				occurrence.end.getTime() === other.end.getTime() &&
				occurrence.event === other.event
			);
		})
	);
}

const OCCURRENCE_SELECTOR_OPTIONS: UseGanttSelectorOptions<GanttData, readonly GanttOccurrence[]> = { isEqual: isSameOccurrenceList };

/** Expanded, sorted occurrences; defaults to the visible range. */
export function useGanttOccurrences(range?: GanttDateRange): readonly GanttOccurrence[] {
	const instance = useGantt();
	return useGanttSelector((): readonly GanttOccurrence[] => instance.api.getOccurrences(range), OCCURRENCE_SELECTOR_OPTIONS);
}

export interface GanttNodeSchedules {
	/** The node itself, or null when the id is not in the tree. */
	readonly node: GanttResource | null;
	/** Cardinality in force for this node (its own override, else the default). */
	readonly scheduleMode: GanttScheduleMode;
	/** The node's occurrences in the visible range, in axis order. */
	readonly schedules: readonly GanttOccurrence[];
	/** Pairs of the node's schedules that overlap in time. */
	readonly conflicts: readonly (readonly [GanttOccurrence, GanttOccurrence])[];
}

/** Every pair of schedules that overlap in time (pure; quadratic in one node's schedules). */
export function findScheduleConflicts(schedules: readonly GanttOccurrence[]): (readonly [GanttOccurrence, GanttOccurrence])[] {
	const conflicts: (readonly [GanttOccurrence, GanttOccurrence])[] = [];
	schedules.forEach((first: GanttOccurrence, firstIndex: number): void => {
		for (const second of schedules.slice(firstIndex + 1)) {
			if (eventsOverlap(first, second)) {
				conflicts.push([first, second]);
			}
		}
	});
	return conflicts;
}

/**
 * Everything a consumer needs to MANAGE one node's schedules without
 * re-deriving layout: the node, its resolved cardinality, its schedules in
 * order, and the pairs that collide. Pure state — it renders nothing.
 */
export function useGanttNodeSchedules(nodeId: string): GanttNodeSchedules {
	const settings = useGanttSettings();
	const viewConfig = useGanttViewConfig();
	const occurrences = useGanttOccurrences();
	return React.useMemo((): GanttNodeSchedules => {
		const node = findResource(settings.resources, nodeId);
		const schedules = occurrences.filter((occurrence: GanttOccurrence): boolean => occurrence.event.resourceId === nodeId);
		return { node, scheduleMode: resolveScheduleMode(node, viewConfig.scheduleMode), schedules, conflicts: findScheduleConflicts(schedules) };
	}, [settings.resources, nodeId, occurrences, viewConfig.scheduleMode]);
}

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

const ganttVariants = cva("flex min-h-0 min-w-0 flex-col text-foreground", {
	variants: {
		variant: {
			default: "",
			outline: "overflow-hidden rounded-lg border bg-card shadow-sm",
		},
		// the root OWNS the type scale: every gantt label inherits it, so one size rescales the whole component
		size: {
			default: "text-xs",
			lg: "text-sm",
		},
		state: {
			default: "",
			loading: "cursor-progress",
		},
	},
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

type GanttViewConfigProps = { readonly [Key in keyof GanttViewConfig]?: GanttViewConfig[Key] | undefined };

export interface GanttProps
	extends UseGanttStateOptions, GanttViewConfigProps, Omit<useRender.ComponentProps<"div">, "children" | "defaultValue">, Omit<VariantProps<typeof ganttVariants>, "state"> {
	/** Adopt a hoisted useGanttState instance; option props are then ignored. */
	readonly calendar?: GanttInstance | undefined;
	/** Imperative escape hatch usable from outside the tree. */
	readonly apiRef?: React.Ref<GanttApi> | undefined;
	readonly children?: React.ReactNode;
}

const NO_OPTIONS: UseGanttStateOptions = {};

/**
 * Root provider + container. Composition contract:
 * <Gantt><GanttNav/><GanttToolbar/><GanttView/></Gantt>
 */
export const Gantt = React.forwardRef<HTMLDivElement, GanttProps>(function Gantt(props, ref): React.ReactElement {
	const {
		calendar,
		apiRef,
		className,
		render,
		children,
		variant,
		size,
		// headless options
		events,
		defaultEvents,
		scale,
		defaultScale,
		date,
		defaultDate,
		selection,
		defaultSelection,
		interactions,
		defaultInteractions,
		loading,
		timeZone,
		locale,
		weekStartsOn,
		slotDuration,
		snapDuration,
		i18n,
		rangeBounds,
		activation,
		maxRangeWindow,
		resources,
		overlap,
		enforceCanDrop,
		getEventPriority,
		eventOrder,
		getOccurrences,
		clock,
		onEventClick,
		onEventDoubleClick,
		onEventUpdate,
		canDropEvent,
		onSlotClick,
		onSelectSlot,
		canSelectSlot,
		onCreateTask,
		canCreateTask,
		onResourceClick,
		onResourceDoubleClick,
		onRangeChange,
		onScaleChange,
		onDateChange,
		onSelectionChange,
		onInteractionsChange,
		onEventsChange,
		onResourceReorder,
		canReorderResource,
		onResourceReorderReject,
		// view config
		nowIndicator,
		interval,
		scrollbars,
		displayScheduleHint,
		initialCenter,
		dragCreate,
		displayCreateTaskHint,
		zoomControl,
		wheelZoom,
		navButtonVariant,
		navButtonSize,
		offDays,
		columns,
		columnsMenu,
		treePanel,
		timelineLines,
		barLabel,
		offscreenIndicators,
		infiniteScroll,
		zoomRange,
		metrics,
		stickyNav,
		rowCheckboxes,
		selectedRows,
		onSelectedRowsChange,
		collapsedGroups,
		defaultCollapsedGroups,
		onCollapsedGroupsChange,
		zoom,
		defaultZoom,
		onZoomChange,
		parentScheduling,
		summaryBars,
		baselineBars,
		dependencyLines,
		scheduleMode,
		rowAlign,
		rowVirtualization,
		classNames,
		renderEvent,
		renderEventMenu,
		renderResourceLabel,
		renderResourceMenu,
		renderNoResources,
		renderDragPreview,
		renderResizeIndicator,
		renderScheduleHint,
		renderSummary,
		renderBaseline,
		renderRowBaseline,
		getSummaryProgress,
		...rest
	} = props;

	const options: UseGanttStateOptions = {
		events,
		defaultEvents,
		scale,
		defaultScale,
		date,
		defaultDate,
		selection,
		defaultSelection,
		interactions,
		defaultInteractions,
		loading,
		timeZone,
		locale,
		weekStartsOn,
		slotDuration,
		snapDuration,
		i18n,
		rangeBounds,
		activation,
		maxRangeWindow,
		resources,
		overlap,
		enforceCanDrop,
		getEventPriority,
		eventOrder,
		getOccurrences,
		clock,
		onEventClick,
		onEventDoubleClick,
		onEventUpdate,
		canDropEvent,
		onSlotClick,
		onSelectSlot,
		canSelectSlot,
		onCreateTask,
		canCreateTask,
		onResourceClick,
		onResourceDoubleClick,
		onRangeChange,
		onScaleChange,
		onDateChange,
		onSelectionChange,
		onInteractionsChange,
		onEventsChange,
		onResourceReorder,
		canReorderResource,
		onResourceReorderReject,
	};
	const own = useGanttState(calendar === undefined ? options : NO_OPTIONS);
	const instance = calendar ?? own;
	React.useImperativeHandle(apiRef, (): GanttApi => instance.api, [instance]);

	// Stable context identity: every row subscribes to this context, so hand out
	// a new object only when a config value actually changed.
	const viewConfig = React.useMemo(
		(): GanttViewConfig => ({
			nowIndicator: nowIndicator ?? DEFAULT_VIEW_CONFIG.nowIndicator,
			interval: interval ?? DEFAULT_VIEW_CONFIG.interval,
			scrollbars: scrollbars ?? DEFAULT_VIEW_CONFIG.scrollbars,
			displayScheduleHint: displayScheduleHint ?? DEFAULT_VIEW_CONFIG.displayScheduleHint,
			initialCenter: initialCenter ?? DEFAULT_VIEW_CONFIG.initialCenter,
			dragCreate: dragCreate ?? DEFAULT_VIEW_CONFIG.dragCreate,
			displayCreateTaskHint: displayCreateTaskHint ?? DEFAULT_VIEW_CONFIG.displayCreateTaskHint,
			zoomControl: zoomControl ?? DEFAULT_VIEW_CONFIG.zoomControl,
			wheelZoom: wheelZoom ?? DEFAULT_VIEW_CONFIG.wheelZoom,
			navButtonVariant: navButtonVariant ?? DEFAULT_VIEW_CONFIG.navButtonVariant,
			navButtonSize: navButtonSize ?? DEFAULT_VIEW_CONFIG.navButtonSize,
			offDays,
			columns,
			columnsMenu,
			treePanel,
			timelineLines: timelineLines ?? DEFAULT_VIEW_CONFIG.timelineLines,
			barLabel: barLabel ?? DEFAULT_VIEW_CONFIG.barLabel,
			offscreenIndicators: offscreenIndicators ?? DEFAULT_VIEW_CONFIG.offscreenIndicators,
			infiniteScroll: infiniteScroll ?? DEFAULT_VIEW_CONFIG.infiniteScroll,
			zoomRange,
			metrics,
			stickyNav: stickyNav ?? DEFAULT_VIEW_CONFIG.stickyNav,
			rowCheckboxes: rowCheckboxes ?? DEFAULT_VIEW_CONFIG.rowCheckboxes,
			selectedRows,
			onSelectedRowsChange,
			collapsedGroups,
			defaultCollapsedGroups,
			onCollapsedGroupsChange,
			zoom,
			defaultZoom,
			onZoomChange,
			parentScheduling: parentScheduling ?? DEFAULT_VIEW_CONFIG.parentScheduling,
			summaryBars: summaryBars ?? DEFAULT_VIEW_CONFIG.summaryBars,
			baselineBars: baselineBars ?? DEFAULT_VIEW_CONFIG.baselineBars,
			dependencyLines: dependencyLines ?? DEFAULT_VIEW_CONFIG.dependencyLines,
			scheduleMode: scheduleMode ?? DEFAULT_VIEW_CONFIG.scheduleMode,
			rowAlign: rowAlign ?? DEFAULT_VIEW_CONFIG.rowAlign,
			rowVirtualization,
			classNames,
			renderEvent,
			renderEventMenu,
			renderResourceLabel,
			renderResourceMenu,
			renderNoResources,
			renderDragPreview,
			renderResizeIndicator,
			renderScheduleHint,
			renderSummary,
			renderBaseline,
			renderRowBaseline,
			getSummaryProgress,
		}),
		[
			nowIndicator,
			interval,
			scrollbars,
			displayScheduleHint,
			initialCenter,
			dragCreate,
			displayCreateTaskHint,
			zoomControl,
			wheelZoom,
			navButtonVariant,
			navButtonSize,
			offDays,
			columns,
			columnsMenu,
			treePanel,
			timelineLines,
			barLabel,
			offscreenIndicators,
			infiniteScroll,
			zoomRange,
			metrics,
			stickyNav,
			rowCheckboxes,
			selectedRows,
			onSelectedRowsChange,
			collapsedGroups,
			defaultCollapsedGroups,
			onCollapsedGroupsChange,
			zoom,
			defaultZoom,
			onZoomChange,
			parentScheduling,
			summaryBars,
			baselineBars,
			dependencyLines,
			scheduleMode,
			rowAlign,
			rowVirtualization,
			classNames,
			renderEvent,
			renderEventMenu,
			renderResourceLabel,
			renderResourceMenu,
			renderNoResources,
			renderDragPreview,
			renderResizeIndicator,
			renderScheduleHint,
			renderSummary,
			renderBaseline,
			renderRowBaseline,
			getSummaryProgress,
		],
	);

	const isLoading = useGanttSelector((state: GanttState): boolean => state.loading, { calendar: instance });
	const element = useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				className: cn(ganttVariants({ variant, size, state: isLoading ? "loading" : "default" }), className),
				children: (
					<>
						{children}
						<div data-slot="gantt-announcer" aria-live="polite" className="sr-only" />
					</>
				),
			},
			rest,
		),
		state: { slot: "gantt" },
	});

	return (
		<GanttContext.Provider value={instance}>
			<GanttViewConfigContext.Provider value={viewConfig}>{element}</GanttViewConfigContext.Provider>
		</GanttContext.Provider>
	);
});

export { ganttVariants };
