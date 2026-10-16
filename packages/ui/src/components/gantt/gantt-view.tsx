"use client";

// Ported from ReUI (https://reui.io/r/base-vega/gantt-view.json). `GanttView`,
// its `interval` prop, the view-config contract and every `data-slot` match
// ReUI, with these deliberate deviations:
// - Layout maths is pure and tested (`gantt-view-layout.ts`); "now" comes from
//   the gantt clock, never a wall-clock read in render.
// - Large trees are windowed (`rowVirtualization`): rows outside the viewport
//   are not rendered (both panes share one window).
// - Bars are keyboard-movable; the panes carry accessible names; the loading
//   overlay is a `role="status"` region; layers use named stacking values.
// - CVA `variant` / `size` axes and a forwarded ref on the root.
import { mergeProps } from "@base-ui/react/merge-props";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { useRender } from "@base-ui/react/use-render";
import { hasGlobalConstructor } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@workspace/ui/components/context-menu";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { Spinner } from "@workspace/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, GripVerticalIcon, MinusIcon, PlusIcon } from "lucide-react";
import * as React from "react";

import {
	isSameOccurrenceList,
	resolveTimelineLines,
	useGantt,
	useGanttNow,
	useGanttSelector,
	useGanttSettings,
	useGanttViewConfig,
	type GanttColumn,
	type GanttColumnContext,
	type GanttLineStroke,
	type UseGanttSelectorOptions,
} from "./gantt";
import { GanttBar } from "./gantt-bar";
import { cancelActiveGanttGestures, GANTT_DEFAULT_COLOR, markGestureEnd, useGanttGestures, useGanttGestureTeardown, wasRecentDrag } from "./gantt-dnd";
import { resolveSnapMinutes } from "./gantt-gesture-math";
import { localeOptions } from "./gantt-i18n";
import {
	buildDependencyPath,
	clampNumber,
	FRACTION_EPSILON,
	getDayKey,
	MS_PER_MINUTE,
	getRangeKey,
	reorderResources,
	resolveEventBaseline,
	toZoned,
	type GanttLaneMemo,
} from "./gantt-lib";
import { DEFAULT_ROW_ALIGN, resolveScheduleMode, type GanttInstance } from "./gantt-store";
import type { GanttData, GanttDateRange, GanttDragKind, GanttEvent, GanttOccurrence, GanttResourceReorder, GanttScale, GanttSegment, GanttState } from "./gantt-types";
import {
	applyDraftLane,
	AUTO_LABEL_MIN_REM,
	buildDependencyEdges,
	buildDescendantIds,
	buildRowBars,
	buildTimelineAxis,
	buildTimelineRows,
	clampTreeToContainer,
	collectDependencySources,
	computeGroupBoundaries,
	computeRowOffsets,
	computeRowWindow,
	computeSubtreeProgress,
	computeUnitFractions,
	fractionOfRange,
	GHOST_HEIGHT_REM,
	hasUniformUnits,
	LANE_GAP_REM,
	LANE_HEIGHT_REM,
	laneBlockRem,
	laneTopRem,
	lowestFreeLane,
	MAX_INTERVAL_MIN,
	MIN_INTERVAL_MIN,
	MIN_ROW_HEIGHT_REM,
	resolveCenterTarget,
	resolveHintStop,
	resolveLabelPlacement,
	ROW_PADDING_REM,
	type DependencyEdge,
	type HintStop,
	type RowWindow,
	type TimelineRow,
	type TimelineRowBars,
	type UnitFraction,
} from "./gantt-view-layout";

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_TREE_PANEL = { width: 288, minWidth: 180, maxWidth: 640, resizable: true, nameColumnWidth: 208 };
const DEFAULT_COLUMN_WIDTH_PX = 96;
const DEFAULT_ZOOM = 1;
const DEFAULT_ZOOM_MIN = 0.5;
const DEFAULT_ZOOM_MAX = 3;
const DEFAULT_ZOOM_STEP = 0.25;
/** Wheel/pinch zoom sensitivity: zoom × e^(−deltaY × this). */
const WHEEL_ZOOM_RATE = 0.002;
/** Below this change a wheel zoom is a no-op and the browser keeps the gesture. */
const WHEEL_ZOOM_EPSILON = 1e-4;
const ZOOM_DECIMALS = 4;
const ZOOM_STEP_DECIMALS = 2;
/** Wheel deltaMode line / page units → px. */
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 400;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const MIN_TIMELINE_WIDTH_PX = 200;
const INFINITE_EDGE_PX = 160;
/** Scroll events this long after the last user gesture still count as user scrolling. */
const USER_SCROLL_WINDOW_MS = 1200;
/** A track within this many px of the pane width has nothing to scroll. */
const SCROLL_SLACK_PX = 8;
/** Splitter keyboard step (px). */
const SPLITTER_KEY_STEP_PX = 16;
/** Header / canvas pan activates after this much travel (px). */
const PAN_ACTIVATION_PX = 4;
/** Indent per tree level (rem). */
const TREE_INDENT_REM = 0.875;
/** Pending-layout retries before centring gives up waiting for a measured pane. */
const MAX_SEAT_ATTEMPTS = 20;
/** Root font size fallback (px per rem) before the document is measured. */
const FALLBACK_REM_PX = 16;
const DEFAULT_VIRTUALIZATION_THRESHOLD = 60;
const DEFAULT_OVERSCAN_ROWS = 8;
/** Smallest rendered bar width (% of the track) so a sliver stays visible. */
const MIN_BAR_WIDTH_PERCENT = 0.5;
const PERCENT = 100;
/** Dependency route clearance, arrowhead size and stroke (rem / px). */
const DEPENDENCY_CLEARANCE_REM = 0.625;
const DEPENDENCY_ARROW_REM = 0.375;
const DEPENDENCY_STROKE_PX = 1.5;
/** Offscreen chips: header clearance, bottom clearance, jump inset and zoom-control dodge (px). */
const CHIP_HEADER_CLEARANCE_PX = 10;
const CHIP_BOTTOM_CLEARANCE_PX = 16;
const CHIP_JUMP_INSET_PX = 24;
const CHIP_EDGE_TOLERANCE_PX = 2;
const CHIP_ZOOM_BAND_PX = 8;
const CHIP_ZOOM_SHIFT_PX = 28;
const TOOLTIP_DELAY_MS = 600;
const TOOLTIP_TIMEOUT_MS = 300;
/** Reorder caret sits this far above the insertion line (px). */
const REORDER_CARET_OFFSET_PX = 4;
/** Fallback grab offset / row height for a reorder whose row was not measured (px). */
const REORDER_FALLBACK_GRAB_PX = 8;
const REORDER_FALLBACK_ROW_PX = 40;

/** In-gantt stacking: the gantt root is an isolated stacking context, so these stay local. */
const GANTT_LAYER = { nowLine: 10, bar: 10, stickyHeader: 30, hint: 30, chips: 30, ghost: 40, chrome: 40, loading: 50, reorder: 60 };

const OFF_DAY_CLASS = "bg-muted/40";
const OFF_DAY_BODY_CLASS =
	"bg-muted/25 bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,color-mix(in_oklab,var(--color-border)_35%,transparent)_5px,color-mix(in_oklab,var(--color-border)_35%,transparent)_6px)]";
const DASHED_LINE_CLASS = "bg-[repeating-linear-gradient(to_bottom,var(--color-border)_0,var(--color-border)_3px,transparent_3px,transparent_6px)]";

const ROW_STATIC_MARK = "";

/* -------------------------------------------------------------------------- */
/*                                Style helpers                               */
/* -------------------------------------------------------------------------- */

type GanttStyle = React.CSSProperties & Partial<Record<"--gantt-event-color" | "--gantt-ghost-height", string>>;

function percent(fraction: number): string {
	return `${String(fraction * PERCENT)}%`;
}

function rem(value: number): string {
	return `${String(value)}rem`;
}

function spanStyle(start: number, width: number): React.CSSProperties {
	return { insetInlineStart: percent(start), width: percent(width) };
}

function lineStyle(fraction: number): React.CSSProperties {
	return { insetInlineStart: `calc(${percent(fraction)} - 1px)` };
}

function flexStyle(weight: number): React.CSSProperties {
	return { flex: `${String(weight)} 0 0px` };
}

/** A lane-height square centred on an instant, clamped into the row box (a milestone). */
function milestoneInset(from: number, laneHeightRem: number): string {
	return `clamp(0rem, ${percent(from)} - ${rem(laneHeightRem / 2)}, 100% - ${rem(laneHeightRem)})`;
}

function windowStyle(from: number, to: number, isMilestone: boolean, laneHeightRem: number, top: number, height: number, color: string | undefined): GanttStyle {
	return {
		"--gantt-event-color": color ?? GANTT_DEFAULT_COLOR,
		insetInlineStart: isMilestone ? milestoneInset(from, laneHeightRem) : percent(from),
		width: isMilestone ? rem(laneHeightRem) : `${String(Math.max((to - from) * PERCENT, MIN_BAR_WIDTH_PERCENT))}%`,
		top: rem(top),
		height: rem(height),
	};
}

function strokeClass(stroke: GanttLineStroke | null): string {
	return stroke === "dashed" ? DASHED_LINE_CLASS : "bg-border";
}

/* -------------------------------------------------------------------------- */
/*                               DOM utilities                                */
/* -------------------------------------------------------------------------- */

/** The pane's scrollable viewport (custom ScrollArea or native host). */
function getPaneViewport(pane: HTMLElement | null): HTMLElement | null {
	return pane?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]") ?? null;
}

/** Distance scrolled from the inline-start edge (RTL reports negative). */
function getScrollStart(viewport: HTMLElement): number {
	return Math.abs(viewport.scrollLeft);
}

function setScrollStart(viewport: HTMLElement, value: number): void {
	viewport.scrollLeft = getComputedStyle(viewport).direction === "rtl" ? -value : value;
}

interface LiveAxis {
	readonly startMs: number;
	readonly endMs: number;
}

/** The axis range as rendered (the DOM may lag React by a frame during growth). */
function readLiveAxis(viewport: HTMLElement): LiveAxis | null {
	const axis = viewport.querySelector<HTMLElement>("[data-gantt-axis]");
	const startMs = Number(axis?.dataset.ganttRangeStart);
	const endMs = Number(axis?.dataset.ganttRangeEnd);
	return axis === null || Number.isNaN(startMs) || Number.isNaN(endMs) ? null : { startMs, endMs };
}

/** Pointer x against an element's TIME axis: the 0..1 fraction and the pixel-snapped offset (RTL mirrored). */
function trackPoint(element: HTMLElement, clientX: number): { readonly fraction: number; readonly offset: number } {
	const rect = element.getBoundingClientRect();
	const isRtl = getComputedStyle(element).direction === "rtl";
	const offset = isRtl ? rect.right - clientX : clientX - rect.left;
	const snapped = isRtl ? rect.right - Math.round(clientX) : Math.round(clientX) - rect.left;
	return { fraction: rect.width > 0 ? offset / rect.width : 0, offset: snapped };
}

function wheelUnitPx(event: WheelEvent, pageHeight: number): number {
	if (event.deltaMode === DOM_DELTA_LINE) {
		return WHEEL_LINE_PX;
	}
	return event.deltaMode === DOM_DELTA_PAGE ? pageHeight : 1;
}

function readRemPx(): number {
	const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
	return Number.isFinite(size) && size > 0 ? size : FALLBACK_REM_PX;
}

function isElement(target: EventTarget | null): target is Element {
	return target instanceof Element;
}

/* -------------------------------------------------------------------------- */
/*                                   Hooks                                    */
/* -------------------------------------------------------------------------- */

function readServerTodayKey(): null {
	return null;
}

/** Today's zoned day key: re-renders only at the midnight rollover, never on the 30s now tick. */
function useTodayKey(instance: GanttInstance, timeZone: string): string | null {
	const getSnapshot = (): string => getDayKey(new Date(instance.internals.getNowMs()), timeZone);
	return React.useSyncExternalStore(instance.internals.subscribeNow, getSnapshot, readServerTodayKey);
}

interface LaneMemory {
	readonly read: () => ReadonlyMap<string, GanttLaneMemo>;
	readonly write: (lanes: ReadonlyMap<string, GanttLaneMemo>) => void;
}

/**
 * Lane memory across layout passes. The pass is idempotent (feeding its own
 * output back produces the same assignment), so a StrictMode double render is
 * a no-op.
 */
function createLaneMemory(): LaneMemory {
	let lanes: ReadonlyMap<string, GanttLaneMemo> = new Map();
	return {
		read(): ReadonlyMap<string, GanttLaneMemo> {
			return lanes;
		},
		write(next: ReadonlyMap<string, GanttLaneMemo>): void {
			lanes = next;
		},
	};
}

function isSameRange(a: GanttDateRange, b: GanttDateRange): boolean {
	return getRangeKey(a) === getRangeKey(b);
}

const RANGE_SELECTOR_OPTIONS: UseGanttSelectorOptions<GanttData, GanttDateRange> = { isEqual: isSameRange };
const OCCURRENCES_SELECTOR_OPTIONS: UseGanttSelectorOptions<GanttData, readonly GanttOccurrence[]> = { isEqual: isSameOccurrenceList };

interface DraftLayout {
	readonly resourceId: string;
	readonly startMs: number;
	readonly endMs: number;
}

function selectDraftLayout(state: GanttState): DraftLayout | null {
	const draft = state.slotDraft;
	return draft?.resourceId === undefined ? null : { resourceId: draft.resourceId, startMs: draft.start.getTime(), endMs: draft.end.getTime() };
}

function isSameDraftLayout(a: DraftLayout | null, b: DraftLayout | null): boolean {
	return a === b || (a !== null && b !== null && a.resourceId === b.resourceId && a.startMs === b.startMs && a.endMs === b.endMs);
}

const DRAFT_SELECTOR_OPTIONS: UseGanttSelectorOptions<GanttData, DraftLayout | null> = { isEqual: isSameDraftLayout };

/** Controlled-or-uncontrolled id list (selected rows, collapsed groups). */
function useIdList(
	controlled: readonly string[] | undefined,
	initial: readonly string[] | undefined,
	onChange: ((ids: readonly string[]) => void) | undefined,
): [readonly string[], (next: readonly string[]) => void] {
	const [internal, setInternal] = React.useState<readonly string[]>(initial ?? []);
	const value = controlled ?? internal;
	const setValue = React.useCallback(
		(next: readonly string[]): void => {
			if (controlled === undefined) {
				setInternal(next);
			}
			onChange?.(next);
		},
		[controlled, onChange],
	);
	return [value, setValue];
}

interface ReorderState {
	readonly resourceId: string;
	/** Insertion offset (px) within the tree pane. */
	readonly top: number;
	readonly valid: boolean;
	readonly proposal: GanttResourceReorder | null;
}

interface PendingRestore {
	readonly ms: number;
	readonly align: "start" | "center";
	readonly offsetPx?: number | undefined;
}

/* -------------------------------------------------------------------------- */
/*                                  GanttView                                 */
/* -------------------------------------------------------------------------- */

export const ganttViewVariants = cva("flex min-h-0 flex-1 flex-col overflow-hidden", {
	variants: {
		variant: { default: "", outline: "rounded-lg border" },
		size: { default: "", sm: "", lg: "" },
		state: { default: "", loading: "" },
	},
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

export interface GanttViewProps extends useRender.ComponentProps<"div">, Omit<VariantProps<typeof ganttViewVariants>, "state"> {
	/** Day-scale unit interval in minutes; defaults to the interval view config. */
	readonly interval?: number | undefined;
}

export const GanttView = React.forwardRef<HTMLDivElement, GanttViewProps>(function GanttView(
	{ className, render, interval: intervalProp, variant, size, ...props },
	ref,
): React.ReactElement {
	const instance = useGantt();
	const settings = useGanttSettings();
	const viewConfig = useGanttViewConfig();
	const { timeZone, locale, i18n } = settings;
	const range = useGanttSelector((state: GanttState): GanttDateRange => state.visibleRange, RANGE_SELECTOR_OPTIONS);
	const occurrences = useGanttSelector((): readonly GanttOccurrence[] => instance.api.getOccurrences(), OCCURRENCES_SELECTOR_OPTIONS);
	const scale = useGanttSelector((state: GanttState): GanttScale => state.scale);
	const allEvents = useGanttSelector((state: GanttState): readonly GanttEvent[] => state.events);
	const isLoading = useGanttSelector((state: GanttState): boolean => state.loading);
	const anchorMs = useGanttSelector((state: GanttState): number => state.date.getTime());
	const draftLayout = useGanttSelector(selectDraftLayout, DRAFT_SELECTOR_OPTIONS);
	const todayKey = useTodayKey(instance, timeZone);
	const nowMs = useGanttNow();

	const [collapsedIds, setCollapsedIds] = useIdList(viewConfig.collapsedGroups, viewConfig.defaultCollapsedGroups, viewConfig.onCollapsedGroupsChange);
	const collapsedSet = React.useMemo((): ReadonlySet<string> => new Set(collapsedIds), [collapsedIds]);
	const [selectedRows, setSelectedRows] = useIdList(viewConfig.selectedRows, undefined, viewConfig.onSelectedRowsChange);
	const selectedSet = React.useMemo((): ReadonlySet<string> => new Set(selectedRows), [selectedRows]);

	const interval = clampNumber(intervalProp ?? viewConfig.interval, MIN_INTERVAL_MIN, MAX_INTERVAL_MIN);
	const metrics = viewConfig.metrics;
	const laneHeightRem = metrics?.laneHeight ?? LANE_HEIGHT_REM;
	const laneGapRem = metrics?.laneGap ?? LANE_GAP_REM;
	const rowPaddingRem = metrics?.rowPadding ?? ROW_PADDING_REM;
	const minRowRem = metrics?.minRowHeight ?? MIN_ROW_HEIGHT_REM;
	const ghostHeightRem = metrics?.ghostHeight ?? GHOST_HEIGHT_REM;
	const autoLabelMinRem = metrics?.autoLabelMin ?? AUTO_LABEL_MIN_REM;
	const minTimelineWidth = metrics?.minTimelineWidth ?? MIN_TIMELINE_WIDTH_PX;
	const infiniteEdgePx = metrics?.infiniteScrollEdge ?? INFINITE_EDGE_PX;
	const unitWidths = metrics?.unitWidths;
	const rangeStartMs = range.start.getTime();
	const rangeEndMs = range.end.getTime();
	const rangeKey = getRangeKey(range);
	const snapMin = resolveSnapMinutes(scale, settings.snapDuration);

	const rows = React.useMemo((): TimelineRow[] => buildTimelineRows(settings.resources, collapsedSet), [settings.resources, collapsedSet]);
	const axis = React.useMemo(
		() =>
			buildTimelineAxis({
				scale,
				interval,
				range,
				timeZone,
				locale,
				weekStartsOn: settings.weekStartsOn,
				formats: i18n.formats,
				labels: i18n.labels,
				offDays: viewConfig.offDays,
				todayKey,
				unitWidths,
			}),
		[scale, interval, range, timeZone, locale, settings.weekStartsOn, i18n, viewConfig.offDays, todayKey, unitWidths],
	);
	const { units, groups, unitWidthRem } = axis;

	// ----- zoom: controlled (zoom/onZoomChange) or uncontrolled (defaultZoom) -----
	const zoomMin = viewConfig.zoomRange?.min ?? DEFAULT_ZOOM_MIN;
	const zoomMax = viewConfig.zoomRange?.max ?? DEFAULT_ZOOM_MAX;
	const zoomStep = viewConfig.zoomRange?.step ?? DEFAULT_ZOOM_STEP;
	const [internalZoom, setInternalZoom] = React.useState(viewConfig.defaultZoom ?? DEFAULT_ZOOM);
	const zoom = clampNumber(viewConfig.zoom ?? internalZoom, zoomMin, zoomMax);
	const isZoomControlled = viewConfig.zoom !== undefined;
	const onZoomChange = viewConfig.onZoomChange;
	const setZoomValue = React.useCallback(
		(next: number): void => {
			const clamped = clampNumber(next, zoomMin, zoomMax);
			if (!isZoomControlled) {
				setInternalZoom(clamped);
			}
			onZoomChange?.(clamped);
		},
		[zoomMin, zoomMax, isZoomControlled, onZoomChange],
	);
	const canZoomIn = zoom < zoomMax - FRACTION_EPSILON;
	const canZoomOut = zoom > zoomMin + FRACTION_EPSILON;
	const trackRemWidth = units.length * unitWidthRem * zoom;
	const trackWidth = rem(trackRemWidth);
	const isUniform = hasUniformUnits(units);
	const unitFractions = React.useMemo((): UnitFraction[] => computeUnitFractions(units), [units]);
	const groupBoundaries = React.useMemo((): number[] => computeGroupBoundaries(groups, units), [groups, units]);
	const resolveStop = React.useCallback((fraction: number): HintStop | null => resolveHintStop(unitFractions, fraction), [unitFractions]);

	// ----- layout -----
	const descendantIds = React.useMemo((): Map<string, string[]> => buildDescendantIds(settings.resources), [settings.resources]);
	const getSummaryProgress = viewConfig.getSummaryProgress;
	const subtreeProgress = React.useMemo((): Map<string, number | null> => {
		if (getSummaryProgress === undefined) {
			return computeSubtreeProgress(rows, allEvents, descendantIds);
		}
		// consumer-owned rollup math: hand each group its descendant events
		const map = new Map<string, number | null>();
		for (const row of rows) {
			if (row.isGroup) {
				const ids = new Set(descendantIds.get(row.resource.id) ?? []);
				const events = allEvents.filter((event: GanttEvent): boolean => event.resourceId !== undefined && ids.has(event.resourceId));
				map.set(row.resource.id, getSummaryProgress({ resource: row.resource, events }));
			}
		}
		return map;
	}, [rows, allEvents, descendantIds, getSummaryProgress]);
	const [laneMemory] = React.useState(createLaneMemory);
	const geometry = React.useMemo(() => ({ laneHeightRem, laneGapRem, rowPaddingRem, minRowRem }), [laneHeightRem, laneGapRem, rowPaddingRem, minRowRem]);
	const baseRowBars = React.useMemo((): ReadonlyMap<string, TimelineRowBars> => {
		const result = buildRowBars({
			rows,
			occurrences,
			events: allEvents,
			range,
			geometry,
			scheduleMode: viewConfig.scheduleMode,
			summaryBars: viewConfig.summaryBars,
			baselineBars: viewConfig.baselineBars,
			descendantIds,
			subtreeProgress,
			previousLanes: laneMemory.read(),
			eventsLabel: i18n.labels.events,
		});
		laneMemory.write(result.lanes);
		return result.bars;
	}, [
		rows,
		occurrences,
		allEvents,
		range,
		geometry,
		viewConfig.scheduleMode,
		viewConfig.summaryBars,
		viewConfig.baselineBars,
		descendantIds,
		subtreeProgress,
		laneMemory,
		i18n,
	]);
	const rowBars = React.useMemo((): ReadonlyMap<string, TimelineRowBars> => applyDraftLane(baseRowBars, draftLayout, geometry), [baseRowBars, draftLayout, geometry]);
	const dependencySourceIds = React.useMemo(
		(): ReadonlySet<string> => (viewConfig.dependencyLines ? collectDependencySources(allEvents) : new Set<string>()),
		[allEvents, viewConfig.dependencyLines],
	);
	const dependencyEdges = React.useMemo(
		() => (viewConfig.dependencyLines ? buildDependencyEdges({ rows, bars: rowBars, range, trackRemWidth, geometry }) : null),
		[rows, rowBars, range, trackRemWidth, geometry, viewConfig.dependencyLines],
	);

	// ----- split panes -----
	const treeMinWidth = viewConfig.treePanel?.minWidth ?? DEFAULT_TREE_PANEL.minWidth;
	const treeMaxWidth = viewConfig.treePanel?.maxWidth ?? DEFAULT_TREE_PANEL.maxWidth;
	const treeDefaultWidth = viewConfig.treePanel?.width ?? DEFAULT_TREE_PANEL.width;
	const nameColumnWidth = viewConfig.treePanel?.nameColumnWidth ?? DEFAULT_TREE_PANEL.nameColumnWidth;
	const isTreeResizable = viewConfig.treePanel?.resizable ?? DEFAULT_TREE_PANEL.resizable;
	const onTreeWidthChange = viewConfig.treePanel?.onWidthChange;
	const clampTree = React.useCallback((width: number): number => clampNumber(width, treeMinWidth, treeMaxWidth), [treeMinWidth, treeMaxWidth]);
	const [treeWidth, setTreeWidth] = React.useState(treeDefaultWidth);
	const [containerWidth, setContainerWidth] = React.useState(0);
	const clampedTreeWidth = clampTreeToContainer(clampTree(treeWidth), containerWidth, treeMinWidth, minTimelineWidth);
	const columns = viewConfig.columns ?? NO_COLUMNS;

	const bodyRef = React.useRef<HTMLDivElement | null>(null);
	const treePaneRef = React.useRef<HTMLDivElement | null>(null);
	const timelinePaneRef = React.useRef<HTMLDivElement | null>(null);
	const treeRowsRef = React.useRef<HTMLDivElement | null>(null);

	useGanttGestureTeardown();
	// a gesture snapshots geometry at activation, so any geometry change cancels (and reverts) it
	React.useEffect((): void => {
		cancelActiveGanttGestures();
	}, [zoom, scale, rangeKey, clampedTreeWidth, rows.length]);

	// Track the body width (before first paint) so the tree pane can yield on narrow containers.
	React.useLayoutEffect((): (() => void) | undefined => {
		const body = bodyRef.current;
		if (body === null) {
			return undefined;
		}
		const update = (): void => {
			setContainerWidth(body.clientWidth);
		};
		update();
		if (!hasGlobalConstructor("ResizeObserver")) {
			return undefined;
		}
		const observer = new ResizeObserver(update);
		observer.observe(body);
		return (): void => {
			observer.disconnect();
		};
	}, []);

	const beginSplit = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			if (event.button !== 0) {
				return;
			}
			event.preventDefault();
			const pointerId = event.pointerId;
			const startX = event.clientX;
			const startWidth = clampedTreeWidth;
			const splitter = event.currentTarget;
			const direction = getComputedStyle(splitter).direction === "rtl" ? -1 : 1;
			splitter.setAttribute("data-resizing", "");
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			// live width goes straight to the DOM; state commits on release
			let liveWidth = startWidth;
			const onMove = (moveEvent: PointerEvent): void => {
				if (moveEvent.pointerId !== pointerId) {
					return;
				}
				liveWidth = clampTreeToContainer(clampTree(startWidth + (moveEvent.clientX - startX) * direction), bodyRef.current?.clientWidth ?? 0, treeMinWidth, minTimelineWidth);
				if (treePaneRef.current !== null) {
					treePaneRef.current.style.width = `${String(liveWidth)}px`;
				}
			};
			const finish = (endEvent: PointerEvent): void => {
				if (endEvent.pointerId !== pointerId) {
					return;
				}
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", finish);
				window.removeEventListener("pointercancel", finish);
				splitter.removeAttribute("data-resizing");
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				if (liveWidth !== startWidth) {
					setTreeWidth(liveWidth);
					onTreeWidthChange?.(liveWidth);
				}
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", finish);
			window.addEventListener("pointercancel", finish);
		},
		[clampedTreeWidth, clampTree, treeMinWidth, minTimelineWidth, onTreeWidthChange],
	);
	const resetSplit = React.useCallback((): void => {
		setTreeWidth(treeDefaultWidth);
		onTreeWidthChange?.(treeDefaultWidth);
	}, [treeDefaultWidth, onTreeWidthChange]);
	const handleSplitKey = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
				return;
			}
			event.preventDefault();
			const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
			const next = clampTree(clampedTreeWidth + (event.key === "ArrowLeft" ? -SPLITTER_KEY_STEP_PX : SPLITTER_KEY_STEP_PX) * direction);
			setTreeWidth(next);
			onTreeWidthChange?.(next);
		},
		[clampTree, clampedTreeWidth, onTreeWidthChange],
	);

	// Both panes scroll vertically; one wheel handler drives both so they move in the same frame.
	const scrollbars = viewConfig.scrollbars;
	React.useEffect((): (() => void) | undefined => {
		const treeViewport = getPaneViewport(treePaneRef.current);
		const timelineViewport = getPaneViewport(timelinePaneRef.current);
		if (treeViewport === null || timelineViewport === null) {
			return undefined;
		}
		const link = (source: HTMLElement, target: HTMLElement): (() => void) => {
			let lastTop = source.scrollTop;
			const onScroll = (): void => {
				if (source.scrollTop === lastTop) {
					return;
				}
				lastTop = source.scrollTop;
				if (target.scrollTop !== source.scrollTop) {
					target.scrollTop = source.scrollTop;
				}
			};
			source.addEventListener("scroll", onScroll);
			return (): void => {
				source.removeEventListener("scroll", onScroll);
			};
		};
		const unlinkTree = link(treeViewport, timelineViewport);
		const unlinkTimeline = link(timelineViewport, treeViewport);
		const onWheel = (event: WheelEvent): void => {
			// ctrl/cmd (and trackpad pinch) is the zoom gesture
			if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
				return;
			}
			const max = timelineViewport.scrollHeight - timelineViewport.clientHeight;
			if (max <= 0) {
				return;
			}
			const next = clampNumber(timelineViewport.scrollTop + event.deltaY * wheelUnitPx(event, timelineViewport.clientHeight), 0, max);
			event.preventDefault();
			timelineViewport.scrollTop = next;
			treeViewport.scrollTop = next;
		};
		treeViewport.addEventListener("wheel", onWheel, { passive: false });
		timelineViewport.addEventListener("wheel", onWheel, { passive: false });
		return (): void => {
			unlinkTree();
			unlinkTimeline();
			treeViewport.removeEventListener("wheel", onWheel);
			timelineViewport.removeEventListener("wheel", onWheel);
		};
	}, [scale, scrollbars]);

	// Linked row hover: mirror data-hover onto the row's twin in the other pane.
	React.useEffect((): (() => void) | undefined => {
		const body = bodyRef.current;
		if (body === null) {
			return undefined;
		}
		let current: string | null = null;
		const apply = (id: string | null): void => {
			if (id === current) {
				return;
			}
			for (const element of body.querySelectorAll<HTMLElement>("[data-gantt-row-id]")) {
				element.toggleAttribute("data-hover", id !== null && element.dataset.ganttRowId === id);
			}
			current = id;
		};
		const onOver = (event: PointerEvent): void => {
			const row = isElement(event.target) ? event.target.closest<HTMLElement>("[data-gantt-row-id]") : null;
			apply(row?.dataset.ganttRowId ?? null);
		};
		const onLeave = (): void => {
			apply(null);
		};
		body.addEventListener("pointerover", onOver);
		body.addEventListener("pointerleave", onLeave);
		return (): void => {
			body.removeEventListener("pointerover", onOver);
			body.removeEventListener("pointerleave", onLeave);
		};
	}, []);

	// ----- horizontal position: centre the target until the user scrolls -----
	const initialCenter = viewConfig.initialCenter instanceof Date ? viewConfig.initialCenter.getTime() : viewConfig.initialCenter;
	const isInfiniteScroll = viewConfig.infiniteScroll;
	const manageRef = React.useRef({ key: "", buffered: false, userTook: false });
	const pendingRestoreRef = React.useRef<PendingRestore | null>(null);
	const extendLockRef = React.useRef(false);
	const lastUserScrollRef = React.useRef(0);
	const fineCenterRef = React.useRef<number | null>(null);
	const lastZoomRef = React.useRef<number | null>(null);

	React.useLayoutEffect((): (() => void) => {
		const key = `${scale}:${String(anchorMs)}:${scrollbars}`;
		if (manageRef.current.key !== key) {
			// a window SLIDE continues the user's own travel: the guard survives
			const isSlide = manageRef.current.userTook && instance.internals.didAnchorSlide();
			manageRef.current = isSlide ? { key, buffered: manageRef.current.buffered, userTook: true } : { key, buffered: false, userTook: false };
		}
		let waiter: ResizeObserver | null = null;
		const run = (): void => {
			waiter?.disconnect();
			waiter = null;
			const viewport = getPaneViewport(timelinePaneRef.current);
			const axisNode = viewport?.querySelector("[data-gantt-axis]") ?? null;
			if (manageRef.current.userTook || viewport === null || axisNode === null) {
				return;
			}
			if (viewport.clientWidth === 0) {
				// deferred mount (hidden tab): resume on the frame the pane gains a size
				if (hasGlobalConstructor("ResizeObserver")) {
					waiter = new ResizeObserver((): void => {
						if (viewport.clientWidth > 0) {
							run();
						}
					});
					waiter.observe(viewport);
				}
				return;
			}
			// pre-buffer once; the re-run after the range grows lands the centre
			if (isInfiniteScroll && !manageRef.current.buffered) {
				manageRef.current.buffered = true;
				extendLockRef.current = true;
				instance.internals.extendRange("before");
				instance.internals.extendRange("after");
				return;
			}
			extendLockRef.current = false;
			if (viewport.scrollWidth <= viewport.clientWidth) {
				return;
			}
			const target = resolveCenterTarget(initialCenter, anchorMs, instance.internals.getNowMs(), instance.getState().activeRange);
			setScrollStart(viewport, Math.max(0, fractionOfRange(target, rangeStartMs, rangeEndMs) * viewport.scrollWidth - viewport.clientWidth / 2));
		};
		run();
		return (): void => {
			waiter?.disconnect();
		};
	}, [scale, anchorMs, initialCenter, scrollbars, isInfiniteScroll, rangeKey, rangeStartMs, rangeEndMs, instance]);

	// Only user gestures may extend the range — programmatic scrolls never grow it.
	React.useEffect((): (() => void) | undefined => {
		const pane = timelinePaneRef.current;
		if (pane === null) {
			return undefined;
		}
		const markIntent = (): void => {
			lastUserScrollRef.current = performance.now();
		};
		const markWheelIntent = (event: WheelEvent): void => {
			if (!event.ctrlKey && !event.metaKey) {
				markIntent();
			}
		};
		const onPointerDown = (event: PointerEvent): void => {
			if (isElement(event.target) && event.target.closest("[data-slot=scroll-area-scrollbar], [data-slot=gantt-timeline-header], [data-gantt-native-scroll]") !== null) {
				markIntent();
			}
		};
		pane.addEventListener("wheel", markWheelIntent, { passive: true });
		pane.addEventListener("pointerdown", onPointerDown);
		pane.addEventListener("touchstart", markIntent, { passive: true });
		pane.addEventListener("keydown", markIntent);
		return (): void => {
			pane.removeEventListener("wheel", markWheelIntent);
			pane.removeEventListener("pointerdown", onPointerDown);
			pane.removeEventListener("touchstart", markIntent);
			pane.removeEventListener("keydown", markIntent);
		};
	}, []);

	React.useEffect((): (() => void) | undefined => {
		const viewport = getPaneViewport(timelinePaneRef.current);
		if (!isInfiniteScroll || viewport === null) {
			return undefined;
		}
		const tryExtend = (direction: "before" | "after"): void => {
			const live = readLiveAxis(viewport);
			if (live === null) {
				return;
			}
			extendLockRef.current = true;
			manageRef.current.userTook = true;
			// anchor the leading edge as an instant, from the LIVE axis range
			pendingRestoreRef.current = { ms: live.startMs + (getScrollStart(viewport) / viewport.scrollWidth) * (live.endMs - live.startMs), align: "start" };
			if (!instance.internals.extendRange(direction)) {
				pendingRestoreRef.current = null;
				extendLockRef.current = false;
			}
		};
		const isRtl = getComputedStyle(viewport).direction === "rtl";
		const hasNoScroll = (): boolean => viewport.scrollWidth <= viewport.clientWidth + SCROLL_SLACK_PX;
		const onScroll = (): void => {
			if (extendLockRef.current || performance.now() - lastUserScrollRef.current > USER_SCROLL_WINDOW_MS || hasNoScroll()) {
				return;
			}
			const fromStart = getScrollStart(viewport);
			const fromEnd = viewport.scrollWidth - fromStart - viewport.clientWidth;
			if (fromStart < infiniteEdgePx) {
				tryExtend("before");
			} else if (fromEnd < infiniteEdgePx) {
				tryExtend("after");
			}
		};
		// parked exactly on an edge, further wheeling emits no scroll event — the wheel is the growth gesture
		const onWheel = (event: WheelEvent): void => {
			if (event.ctrlKey || event.metaKey || extendLockRef.current || event.deltaX === 0 || hasNoScroll()) {
				return;
			}
			const towardStart = isRtl ? event.deltaX > 0 : event.deltaX < 0;
			if (towardStart && getScrollStart(viewport) <= 0) {
				tryExtend("before");
			} else if (!towardStart && getScrollStart(viewport) + viewport.clientWidth >= viewport.scrollWidth - 1) {
				tryExtend("after");
			}
		};
		viewport.addEventListener("scroll", onScroll);
		viewport.addEventListener("wheel", onWheel, { passive: true });
		return (): void => {
			viewport.removeEventListener("scroll", onScroll);
			viewport.removeEventListener("wheel", onWheel);
		};
	}, [instance, isInfiniteScroll, scale, scrollbars, infiniteEdgePx]);

	// Report the visible-centre instant (coarse-keyed per period) so the nav title follows the scroll.
	React.useEffect((): (() => void) | undefined => {
		const viewport = getPaneViewport(timelinePaneRef.current);
		if (viewport === null) {
			return undefined;
		}
		const keyFormat = PERIOD_KEY_FORMAT[scale];
		let frame = 0;
		let lastKey = "";
		const measure = (): void => {
			frame = 0;
			const live = readLiveAxis(viewport);
			if (live === null) {
				return;
			}
			const fraction = (getScrollStart(viewport) + viewport.clientWidth / 2) / Math.max(1, viewport.scrollWidth);
			const centerMs = live.startMs + fraction * (live.endMs - live.startMs);
			fineCenterRef.current = centerMs;
			const center = new Date(centerMs);
			const key = format(toZoned(center, timeZone), keyFormat);
			if (key !== lastKey) {
				lastKey = key;
				instance.internals.setViewportCenter(center);
			}
		};
		const schedule = (): void => {
			if (frame === 0) {
				frame = requestAnimationFrame(measure);
			}
		};
		viewport.addEventListener("scroll", schedule);
		schedule();
		return (): void => {
			viewport.removeEventListener("scroll", schedule);
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
		};
	}, [instance, scale, timeZone, scrollbars, rangeKey]);

	// Re-seat the viewport on its anchored instant before paint (range growth, slides, zoom).
	React.useLayoutEffect((): (() => void) => {
		// controlled zoom changes carry no anchor: keep the last known centre
		if (lastZoomRef.current !== null && lastZoomRef.current !== zoom && pendingRestoreRef.current === null && fineCenterRef.current !== null) {
			pendingRestoreRef.current = { ms: fineCenterRef.current, align: "center" };
		}
		lastZoomRef.current = zoom;
		let frame: number | null = null;
		let attempts = 0;
		const seat = (): void => {
			frame = null;
			const viewport = getPaneViewport(timelinePaneRef.current);
			const pending = pendingRestoreRef.current;
			if (viewport !== null && pending !== null) {
				if (viewport.clientWidth === 0 && attempts < MAX_SEAT_ATTEMPTS) {
					attempts += 1;
					frame = requestAnimationFrame(seat);
					return;
				}
				pendingRestoreRef.current = null;
				const offset = pending.offsetPx ?? (pending.align === "center" ? viewport.clientWidth / 2 : 0);
				setScrollStart(viewport, Math.max(0, fractionOfRange(pending.ms, rangeStartMs, rangeEndMs) * viewport.scrollWidth - offset));
			}
			extendLockRef.current = false;
		};
		seat();
		return (): void => {
			if (frame !== null) {
				cancelAnimationFrame(frame);
			}
		};
	}, [rangeKey, zoom, rangeStartMs, rangeEndMs, scale, scrollbars, instance]);

	/** Keep the instant at the viewport centre (buttons) or under the pointer (wheel) across a zoom step. */
	const anchorZoom = React.useCallback((clientX: number | null): void => {
		const viewport = getPaneViewport(timelinePaneRef.current);
		const live = viewport === null ? null : readLiveAxis(viewport);
		if (viewport === null || live === null) {
			return;
		}
		const offsetPx = clientX === null ? viewport.clientWidth / 2 : trackPoint(viewport, clientX).offset;
		pendingRestoreRef.current = {
			ms: live.startMs + ((getScrollStart(viewport) + offsetPx) / viewport.scrollWidth) * (live.endMs - live.startMs),
			align: clientX === null ? "center" : "start",
			offsetPx: clientX === null ? undefined : offsetPx,
		};
	}, []);
	const zoomIn = React.useCallback((): void => {
		if (!canZoomIn) {
			return;
		}
		// controlled zoom anchors via the fine centre when the parent adopts it
		if (!isZoomControlled) {
			anchorZoom(null);
		}
		setZoomValue(Number((zoom + zoomStep).toFixed(ZOOM_STEP_DECIMALS)));
	}, [canZoomIn, isZoomControlled, anchorZoom, setZoomValue, zoom, zoomStep]);
	const zoomOut = React.useCallback((): void => {
		if (!canZoomOut) {
			return;
		}
		if (!isZoomControlled) {
			anchorZoom(null);
		}
		setZoomValue(Number((zoom - zoomStep).toFixed(ZOOM_STEP_DECIMALS)));
	}, [canZoomOut, isZoomControlled, anchorZoom, setZoomValue, zoom, zoomStep]);

	// ctrl/cmd + wheel (and pinch) zooms; non-passive so it can preventDefault
	const isWheelZoom = viewConfig.wheelZoom;
	React.useEffect((): (() => void) | undefined => {
		const viewport = getPaneViewport(timelinePaneRef.current);
		if (viewport === null || !isWheelZoom) {
			return undefined;
		}
		const onWheel = (event: WheelEvent): void => {
			if (!event.ctrlKey && !event.metaKey) {
				return;
			}
			const unit = event.deltaMode === DOM_DELTA_LINE ? WHEEL_LINE_PX : event.deltaMode === DOM_DELTA_PAGE ? WHEEL_PAGE_PX : 1;
			const next = clampNumber(zoom * Math.exp(-event.deltaY * unit * WHEEL_ZOOM_RATE), zoomMin, zoomMax);
			// at the limits, hand the gesture back so page zoom still works
			if (Math.abs(next - zoom) < WHEEL_ZOOM_EPSILON) {
				return;
			}
			event.preventDefault();
			if (!isZoomControlled) {
				anchorZoom(event.clientX);
			}
			setZoomValue(Number(next.toFixed(ZOOM_DECIMALS)));
		};
		viewport.addEventListener("wheel", onWheel, { passive: false });
		return (): void => {
			viewport.removeEventListener("wheel", onWheel);
		};
	}, [isWheelZoom, zoom, zoomMin, zoomMax, isZoomControlled, anchorZoom, setZoomValue, scrollbars, scale]);

	// Drag-to-pan from the header and the empty canvas.
	const [isPanning, setPanning] = React.useState(false);
	const beginPan = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
		const viewport = getPaneViewport(timelinePaneRef.current);
		if (event.button !== 0 || viewport === null) {
			return;
		}
		const pointerId = event.pointerId;
		const startX = event.clientX;
		const startLeft = viewport.scrollLeft;
		let active = false;
		const onMove = (moveEvent: PointerEvent): void => {
			if (moveEvent.pointerId !== pointerId) {
				return;
			}
			const dx = moveEvent.clientX - startX;
			if (!active && Math.abs(dx) < PAN_ACTIVATION_PX) {
				return;
			}
			if (!active) {
				markGestureEnd();
				setPanning(true);
			}
			active = true;
			lastUserScrollRef.current = performance.now();
			document.body.style.cursor = "grabbing";
			document.body.style.userSelect = "none";
			viewport.scrollLeft = startLeft - dx;
		};
		const finish = (endEvent: PointerEvent): void => {
			if (endEvent.pointerId !== pointerId) {
				return;
			}
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", finish);
			window.removeEventListener("pointercancel", finish);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			if (active) {
				markGestureEnd();
				setPanning(false);
			}
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", finish);
		window.addEventListener("pointercancel", finish);
	}, []);

	// ----- row virtualization (display state only) -----
	const heightsRem = React.useMemo((): number[] => rows.map((row: TimelineRow): number => rowBars.get(row.resource.id)?.heightRem ?? minRowRem), [rows, rowBars, minRowRem]);
	const rowOffsets = React.useMemo((): number[] => computeRowOffsets(heightsRem), [heightsRem]);
	const virtualizationThreshold = viewConfig.rowVirtualization?.threshold ?? DEFAULT_VIRTUALIZATION_THRESHOLD;
	const overscanRows = viewConfig.rowVirtualization?.overscanRows ?? DEFAULT_OVERSCAN_ROWS;
	const isVirtualized = rows.length > virtualizationThreshold;
	const [viewportBox, setViewportBox] = React.useState({ scrollTopRem: 0, heightRem: 0 });
	React.useEffect((): (() => void) | undefined => {
		const viewport = getPaneViewport(timelinePaneRef.current);
		if (!isVirtualized || viewport === null) {
			return undefined;
		}
		let frame = 0;
		const measure = (): void => {
			frame = 0;
			const remPx = readRemPx();
			const next = { scrollTopRem: viewport.scrollTop / remPx, heightRem: viewport.clientHeight / remPx };
			setViewportBox((previous: { readonly scrollTopRem: number; readonly heightRem: number }) =>
				previous.scrollTopRem === next.scrollTopRem && previous.heightRem === next.heightRem ? previous : next,
			);
		};
		const schedule = (): void => {
			if (frame === 0) {
				frame = requestAnimationFrame(measure);
			}
		};
		viewport.addEventListener("scroll", schedule);
		schedule();
		return (): void => {
			viewport.removeEventListener("scroll", schedule);
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
		};
	}, [isVirtualized, scale, scrollbars]);
	const rowWindow: RowWindow = isVirtualized
		? computeRowWindow(rowOffsets, viewportBox.scrollTopRem, Math.max(viewportBox.heightRem, minRowRem), overscanRows)
		: { start: 0, end: rows.length };
	const visibleRows = rows.slice(rowWindow.start, rowWindow.end);
	const topSpacerRem = rowOffsets.at(rowWindow.start) ?? 0;
	const bottomSpacerRem = (rowOffsets.at(-1) ?? 0) - (rowOffsets.at(rowWindow.end) ?? 0);

	// ----- tree-row drag reorder -----
	const [reorder, setReorder] = React.useState<ReorderState | null>(null);
	const isReorderEnabled = settings.onResourceReorder !== undefined;
	const beginRowReorder = React.useCallback(
		(event: React.PointerEvent<HTMLElement>, dragRow: TimelineRow): void => {
			const currentSettings = instance.settings;
			const container = treeRowsRef.current;
			const pane = treePaneRef.current;
			if (event.button !== 0 || currentSettings.onResourceReorder === undefined || container === null || pane === null) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const rowElements = [...container.querySelectorAll<HTMLElement>("[data-slot=gantt-row-group]")];
			const rects = rowElements.map((element: HTMLElement): DOMRect => element.getBoundingClientRect());
			const rowIndexes = rowElements.map((element: HTMLElement): number => Number(element.dataset.ganttRowIndex));
			const rowElement = event.currentTarget.closest<HTMLElement>("[data-slot=gantt-row-group]");
			const pointerId = event.pointerId;
			const paneRect = pane.getBoundingClientRect();
			document.body.style.cursor = "grabbing";
			document.body.style.userSelect = "none";
			// carry overlay: a flat clone of the WHOLE row, vertical-only, locked to the tree pane
			const overlay = document.createElement("div");
			overlay.setAttribute("data-slot", "gantt-drag-overlay");
			overlay.setAttribute("aria-hidden", "true");
			overlay.className = "pointer-events-none fixed z-popover overflow-hidden bg-background opacity-95";
			const ganttRoot = pane.closest<HTMLElement>("[data-slot=gantt]");
			if (ganttRoot !== null) {
				const rootStyle = getComputedStyle(ganttRoot);
				overlay.style.fontSize = rootStyle.fontSize;
				overlay.style.lineHeight = rootStyle.lineHeight;
				overlay.style.fontFamily = rootStyle.fontFamily;
				overlay.style.direction = rootStyle.direction;
			}
			const grabRect = rowElement?.getBoundingClientRect();
			if (rowElement !== null && grabRect !== undefined) {
				overlay.style.width = `${String(grabRect.width)}px`;
				overlay.style.height = `${String(grabRect.height)}px`;
				const clone = rowElement.cloneNode(true);
				if (clone instanceof HTMLElement) {
					clone.removeAttribute("data-gantt-row-id");
					clone.style.height = "100%";
					overlay.appendChild(clone);
				}
			}
			document.body.appendChild(overlay);
			const grabOffsetY = grabRect === undefined ? REORDER_FALLBACK_GRAB_PX : event.clientY - grabRect.top;
			const lockedX = grabRect?.left ?? paneRect.left;
			const rowHeight = grabRect?.height ?? REORDER_FALLBACK_ROW_PX;
			const place = (y: number): void => {
				overlay.style.left = `${String(lockedX)}px`;
				overlay.style.top = `${String(clampNumber(y - grabOffsetY, paneRect.top, paneRect.bottom - rowHeight))}px`;
			};
			place(event.clientY);
			const propose = (boundary: number): ReorderState => {
				const lastIndex = rowIndexes.at(-1) ?? -1;
				const rowIndex = boundary < rowIndexes.length ? (rowIndexes.at(boundary) ?? lastIndex + 1) : lastIndex + 1;
				const below = rows.at(rowIndex);
				const parentId = below?.parentId ?? rows.at(-1)?.parentId ?? null;
				const index = rows.slice(0, rowIndex).filter((row: TimelineRow): boolean => row.parentId === parentId && row.resource.id !== dragRow.resource.id).length;
				const next = reorderResources(currentSettings.resources, dragRow.resource.id, parentId, index);
				const proposal: GanttResourceReorder | null = next === null ? null : { resourceId: dragRow.resource.id, parentId, index, resources: next };
				const valid = proposal !== null && (currentSettings.canReorderResource?.(proposal) ?? true);
				const boundaryRect = rects.at(boundary);
				const top = (boundaryRect === undefined ? (rects.at(-1)?.bottom ?? paneRect.top) : boundaryRect.top) - paneRect.top;
				return { resourceId: dragRow.resource.id, top, valid, proposal };
			};
			let current: ReorderState | null = null;
			let lastBoundary = -1;
			const onMove = (moveEvent: PointerEvent): void => {
				if (moveEvent.pointerId !== pointerId) {
					return;
				}
				place(moveEvent.clientY);
				const found = rects.findIndex((rect: DOMRect): boolean => moveEvent.clientY < rect.top + rect.height / 2);
				const boundary = found === -1 ? rects.length : found;
				if (boundary === lastBoundary) {
					return;
				}
				lastBoundary = boundary;
				const next = propose(boundary);
				if (current?.top === next.top && current.valid === next.valid) {
					return;
				}
				current = next;
				document.body.style.cursor = next.valid ? "grabbing" : "not-allowed";
				setReorder(next);
			};
			const finish = (commit: boolean): void => {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				window.removeEventListener("pointercancel", onCancel);
				window.removeEventListener("keydown", onKey);
				overlay.remove();
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				const proposal = current?.proposal ?? null;
				if (commit && proposal !== null && current?.valid === false) {
					currentSettings.onResourceReorderReject?.(proposal);
				} else if (commit && proposal !== null && current?.valid === true) {
					currentSettings.onResourceReorder?.(proposal);
					const announcer = ganttRoot?.querySelector("[data-slot=gantt-announcer]");
					if (announcer !== null && announcer !== undefined) {
						announcer.textContent = currentSettings.i18n.labels.announceReorder(dragRow.resource.title);
					}
				}
				setReorder(null);
			};
			const onUp = (upEvent: PointerEvent): void => {
				if (upEvent.pointerId === pointerId) {
					finish(true);
				}
			};
			const onCancel = (cancelEvent: PointerEvent): void => {
				if (cancelEvent.pointerId === pointerId) {
					finish(false);
				}
			};
			const onKey = (keyEvent: KeyboardEvent): void => {
				if (keyEvent.key === "Escape") {
					finish(false);
				}
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			window.addEventListener("pointercancel", onCancel);
			window.addEventListener("keydown", onKey);
		},
		[instance, rows],
	);

	const toggleRow = React.useCallback(
		(row: TimelineRow): void => {
			const id = row.resource.id;
			setCollapsedIds(collapsedIds.includes(id) ? collapsedIds.filter((candidate: string): boolean => candidate !== id) : [...collapsedIds, id]);
		},
		[collapsedIds, setCollapsedIds],
	);
	const toggleRowSelected = React.useCallback(
		(id: string, isChecked: boolean): void => {
			const others = selectedRows.filter((candidate: string): boolean => candidate !== id);
			setSelectedRows(isChecked ? [...others, id] : others);
		},
		[selectedRows, setSelectedRows],
	);
	const onCreateTask = settings.onCreateTask;
	const resourceCount = settings.resources.length;
	const handleCreateTask = React.useCallback((): void => {
		onCreateTask?.({ parentId: null, index: resourceCount });
	}, [onCreateTask, resourceCount]);
	const showCreateTask = viewConfig.displayCreateTaskHint && onCreateTask !== undefined && (settings.canCreateTask?.({ parentId: null }) ?? true);

	const isCustomScrollbars = scrollbars !== "native";
	const gridLines = resolveTimelineLines(viewConfig.timelineLines);
	const customOffDayClass = viewConfig.offDays !== undefined && viewConfig.offDays !== true && viewConfig.offDays !== false ? viewConfig.offDays.className : undefined;
	const offDayClassName = customOffDayClass ?? OFF_DAY_CLASS;
	const offDayBodyClassName = customOffDayClass ?? OFF_DAY_BODY_CLASS;
	const showUnitLines = !isUniform || gridLines.vertical !== null;
	const namePaddingStart = isReorderEnabled ? "3.125rem" : "2.25rem";

	const nameHeaderStyle: React.CSSProperties = { width: nameColumnWidth, paddingInlineStart: namePaddingStart };
	const trackMinWidthStyle: React.CSSProperties = { minWidth: trackWidth };
	const topSpacerStyle: React.CSSProperties = { height: rem(topSpacerRem) };
	const bottomSpacerStyle: React.CSSProperties = { height: rem(bottomSpacerRem) };
	const treePaneStyle: React.CSSProperties = { width: clampedTreeWidth };
	const reorderStyle: React.CSSProperties | undefined = reorder === null ? undefined : { top: reorder.top - REORDER_CARET_OFFSET_PX, zIndex: GANTT_LAYER.reorder };

	const treeContent = (
		<div className={cn("flex min-h-full w-max min-w-full flex-col", isCustomScrollbars && "pb-2.5")}>
			<div data-slot="gantt-tree-header" className="sticky top-0 box-content h-16 shrink-0 border-b border-b-transparent bg-background" style={STICKY_HEADER_STYLE}>
				<div className="flex h-8 border-b">
					<div className="flex h-full min-w-0 flex-1">
						<div className="flex h-full shrink-0 items-center" style={nameHeaderStyle}>
							<span className="truncate font-medium text-muted-foreground">{i18n.labels.resources}</span>
						</div>
						{columns.map((column: GanttColumn): React.JSX.Element => (
							<div
								key={column.id}
								data-slot="gantt-column-header"
								data-column={column.id}
								className={cn("flex h-full shrink-0 items-center px-2 font-medium text-muted-foreground", COLUMN_ALIGN_CLASS[column.align ?? "start"], column.className)}
								style={columnWidthStyle(column)}>
								<span className="truncate">{column.title ?? column.id}</span>
							</div>
						))}
						<div className="min-w-0 flex-1" />
					</div>
					{viewConfig.columnsMenu === undefined || viewConfig.columnsMenu === null ? null : (
						<div
							data-slot="gantt-columns-menu"
							className="sticky end-0 z-sticky flex h-full shrink-0 items-center bg-background ps-1.5 pe-2.5 before:pointer-events-none before:absolute before:inset-y-0 before:-start-5 before:w-5 before:bg-linear-to-l before:from-background before:to-transparent rtl:before:bg-linear-to-r">
							{viewConfig.columnsMenu}
						</div>
					)}
				</div>
			</div>
			<div ref={treeRowsRef} role="tree" aria-label={i18n.labels.resources} className="flex flex-col">
				{isVirtualized ? <div aria-hidden style={topSpacerStyle} /> : null}
				{visibleRows.map((row: TimelineRow, offset: number): React.JSX.Element => (
					<GanttTreeRow
						key={row.resource.id}
						row={row}
						rowIndex={rowWindow.start + offset}
						heightRem={rowBars.get(row.resource.id)?.heightRem ?? minRowRem}
						bandRem={rowBars.get(row.resource.id)?.bandRem ?? minRowRem}
						columns={columns}
						nameWidth={nameColumnWidth}
						isDimmed={reorder?.resourceId === row.resource.id}
						isSelected={selectedSet.has(row.resource.id)}
						onSelectedChange={row.isGroup ? undefined : toggleRowSelected}
						onGripPointerDown={isReorderEnabled ? beginRowReorder : undefined}
						onToggle={toggleRow}
					/>
				))}
				{isVirtualized ? <div aria-hidden style={bottomSpacerStyle} /> : null}
			</div>
			{showCreateTask ? (
				<button
					type="button"
					data-slot="gantt-create-task"
					className="flex h-10 w-full shrink-0 items-center border-b ps-3 pe-3 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
					onClick={handleCreateTask}>
					<span className="flex h-full w-full items-center">
						{isReorderEnabled ? <span aria-hidden className="w-3.5 shrink-0" /> : null}
						<span className="me-1 flex w-5 shrink-0 items-center justify-center">
							<PlusIcon aria-hidden className="size-3.5" />
						</span>
						<span>{i18n.labels.addTask}</span>
					</span>
				</button>
			) : null}
		</div>
	);

	const timelineContent = (
		<div className={cn("flex min-h-full w-max min-w-full grow flex-col", isCustomScrollbars && "pb-2.5")}>
			<div data-slot="gantt-timeline-header" className="sticky top-0 shrink-0 border-b bg-background" style={stickyTrackHeaderStyle(trackWidth)} onPointerDown={beginPan}>
				<div className="relative h-8 border-b">
					<div className="flex h-full">
						{groups.map((group: { readonly key: string; readonly label: string; readonly span: number }): React.JSX.Element => (
							<div key={group.key} data-slot="gantt-axis-group" className="flex min-w-0 items-center ps-3 pe-2 text-muted-foreground" style={flexStyle(group.span)}>
								<span data-slot="gantt-axis-group-label" className="sticky start-3 max-w-full truncate">
									{group.label}
								</span>
							</div>
						))}
					</div>
					{groupBoundaries.map((fraction: number): React.JSX.Element => (
						<span key={fraction} aria-hidden className="absolute inset-y-0 w-px bg-border" style={lineStyle(fraction)} />
					))}
				</div>
				<div data-gantt-axis="" data-gantt-range-start={rangeStartMs} data-gantt-range-end={rangeEndMs} data-gantt-snap={snapMin} className="relative h-8">
					<div aria-hidden className="absolute inset-0">
						{unitFractions.map(({ unit, start, width }: UnitFraction): React.JSX.Element | null =>
							unit.isOff ? <span key={unit.key} className={cn("absolute inset-y-0", offDayClassName)} style={spanStyle(start, width)} /> : null,
						)}
					</div>
					<div className="flex h-full">
						{units.map(
							(unit: { readonly key: string; readonly label: string; readonly weight: number; readonly isToday: boolean; readonly isOff: boolean }): React.JSX.Element => (
								<div
									key={unit.key}
									data-today={unit.isToday ? "" : undefined}
									data-off={unit.isOff ? "" : undefined}
									className={cn("flex min-w-0 items-center justify-center truncate px-1.5 text-center text-muted-foreground", unit.isToday && "font-medium text-primary")}
									style={flexStyle(unit.weight)}>
									{unit.isToday ? <span className="truncate rounded-full bg-primary/10 px-1.5 py-px">{unit.label}</span> : unit.label}
								</div>
							),
						)}
					</div>
					{showUnitLines
						? unitFractions
								.slice(1)
								.map(({ unit, start }: UnitFraction): React.JSX.Element => (
									<span
										key={unit.key}
										aria-hidden
										data-slot="gantt-grid-line"
										data-axis="vertical"
										className={cn("absolute inset-y-0 w-px", strokeClass(gridLines.vertical))}
										style={lineStyle(start)}
									/>
								))
						: null}
					{viewConfig.nowIndicator ? <GanttNowMark kind="dot" nowMs={nowMs} rangeStartMs={rangeStartMs} rangeEndMs={rangeEndMs} /> : null}
				</div>
			</div>
			<div className="relative flex min-h-0 grow flex-col" onPointerDown={beginPan}>
				<div aria-hidden data-slot="gantt-timeline-backdrop" className="pointer-events-none absolute inset-0">
					{unitFractions.map(({ unit, start, width }: UnitFraction): React.JSX.Element => (
						<span key={unit.key} className="contents">
							{unit.isOff ? <span data-off="" className={cn("absolute inset-y-0", offDayBodyClassName)} style={spanStyle(start, width)} /> : null}
							{unit.isToday && scale !== "day" ? <span data-today="" className="absolute inset-y-0 bg-primary/5" style={spanStyle(start, width)} /> : null}
						</span>
					))}
					{gridLines.vertical === null
						? null
						: unitFractions
								.slice(1)
								.map(({ unit, start }: UnitFraction): React.JSX.Element => (
									<span
										key={`grid-${unit.key}`}
										data-slot="gantt-grid-line"
										data-axis="vertical"
										className={cn("absolute inset-y-0 w-px", strokeClass(gridLines.vertical))}
										style={lineStyle(start)}
									/>
								))}
					{viewConfig.nowIndicator ? <GanttNowMark kind="line" nowMs={nowMs} rangeStartMs={rangeStartMs} rangeEndMs={rangeEndMs} /> : null}
				</div>
				{dependencyEdges !== null && dependencyEdges.edges.length > 0 ? (
					<GanttDependencyLayer
						edges={dependencyEdges.edges}
						totalRem={dependencyEdges.totalRem}
						trackRemWidth={trackRemWidth}
						rangeStartMs={rangeStartMs}
						rangeEndMs={rangeEndMs}
						laneHeightRem={laneHeightRem}
						laneGapRem={laneGapRem}
					/>
				) : null}
				{isVirtualized ? <div aria-hidden style={topSpacerStyle} /> : null}
				{visibleRows.map((row: TimelineRow, offset: number): React.JSX.Element => (
					<GanttTimelineRow
						key={row.resource.id}
						row={row}
						rowIndex={rowWindow.start + offset}
						bars={rowBars.get(row.resource.id)}
						rangeStartMs={rangeStartMs}
						rangeEndMs={rangeEndMs}
						trackWidth={trackWidth}
						trackRemWidth={trackRemWidth}
						rowBorder={gridLines.horizontal}
						isSelected={selectedSet.has(row.resource.id)}
						resolveStop={resolveStop}
						isPanning={isPanning}
						laneHeightRem={laneHeightRem}
						laneGapRem={laneGapRem}
						minRowRem={minRowRem}
						ghostHeightRem={ghostHeightRem}
						autoLabelMinRem={autoLabelMinRem}
						dependencySourceIds={dependencySourceIds}
					/>
				))}
				{isVirtualized ? <div aria-hidden style={bottomSpacerStyle} /> : null}
				{rows.length === 0 && viewConfig.renderNoResources !== undefined ? (
					<div data-slot="gantt-no-resources" className="flex grow items-center justify-center p-6 text-sm text-muted-foreground">
						{viewConfig.renderNoResources()}
					</div>
				) : null}
				{showCreateTask ? <div aria-hidden data-slot="gantt-create-task-spacer" className="h-10 border-b" style={trackMinWidthStyle} /> : null}
			</div>
		</div>
	);

	const horizontalScrollbar = <ScrollBar orientation="horizontal" className="end-0 h-4 rounded-none border-t-border bg-background py-1" style={SCROLLBAR_STYLE} />;
	const offscreenRefreshKey = `${scale}:${rangeKey}:${String(zoom)}:${String(rows.length)}:${String(clampedTreeWidth)}:${scrollbars}`;

	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				...scaleAttribute(scale),
				"aria-busy": isLoading ? true : undefined,
				className: cn(ganttViewVariants({ variant, size, state: isLoading ? "loading" : "default" }), viewConfig.classNames?.view, className),
				children: (
					<div ref={bodyRef} className="relative isolate flex min-h-0 flex-1">
						<div ref={treePaneRef} data-slot="gantt-tree-pane" role="region" aria-label={i18n.labels.resources} className="relative h-full shrink-0" style={treePaneStyle}>
							{isCustomScrollbars ? (
								<ScrollArea key={scale} className="h-full [&>[data-orientation=vertical]]:hidden">
									<ScrollAreaPrimitive.Content>{treeContent}</ScrollAreaPrimitive.Content>
									{horizontalScrollbar}
								</ScrollArea>
							) : (
								<div data-slot="scroll-area-viewport" data-gantt-native-scroll="" className="h-full overflow-x-auto overflow-y-hidden overscroll-contain">
									{treeContent}
								</div>
							)}
							{isCustomScrollbars ? (
								<div
									aria-hidden
									data-slot="gantt-tree-scrollbar-rail"
									className="pointer-events-none absolute inset-x-0 bottom-0 h-4 border-t border-t-border bg-background"
								/>
							) : null}
							{reorder === null ? null : (
								<div
									data-slot="gantt-reorder-indicator"
									data-invalid={reorder.valid ? undefined : ""}
									className="pointer-events-none absolute inset-x-0 flex items-center"
									style={reorderStyle}>
									<span className={cn("ms-0.5 size-0 shrink-0 border-y-4 border-s-8 border-y-transparent", reorder.valid ? "border-s-primary" : "border-s-destructive")} />
									<span className={cn("h-px min-w-0 flex-1", reorder.valid ? "bg-primary" : "bg-destructive")} />
								</div>
							)}
						</div>
						{isTreeResizable ? (
							<div
								role="slider"
								aria-orientation="horizontal"
								aria-label={i18n.labels.resizePanel}
								aria-valuenow={Math.round(clampedTreeWidth)}
								aria-valuemin={Math.round(Math.min(treeMinWidth, clampedTreeWidth))}
								aria-valuemax={Math.round(Math.max(treeMaxWidth, clampedTreeWidth))}
								tabIndex={0}
								data-slot="gantt-splitter"
								className={cn(
									"group/gantt-splitter relative w-px shrink-0 cursor-col-resize touch-none bg-border outline-none hover:bg-primary/60 data-resizing:bg-primary",
									"focus-visible:ring-2 focus-visible:ring-ring/50",
									"after:absolute after:inset-y-0 after:-start-1 after:-end-1",
								)}
								style={STICKY_HEADER_STYLE}
								onPointerDown={beginSplit}
								onDoubleClick={resetSplit}
								onKeyDown={handleSplitKey}>
								<span
									aria-hidden
									data-slot="gantt-splitter-grip"
									className="absolute top-1/2 left-1/2 h-6 w-0.75 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/60 opacity-0 group-hover/gantt-splitter:opacity-100 group-focus-visible/gantt-splitter:opacity-100 group-data-resizing/gantt-splitter:bg-primary group-data-resizing/gantt-splitter:opacity-100 motion-safe:transition-opacity"
								/>
							</div>
						) : (
							<div aria-hidden className="w-px shrink-0 bg-border" />
						)}
						<div ref={timelinePaneRef} data-slot="gantt-timeline-pane" role="region" aria-label={i18n.labels.timeline} className="relative h-full min-w-0 flex-1">
							{viewConfig.zoomControl ? (
								<div
									data-slot="gantt-zoom"
									className="absolute end-[calc(0.75rem+var(--gantt-zoom-shift,0px))] bottom-5 flex flex-col rounded-md border bg-background shadow-sm motion-safe:transition-[inset-inline-end] motion-safe:duration-200"
									style={CHROME_STYLE}>
									<TooltipProvider delay={TOOLTIP_DELAY_MS} closeDelay={0} timeout={TOOLTIP_TIMEOUT_MS}>
										<GanttZoomButton label={i18n.labels.zoomIn} isEnabled={canZoomIn} onClick={zoomIn} edge="top">
											<PlusIcon aria-hidden className="size-3" />
										</GanttZoomButton>
										<GanttZoomButton label={i18n.labels.zoomOut} isEnabled={canZoomOut} onClick={zoomOut} edge="bottom">
											<MinusIcon aria-hidden className="size-3" />
										</GanttZoomButton>
									</TooltipProvider>
								</div>
							) : null}
							{isCustomScrollbars ? (
								<ScrollArea
									key={scale}
									className="h-full [&>[data-orientation=vertical]]:top-[65px]! [&>[data-orientation=vertical]]:bottom-4! [&>[data-orientation=vertical]]:h-auto!">
									<ScrollAreaPrimitive.Content className="flex min-h-full flex-col">{timelineContent}</ScrollAreaPrimitive.Content>
									{horizontalScrollbar}
								</ScrollArea>
							) : (
								<div data-slot="scroll-area-viewport" data-gantt-native-scroll="" className="h-full overflow-auto overscroll-contain">
									{timelineContent}
								</div>
							)}
							{isCustomScrollbars ? (
								<div
									aria-hidden
									data-slot="gantt-timeline-scrollbar-rail"
									className="pointer-events-none absolute inset-x-0 bottom-0 h-4 border-t border-t-border bg-background"
								/>
							) : null}
							{viewConfig.offscreenIndicators ? <GanttOffscreenChips paneRef={timelinePaneRef} occurrences={occurrences} refreshKey={offscreenRefreshKey} /> : null}
						</div>
						{isLoading ? (
							<div
								data-slot="gantt-loading"
								role="status"
								className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 text-sm text-muted-foreground"
								style={LOADING_STYLE}>
								<Spinner aria-hidden className="size-4" />
								<span>{i18n.labels.loading}</span>
							</div>
						) : null}
						{viewConfig.renderDragPreview !== undefined || viewConfig.renderResizeIndicator !== undefined ? <GanttCustomDragLayer /> : null}
					</div>
				),
			},
			props,
		),
		state: { slot: "gantt-view" },
	});
});

const NO_COLUMNS: readonly GanttColumn[] = [];

const PERIOD_KEY_FORMAT: Readonly<Record<GanttScale, string>> = { day: "yyyy-MM-dd", week: "RRRR-'W'II", month: "yyyy-MM", quarter: "yyyy-qqq", year: "yyyy" };

const COLUMN_ALIGN_CLASS: Readonly<Record<"start" | "center" | "end", string>> = { start: "", center: "justify-center", end: "justify-end" };

const STICKY_HEADER_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.stickyHeader };
const CHROME_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.chrome };
const SCROLLBAR_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.chrome };
const LOADING_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.loading };
const CONTENT_LAYER_STYLE: React.CSSProperties = { contentVisibility: "auto" };
const HIDDEN_STYLE: React.CSSProperties = { visibility: "hidden" };

function scaleAttribute(scale: GanttScale): Readonly<Record<"data-scale", GanttScale>> {
	return { "data-scale": scale };
}

function stickyTrackHeaderStyle(trackWidth: string): React.CSSProperties {
	return { minWidth: trackWidth, zIndex: GANTT_LAYER.stickyHeader };
}

function columnWidthStyle(column: GanttColumn): React.CSSProperties {
	return { width: column.width ?? DEFAULT_COLUMN_WIDTH_PX };
}

/* -------------------------------------------------------------------------- */
/*                                 Sub-parts                                  */
/* -------------------------------------------------------------------------- */

interface GanttZoomButtonProps {
	readonly label: string;
	readonly isEnabled: boolean;
	readonly onClick: () => void;
	readonly edge: "top" | "bottom";
	readonly children: React.ReactNode;
}

/** aria-disabled (not disabled) so the not-allowed cursor still shows at the zoom limits. */
function GanttZoomButton({ label, isEnabled, onClick, edge, children }: GanttZoomButtonProps): React.JSX.Element {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label={label}
						aria-disabled={isEnabled ? undefined : true}
						className={cn(
							"size-5! text-muted-foreground hover:text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent",
							edge === "top" ? "rounded-b-none" : "rounded-t-none border-t",
						)}
						onClick={onClick}
					/>
				}>
				{children}
			</TooltipTrigger>
			<TooltipContent side="left">{label}</TooltipContent>
		</Tooltip>
	);
}

interface GanttNowMarkProps {
	readonly kind: "line" | "dot";
	readonly nowMs: number | null;
	readonly rangeStartMs: number;
	readonly rangeEndMs: number;
}

/** The now-line (body) or its dot cap (header). Hidden until the client has read the clock. */
function GanttNowMark({ kind, nowMs, rangeStartMs, rangeEndMs }: GanttNowMarkProps): React.JSX.Element | null {
	if (nowMs === null || nowMs < rangeStartMs || nowMs >= rangeEndMs) {
		return null;
	}
	const style: React.CSSProperties = { insetInlineStart: percent(fractionOfRange(nowMs, rangeStartMs, rangeEndMs)), zIndex: GANTT_LAYER.nowLine };
	return kind === "line" ? (
		<div data-slot="gantt-now-indicator" className="absolute inset-y-0 w-px bg-linear-to-b from-destructive/80 via-destructive/45 to-destructive/15" style={style} />
	) : (
		<span aria-hidden data-slot="gantt-now-dot" className="absolute -bottom-0.75 size-1.5 -translate-x-1/2 rounded-full bg-destructive" style={style} />
	);
}

/** Consumer-owned drag/resize indicators: React content, engine-positioned wrapper. */
function GanttCustomDragLayer(): React.JSX.Element | null {
	const viewConfig = useGanttViewConfig();
	const drag = useGanttSelector((state: GanttState): GanttState["drag"] => state.drag);
	if (drag === null) {
		return null;
	}
	const renderIndicator = drag.kind === "move" ? viewConfig.renderDragPreview : viewConfig.renderResizeIndicator;
	if (renderIndicator === undefined) {
		return null;
	}
	return (
		<div
			data-slot={drag.kind === "move" ? "gantt-drag-overlay" : "gantt-resize-indicator"}
			data-custom=""
			className="pointer-events-none fixed top-0 left-0 z-popover will-change-transform"
			style={HIDDEN_STYLE}>
			{renderIndicator({
				occurrence: drag.occurrence,
				kind: drag.kind,
				start: drag.proposedStart,
				end: drag.proposedEnd,
				valid: drag.valid,
				baseline: resolveEventBaseline(drag.occurrence.event),
			})}
		</div>
	);
}

interface DragLink {
	readonly eventId: string;
	readonly startMs: number;
	readonly endMs: number;
}

function selectDragLink(state: GanttState): DragLink | null {
	return state.drag === null ? null : { eventId: state.drag.occurrence.eventId, startMs: state.drag.proposedStart.getTime(), endMs: state.drag.proposedEnd.getTime() };
}

function isSameDragLink(a: DragLink | null, b: DragLink | null): boolean {
	return a === b || (a !== null && b !== null && a.eventId === b.eventId && a.startMs === b.startMs && a.endMs === b.endMs);
}

const DRAG_LINK_OPTIONS: UseGanttSelectorOptions<GanttData, DragLink | null> = { isEqual: isSameDragLink };

interface GanttDependencyLayerProps {
	readonly edges: readonly DependencyEdge[];
	readonly totalRem: number;
	readonly trackRemWidth: number;
	readonly rangeStartMs: number;
	readonly rangeEndMs: number;
	readonly laneHeightRem: number;
	readonly laneGapRem: number;
}

/**
 * The dependency-arrow overlay: one SVG whose user unit is 1rem at the track's
 * natural width, stretched to the row width. While a gesture is in flight the
 * dragged event's endpoints follow the proposed range.
 */
const GanttDependencyLayer = React.memo(function GanttDependencyLayer({
	edges,
	totalRem,
	trackRemWidth,
	rangeStartMs,
	rangeEndMs,
	laneHeightRem,
	laneGapRem,
}: GanttDependencyLayerProps): React.JSX.Element {
	const viewConfig = useGanttViewConfig();
	const dragLink = useGanttSelector(selectDragLink, DRAG_LINK_OPTIONS);
	const liveX = (ms: number): number => fractionOfRange(ms, rangeStartMs, rangeEndMs) * trackRemWidth;
	const style: React.CSSProperties = { height: rem(totalRem) };
	return (
		<svg
			aria-hidden
			data-slot="gantt-dependencies"
			className={cn("pointer-events-none absolute start-0 top-0 w-full overflow-visible text-muted-foreground/70 rtl:-scale-x-100", viewConfig.classNames?.dependencies)}
			style={style}
			viewBox={`0 0 ${String(trackRemWidth)} ${String(totalRem)}`}
			preserveAspectRatio="none">
			{edges.map((edge: DependencyEdge): React.JSX.Element => {
				const isDragged = dragLink !== null && (edge.fromId === dragLink.eventId || edge.toId === dragLink.eventId);
				const fromX = dragLink !== null && edge.fromId === dragLink.eventId ? liveX(dragLink.endMs) : edge.fromX;
				const toX = dragLink !== null && edge.toId === dragLink.eventId ? liveX(dragLink.startMs) : edge.toX;
				const geometry = buildDependencyPath(
					{ x: fromX, y: edge.fromY },
					{ x: toX, y: edge.toY },
					{ clearance: DEPENDENCY_CLEARANCE_REM, laneStep: laneHeightRem / 2 + laneGapRem, arrowSize: DEPENDENCY_ARROW_REM },
				);
				return (
					<g key={edge.key} data-slot="gantt-dependency" data-dragging={isDragged ? "" : undefined} className={isDragged ? "opacity-50" : undefined}>
						<path d={geometry.line} fill="none" stroke="currentColor" strokeWidth={DEPENDENCY_STROKE_PX} vectorEffect="non-scaling-stroke" />
						<path d={geometry.arrow} fill="currentColor" />
					</g>
				);
			})}
		</svg>
	);
});

interface GanttTreeRowProps {
	readonly row: TimelineRow;
	readonly rowIndex: number;
	readonly heightRem: number;
	readonly bandRem: number;
	readonly columns: readonly GanttColumn[];
	readonly nameWidth: number;
	readonly isDimmed: boolean;
	readonly isSelected: boolean;
	readonly onSelectedChange?: ((id: string, isChecked: boolean) => void) | undefined;
	readonly onGripPointerDown?: ((event: React.PointerEvent<HTMLElement>, row: TimelineRow) => void) | undefined;
	readonly onToggle: (row: TimelineRow) => void;
}

/** Chrome clicks (chevron, checkbox, grip) are their own actions, not row clicks. */
function isChromeClick(target: EventTarget): boolean {
	return isElement(target) && target.closest("button, [role=checkbox]") !== null;
}

/** Memoized: only rows whose props actually changed re-render. */
const GanttTreeRow = React.memo(function GanttTreeRow({
	row,
	rowIndex,
	heightRem,
	bandRem,
	columns,
	nameWidth,
	isDimmed,
	isSelected,
	onSelectedChange,
	onGripPointerDown,
	onToggle,
}: GanttTreeRowProps): React.JSX.Element {
	const settings = useGanttSettings();
	const viewConfig = useGanttViewConfig();
	const context = React.useMemo(
		(): GanttColumnContext => ({ resource: row.resource, depth: row.depth, isGroup: row.isGroup, collapsed: row.collapsed }),
		[row.resource, row.depth, row.isGroup, row.collapsed],
	);
	const isAlignStart = viewConfig.rowAlign === DEFAULT_ROW_ALIGN;
	const onResourceClick = settings.onResourceClick;
	const onResourceDoubleClick = settings.onResourceDoubleClick;
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLElement>): void => {
			if (!isChromeClick(event.target)) {
				onResourceClick?.(context, event);
			}
		},
		[onResourceClick, context],
	);
	const handleDoubleClick = React.useCallback(
		(event: React.MouseEvent<HTMLElement>): void => {
			if (!isChromeClick(event.target)) {
				onResourceDoubleClick?.(context, event);
			}
		},
		[onResourceDoubleClick, context],
	);
	const handleGrip = React.useCallback(
		(event: React.PointerEvent<HTMLElement>): void => {
			onGripPointerDown?.(event, row);
		},
		[onGripPointerDown, row],
	);
	const handleToggle = React.useCallback((): void => {
		onToggle(row);
	}, [onToggle, row]);
	const handleChecked = React.useCallback(
		(isChecked: boolean): void => {
			onSelectedChange?.(row.resource.id, isChecked);
		},
		[onSelectedChange, row.resource.id],
	);
	const rowStyle = React.useMemo((): React.CSSProperties => ({ height: rem(heightRem) }), [heightRem]);
	const nameStyle = React.useMemo((): React.CSSProperties => ({ width: nameWidth }), [nameWidth]);
	const bandStyle = React.useMemo((): React.CSSProperties => ({ height: rem(bandRem) }), [bandRem]);
	const indentStyle = React.useMemo((): React.CSSProperties => ({ width: rem(row.depth * TREE_INDENT_REM) }), [row.depth]);
	const menu = viewConfig.renderResourceMenu?.(context);

	const rowNode = (
		<div
			role="treeitem"
			tabIndex={-1}
			aria-label={row.resource.title}
			aria-level={row.depth + 1}
			aria-expanded={row.isGroup ? !row.collapsed : undefined}
			aria-selected={row.isGroup ? undefined : isSelected}
			data-slot="gantt-row-group"
			data-gantt-row-id={row.resource.id}
			data-gantt-row-index={rowIndex}
			data-selected={isSelected ? "" : undefined}
			className={cn("group/gantt-row flex border-b data-hover:bg-muted/40 data-selected:bg-primary/5 data-selected:data-hover:bg-primary/5", isDimmed && "opacity-50")}
			style={rowStyle}
			onClick={onResourceClick === undefined ? undefined : handleClick}
			onDoubleClick={onResourceDoubleClick === undefined ? undefined : handleDoubleClick}>
			<div className="flex h-full w-full min-w-0">
				<div
					data-slot="gantt-tree-cell"
					className={cn("flex shrink-0 ps-3 pe-3", isAlignStart ? "items-start" : "items-center", row.isGroup && "font-medium")}
					style={nameStyle}>
					<div className="flex w-full min-w-0 items-center" style={bandStyle}>
						{onGripPointerDown === undefined ? null : (
							<button
								type="button"
								data-slot="gantt-row-grip"
								aria-label={settings.i18n.labels.reorder}
								className="-ms-1.5 me-1.5 flex w-3.5 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/60 opacity-0 group-hover/gantt-row:opacity-100 group-data-hover/gantt-row:opacity-100 hover:text-foreground focus-visible:opacity-100 pointer-coarse:opacity-100"
								onPointerDown={handleGrip}>
								<GripVerticalIcon aria-hidden className="size-3" />
							</button>
						)}
						<span aria-hidden className="shrink-0" style={indentStyle} />
						<span className="me-1 flex w-5 shrink-0 items-center justify-start">
							{row.isGroup ? (
								<Button
									variant="ghost"
									size="icon-xs"
									aria-expanded={!row.collapsed}
									aria-label={row.resource.title}
									className={cn(
										"size-5! aria-expanded:bg-transparent!",
										row.collapsed ? "text-foreground" : "text-muted-foreground hover:text-foreground! aria-expanded:text-muted-foreground!",
									)}
									onClick={handleToggle}>
									<ChevronRightIcon aria-hidden className={cn("size-3.5 motion-safe:transition-transform rtl:rotate-180", !row.collapsed && "rotate-90 rtl:rotate-90")} />
								</Button>
							) : viewConfig.rowCheckboxes && onSelectedChange !== undefined ? (
								<Checkbox
									data-slot="gantt-row-checkbox"
									checked={isSelected}
									onCheckedChange={handleChecked}
									aria-label={row.resource.title}
									className={cn(
										"size-3.5 opacity-0 group-hover/gantt-row:opacity-100 group-data-hover/gantt-row:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity",
										isSelected && "opacity-100",
									)}
								/>
							) : null}
						</span>
						{viewConfig.renderResourceLabel?.(context) ?? <span className="truncate">{row.resource.title}</span>}
					</div>
				</div>
				{columns.map((column: GanttColumn): React.JSX.Element => (
					<div
						key={column.id}
						data-slot="gantt-tree-column-cell"
						data-column={column.id}
						className={cn("flex shrink-0 px-2", isAlignStart ? "items-start" : "items-center", column.className)}
						style={columnWidthStyle(column)}>
						<div className={cn("flex w-full min-w-0 items-center", COLUMN_ALIGN_CLASS[column.align ?? "start"])} style={bandStyle}>
							{column.render?.(context)}
						</div>
					</div>
				))}
				<div className="min-w-0 flex-1" />
			</div>
		</div>
	);

	if (menu === undefined || menu === null) {
		return rowNode;
	}
	return (
		<ContextMenu>
			<ContextMenuTrigger render={rowNode} />
			<ContextMenuContent data-slot="gantt-resource-menu" className="min-w-44">
				{menu}
			</ContextMenuContent>
		</ContextMenu>
	);
});

interface GhostSnapshot {
	readonly from: number;
	readonly to: number;
	readonly color?: string | undefined;
	readonly valid: boolean;
	readonly title: string;
	readonly kind: GanttDragKind;
	readonly occurrenceKey: string;
	readonly milestone: boolean;
}

interface DraftSnapshot {
	readonly from: number;
	readonly to: number;
	readonly startMs: number;
	readonly endMs: number;
}

interface GanttTimelineRowProps {
	readonly row: TimelineRow;
	readonly rowIndex: number;
	readonly bars: TimelineRowBars | undefined;
	readonly rangeStartMs: number;
	readonly rangeEndMs: number;
	readonly trackWidth: string;
	readonly trackRemWidth: number;
	readonly rowBorder: GanttLineStroke | null;
	readonly isSelected: boolean;
	readonly resolveStop: (fraction: number) => HintStop | null;
	readonly isPanning: boolean;
	readonly laneHeightRem: number;
	readonly laneGapRem: number;
	readonly minRowRem: number;
	readonly ghostHeightRem: number;
	readonly autoLabelMinRem: number;
	readonly dependencySourceIds: ReadonlySet<string>;
}

const NO_SEGMENTS: readonly GanttSegment[] = [];

/** The drag-create / hint slot for a snapped unit (never zero-length). */
function slotForStop(stop: HintStop, resourceId: string): { readonly start: Date; readonly end: Date; readonly allDay: boolean; readonly resourceId: string } {
	return { start: new Date(stop.ms), end: new Date(Math.max(stop.endMs, stop.ms + 1)), allDay: false, resourceId };
}

const GanttTimelineRow = React.memo(function GanttTimelineRow({
	row,
	rowIndex,
	bars,
	rangeStartMs,
	rangeEndMs,
	trackWidth,
	trackRemWidth,
	rowBorder,
	isSelected,
	resolveStop,
	isPanning,
	laneHeightRem,
	laneGapRem,
	minRowRem,
	ghostHeightRem,
	autoLabelMinRem,
	dependencySourceIds,
}: GanttTimelineRowProps): React.JSX.Element {
	const instance = useGantt();
	const settings = useGanttSettings();
	const viewConfig = useGanttViewConfig();
	const gestures = useGanttGestures();
	const resourceId = row.resource.id;
	const segments = bars?.segments ?? NO_SEGMENTS;
	// parents aggregate their subtree; they take no direct scheduling gestures
	const isSchedulable = !row.isGroup || viewConfig.parentScheduling;
	const heightRem = bars?.heightRem ?? minRowRem;
	const laneCount = bars?.laneCount ?? 1;
	const isSingleTrack = resolveScheduleMode(row.resource, viewConfig.scheduleMode) === "single";
	const laneOffsetRem = bars?.laneOffsetRem ?? (minRowRem - laneHeightRem) / 2;
	const fractionOf = (ms: number): number => fractionOfRange(ms, rangeStartMs, rangeEndMs);

	const [hintStop, setHintStop] = React.useState<HintStop | null>(null);
	const isHintSuppressed = useGanttSelector((state: GanttState): boolean => hintStop !== null && (state.drag !== null || state.slotDraft !== null));
	const canSchedule = useGanttSelector((state: GanttState): boolean => state.interactions.selectSlot);
	const hintFreeLane = hintStop === null ? 0 : lowestFreeLane(segments, hintStop.ms, hintStop.endMs);
	const hintLane = bars?.scheduleMode === "single" ? 0 : hintFreeLane;
	const hintTopRem = Math.min(laneTopRem(laneOffsetRem, hintLane, laneHeightRem, laneGapRem) + laneHeightRem / 2, Math.max(heightRem - laneHeightRem / 2, laneHeightRem / 2));
	const isHintVisible = hintStop !== null && hintFreeLane < laneCount && !isHintSuppressed && !isPanning;
	const hintLabel = viewConfig.dragCreate ? settings.i18n.labels.scheduleHintDrag : settings.i18n.labels.scheduleHint;
	const onSlotClick = settings.onSlotClick;
	const onSelectSlot = settings.onSelectSlot;
	const showHint = viewConfig.displayScheduleHint && isSchedulable && canSchedule && !isPanning && (onSelectSlot !== undefined || onSlotClick !== undefined);

	const dragTarget = useGanttSelector((state: GanttState): "valid" | "invalid" | null => {
		const drag = state.drag;
		if (drag?.proposedResourceId !== resourceId) {
			return null;
		}
		return drag.valid ? "valid" : "invalid";
	});
	const ghost = useGanttSelector(
		(state: GanttState): GhostSnapshot | null => {
			const drag = state.drag;
			if (drag?.proposedResourceId !== resourceId) {
				return null;
			}
			return {
				from: fractionOf(drag.proposedStart.getTime()),
				to: fractionOf(drag.proposedEnd.getTime()),
				color: drag.occurrence.event.color,
				valid: drag.valid,
				title: drag.occurrence.event.title,
				kind: drag.kind,
				occurrenceKey: drag.occurrence.key,
				milestone: drag.proposedEnd.getTime() === drag.proposedStart.getTime(),
			};
		},
		{ isEqual: isSameGhost },
	);
	const draft = useGanttSelector(
		(state: GanttState): DraftSnapshot | null => {
			const slotDraft = state.slotDraft;
			if (slotDraft?.resourceId !== resourceId) {
				return null;
			}
			const startMs = slotDraft.start.getTime();
			const endMs = slotDraft.end.getTime();
			return { from: fractionOf(startMs), to: fractionOf(endMs), startMs, endMs };
		},
		{ isEqual: isSameDraft },
	);
	const draftLane = bars?.draftLane ?? 0;
	const draftTopRem = Math.min(laneTopRem(laneOffsetRem, draftLane, laneHeightRem, laneGapRem), Math.max(heightRem - laneHeightRem, 0));
	const draftLabel =
		draft === null
			? ""
			: settings.i18n.functions.formatEventTime(
					toZoned(new Date(draft.startMs), settings.timeZone),
					toZoned(new Date(draft.endMs), settings.timeZone),
					false,
					settings.locale,
				);

	/** The row's create contract: onSlotClick if wired, else a ready-made slot through onSelectSlot. */
	const createAt = React.useCallback(
		(stop: HintStop, event: React.MouseEvent<HTMLElement>): void => {
			if (onSlotClick !== undefined) {
				onSlotClick({ date: new Date(stop.ms), allDay: false, resourceId }, event);
				return;
			}
			onSelectSlot?.(slotForStop(stop, resourceId));
		},
		[onSlotClick, onSelectSlot, resourceId],
	);
	const canSelectSlot = settings.canSelectSlot;
	const isStopAllowed = React.useCallback(
		(stop: HintStop | null): stop is HintStop => stop !== null && (canSelectSlot?.(slotForStop(stop, resourceId)) ?? true),
		[canSelectSlot, resourceId],
	);

	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			// opt-in drag-create owns presses on empty schedulable track; otherwise the press pans
			const isOnTrack = event.target === event.currentTarget || (isElement(event.target) && event.target.closest("[data-slot=gantt-schedule-hint]") !== null);
			if (!viewConfig.dragCreate || event.button !== 0 || !isSchedulable || !canSchedule || !isOnTrack || onSelectSlot === undefined) {
				return;
			}
			// validate BEFORE claiming the press: a vetoed slot falls through to the pan
			if (!isStopAllowed(resolveStop(trackPoint(event.currentTarget, event.clientX).fraction))) {
				return;
			}
			event.stopPropagation();
			gestures.beginCreate(event);
		},
		[viewConfig.dragCreate, isSchedulable, canSchedule, onSelectSlot, isStopAllowed, resolveStop, gestures],
	);
	const handlePointerMove = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			const state = instance.getState();
			const isInteracting = state.drag !== null || state.slotDraft !== null;
			// EMPTY TRACK ONLY: a bar under the pointer means there is no empty slot here
			if (!showHint || event.pointerType !== "mouse" || isInteracting || event.target !== event.currentTarget) {
				setHintStop(null);
				return;
			}
			const { fraction, offset } = trackPoint(event.currentTarget, event.clientX);
			// the dot follows the pointer freely, written as a CSS variable (no per-frame React)
			event.currentTarget.style.setProperty("--gantt-hint-x", `${String(offset)}px`);
			const stop = resolveStop(fraction);
			const next = isStopAllowed(stop) ? stop : null;
			setHintStop((previous: HintStop | null): HintStop | null => (previous?.index === next?.index ? previous : next));
		},
		[instance, showHint, resolveStop, isStopAllowed],
	);
	const handlePointerLeave = React.useCallback((): void => {
		setHintStop(null);
	}, []);
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>): void => {
			// with dragCreate a press that never moved committed nothing: treat it as a create at the slot
			if (!viewConfig.dragCreate || event.target !== event.currentTarget || !isSchedulable || !canSchedule || wasRecentDrag()) {
				return;
			}
			const stop = resolveStop(trackPoint(event.currentTarget, event.clientX).fraction);
			if (!isStopAllowed(stop)) {
				return;
			}
			createAt(stop, event);
			setHintStop(null);
		},
		[viewConfig.dragCreate, isSchedulable, canSchedule, resolveStop, isStopAllowed, createAt],
	);
	const handleHintPointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLButtonElement>): void => {
			if (!viewConfig.dragCreate) {
				event.stopPropagation();
			}
		},
		[viewConfig.dragCreate],
	);
	const handleHintClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			event.stopPropagation();
			if (hintStop === null || wasRecentDrag()) {
				return;
			}
			createAt(hintStop, event);
			setHintStop(null);
		},
		[hintStop, createAt],
	);

	const ghostLane = ghost === null ? 0 : (segments.find((segment: GanttSegment): boolean => segment.occurrence.key === ghost.occurrenceKey)?.column ?? 0);
	const ghostTopRem = laneTopRem(laneOffsetRem, ghostLane, laneHeightRem, laneGapRem) + (laneHeightRem - ghostHeightRem) / 2;
	const rowStyle: React.CSSProperties = { height: rem(heightRem), minWidth: trackWidth };

	return (
		<div
			data-gantt-row=""
			data-gantt-resource={resourceId}
			data-gantt-row-id={resourceId}
			data-gantt-row-static={isSchedulable ? undefined : ROW_STATIC_MARK}
			data-gantt-bar-min={bars?.extent?.from}
			data-gantt-bar-max={bars?.extent?.to}
			data-gantt-bar-color={bars?.extent?.color}
			data-gantt-bar-label={bars?.extent?.label}
			data-gantt-bar-start-ms={bars?.extent?.startMs}
			data-drop-target={dragTarget ?? undefined}
			data-selected={isSelected ? "" : undefined}
			role="presentation"
			className={cn(
				"relative w-full min-w-0 data-hover:bg-muted/30 data-selected:bg-primary/5 data-selected:data-hover:bg-primary/5",
				isHintVisible && "cursor-crosshair",
				rowBorder !== null && "border-b",
				rowBorder === "dashed" && "border-dashed",
				dragTarget === "valid" && "bg-muted/40",
				dragTarget === "invalid" && "bg-destructive/10",
			)}
			style={rowStyle}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
			onClick={handleClick}>
			<div className="pointer-events-none absolute inset-0" style={CONTENT_LAYER_STYLE}>
				{bars?.rowBaseline === null || bars?.rowBaseline === undefined ? null : (
					<div
						data-slot="gantt-row-baseline"
						data-milestone={bars.rowBaseline.baseline.milestone ? "" : undefined}
						data-variance={bars.rowBaseline.variance ?? undefined}
						aria-hidden
						className={cn("absolute", bars.rowBaseline.baseline.milestone ? "flex items-center justify-center" : "px-px", viewConfig.classNames?.baseline)}
						style={windowStyle(
							fractionOf(rangeStartMs + bars.rowBaseline.startMin * MS_PER_MINUTE),
							fractionOf(rangeStartMs + bars.rowBaseline.endMin * MS_PER_MINUTE),
							bars.rowBaseline.baseline.milestone,
							laneHeightRem,
							laneOffsetRem,
							laneBlockRem(laneCount, laneHeightRem, laneGapRem),
							row.resource.color,
						)}>
						{viewConfig.renderRowBaseline?.({
							resource: row.resource,
							start: bars.rowBaseline.baseline.start,
							end: bars.rowBaseline.baseline.end,
							milestone: bars.rowBaseline.baseline.milestone,
							variance: bars.rowBaseline.variance,
						}) ??
							(bars.rowBaseline.baseline.milestone ? (
								<span className="size-2.5 rotate-45 rounded-xs border border-(--gantt-event-color)/60 bg-(--gantt-event-color)/15" />
							) : (
								<span className="relative block h-full w-full rounded-sm border border-(--gantt-event-color)/25 bg-(--gantt-event-color)/6" />
							))}
					</div>
				)}
				{bars?.baselines.map((plan: TimelineRowBars["baselines"][number]): React.JSX.Element => (
					<div
						key={`baseline-${plan.event.id}`}
						data-slot="gantt-baseline"
						data-milestone={plan.baseline.milestone ? "" : undefined}
						data-variance={plan.variance}
						aria-hidden
						className={cn("absolute", plan.baseline.milestone ? "flex items-center justify-center" : "px-px", viewConfig.classNames?.baseline)}
						style={windowStyle(
							fractionOf(rangeStartMs + plan.startMin * MS_PER_MINUTE),
							fractionOf(rangeStartMs + plan.endMin * MS_PER_MINUTE),
							plan.baseline.milestone,
							laneHeightRem,
							laneTopRem(laneOffsetRem, plan.lane, laneHeightRem, laneGapRem),
							laneHeightRem,
							plan.event.color,
						)}>
						{viewConfig.renderBaseline?.({
							event: plan.event,
							start: plan.baseline.start,
							end: plan.baseline.end,
							milestone: plan.baseline.milestone,
							variance: plan.variance,
						}) ??
							(plan.baseline.milestone ? (
								<span className="size-2 rotate-45 rounded-xs border border-(--gantt-event-color)/60 bg-(--gantt-event-color)/15" />
							) : (
								<span className="relative block h-full w-full rounded-sm border border-(--gantt-event-color)/40 bg-(--gantt-event-color)/10" />
							))}
					</div>
				))}
				{segments.map((segment: GanttSegment, segmentIndex: number): React.JSX.Element | null => {
					const from = fractionOf(rangeStartMs + (segment.startMin ?? 0) * MS_PER_MINUTE);
					const to = fractionOf(rangeStartMs + (segment.endMin ?? 0) * MS_PER_MINUTE);
					const isMilestone = segment.occurrence.end.getTime() === segment.occurrence.start.getTime();
					if (to <= from && !isMilestone) {
						return null;
					}
					const lane = segment.column ?? 0;
					const placement = resolveLabelPlacement({
						mode: viewConfig.barLabel,
						isMilestone,
						from,
						to,
						barRemWidth: isMilestone ? laneHeightRem : (to - from) * trackRemWidth,
						autoLabelMinRem,
					});
					const style: React.CSSProperties = {
						...windowStyle(from, to, isMilestone, laneHeightRem, laneTopRem(laneOffsetRem, lane, laneHeightRem, laneGapRem), laneHeightRem, segment.occurrence.event.color),
						// one track means every lane is 0, so paint order keeps overlapping bars reachable
						zIndex: segment.occurrence.event.zIndex ?? GANTT_LAYER.bar + (isSingleTrack ? segmentIndex : lane),
					};
					return (
						<div
							key={segment.occurrence.key}
							data-drag-kind={ghost?.occurrenceKey === segment.occurrence.key ? ghost.kind : undefined}
							data-milestone={isMilestone ? "" : undefined}
							data-lane={lane}
							data-lane-count={laneCount}
							className="group/gantt-seg pointer-events-auto absolute px-px data-[drag-kind=move]:opacity-0"
							style={style}>
							<GanttBar segment={segment} labelOutside={placement !== "inside"} rowTitle={row.resource.title} className="h-full" />
							{placement === "inside" ? null : (
								<span
									data-slot="gantt-bar-label"
									data-placement={placement}
									aria-hidden
									className={cn(
										"pointer-events-none absolute top-1/2 max-w-60 -translate-y-1/2 truncate font-medium text-foreground group-data-[drag-kind^=resize]/gantt-seg:opacity-0",
										placement === "after" ? (dependencySourceIds.has(segment.occurrence.eventId) ? "start-full ms-4" : "start-full ms-2") : "end-full me-2",
									)}>
									{segment.occurrence.event.title}
								</span>
							)}
						</div>
					);
				})}
				{bars?.summary === null || bars?.summary === undefined || segments.length > 0 ? null : (
					<GanttSummaryStrip resource={row.resource} summary={bars.summary} rangeStartMs={rangeStartMs} rangeEndMs={rangeEndMs} />
				)}
				{ghost === null ? null : (
					<div
						data-slot="gantt-drag-ghost"
						data-kind={ghost.kind}
						data-milestone={ghost.milestone ? "" : undefined}
						data-drop-invalid={ghost.valid ? undefined : ""}
						className={cn(
							"pointer-events-none absolute h-(--gantt-ghost-height) rounded-sm border border-dashed font-medium",
							!ghost.valid && "border-destructive bg-destructive/10 text-destructive",
							ghost.valid && ghost.kind === "move" && "border-(--gantt-event-color)/50 bg-(--gantt-event-color)/8",
							ghost.valid && ghost.kind !== "move" && "border-(--gantt-event-color)/70 bg-(--gantt-event-color)/22 text-foreground",
							ghost.milestone && "flex items-center justify-center rounded-none border-0 bg-transparent",
						)}
						style={ghostStyle(ghost, laneHeightRem, ghostTopRem, ghostHeightRem)}>
						{ghost.milestone ? (
							<span
								className={cn(
									"size-2.5 rotate-45 rounded-xs border border-dashed",
									ghost.valid ? "border-(--gantt-event-color)/70 bg-(--gantt-event-color)/10" : "border-destructive bg-destructive/10",
								)}
							/>
						) : null}
						{ghost.kind === "move" ? null : (
							<span className="pointer-events-none absolute start-full top-1/2 ms-2 max-w-60 -translate-y-1/2 truncate whitespace-nowrap">{ghost.title}</span>
						)}
					</div>
				)}
				{draft === null ? null : (
					<div
						data-slot="gantt-slot-draft"
						data-lane={draftLane}
						className="pointer-events-none absolute overflow-hidden rounded-sm border border-dashed border-primary bg-background"
						style={draftStyle(draft, draftTopRem, laneHeightRem)}>
						<span aria-hidden className="absolute inset-0 bg-primary/15" />
					</div>
				)}
			</div>
			{draft === null || draftLabel === "" ? null : (
				<div data-slot="gantt-slot-draft-label" className="pointer-events-none absolute" style={draftLabelStyle(draft, draftTopRem, laneHeightRem)}>
					<span className="absolute start-full top-1/2 ms-2 inline-flex w-max -translate-y-1/2 items-center rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background">
						{draftLabel}
						<span aria-hidden className="absolute start-0 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] bg-foreground" />
					</span>
				</div>
			)}
			{isHintVisible ? (
				<div data-slot="gantt-schedule-hint" className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2" style={hintStyle(hintTopRem)}>
					{viewConfig.renderScheduleHint === undefined ? (
						<>
							<button
								type="button"
								data-slot="gantt-schedule-hint-tile"
								aria-label={hintLabel}
								className="pointer-events-none block size-5 rounded-full border-2 border-primary bg-transparent ring-1 ring-background/80"
								onPointerDown={handleHintPointerDown}
								onClick={handleHintClick}
							/>
							<span
								data-slot="gantt-schedule-hint-bubble"
								className={cn(
									"absolute start-1/2 inline-flex w-max -translate-x-1/2 items-center rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background",
									rowIndex === 0 ? "top-full mt-2" : "bottom-full mb-2",
								)}>
								{hintLabel}
								<span aria-hidden className={cn("absolute start-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-xs bg-foreground", rowIndex === 0 ? "-top-1" : "-bottom-1")} />
							</span>
						</>
					) : (
						viewConfig.renderScheduleHint({ start: new Date(hintStop.ms), end: new Date(Math.max(hintStop.endMs, hintStop.ms + 1)), resource: row.resource })
					)}
				</div>
			) : null}
		</div>
	);
});

function isSameGhost(a: GhostSnapshot | null, b: GhostSnapshot | null): boolean {
	return a === b || (a !== null && b !== null && a.from === b.from && a.to === b.to && a.valid === b.valid && a.kind === b.kind && a.occurrenceKey === b.occurrenceKey);
}

function isSameDraft(a: DraftSnapshot | null, b: DraftSnapshot | null): boolean {
	return a === b || (a !== null && b !== null && a.startMs === b.startMs && a.endMs === b.endMs && a.from === b.from && a.to === b.to);
}

function ghostStyle(ghost: GhostSnapshot, laneHeightRem: number, topRem: number, ghostHeightRem: number): GanttStyle {
	return {
		insetInlineStart: ghost.milestone ? milestoneInset(ghost.from, laneHeightRem) : percent(ghost.from),
		width: ghost.milestone ? rem(laneHeightRem) : `${String(Math.max((ghost.to - ghost.from) * PERCENT, MIN_BAR_WIDTH_PERCENT))}%`,
		top: rem(topRem),
		zIndex: GANTT_LAYER.ghost,
		"--gantt-ghost-height": rem(ghostHeightRem),
		"--gantt-event-color": ghost.color ?? GANTT_DEFAULT_COLOR,
	};
}

function draftStyle(draft: DraftSnapshot, topRem: number, laneHeightRem: number): React.CSSProperties {
	return {
		insetInlineStart: percent(draft.from),
		width: `${String(Math.max((draft.to - draft.from) * PERCENT, MIN_BAR_WIDTH_PERCENT))}%`,
		top: rem(topRem),
		height: rem(laneHeightRem),
		zIndex: GANTT_LAYER.ghost,
	};
}

function draftLabelStyle(draft: DraftSnapshot, topRem: number, laneHeightRem: number): React.CSSProperties {
	return { insetInlineStart: percent(draft.to), top: rem(topRem), height: rem(laneHeightRem), zIndex: GANTT_LAYER.ghost };
}

function hintStyle(topRem: number): React.CSSProperties {
	return { insetInlineStart: "var(--gantt-hint-x, 50%)", top: rem(topRem), zIndex: GANTT_LAYER.hint };
}

interface GanttSummaryStripProps {
	readonly resource: TimelineRow["resource"];
	readonly summary: NonNullable<TimelineRowBars["summary"]>;
	readonly rangeStartMs: number;
	readonly rangeEndMs: number;
}

/** Parent rollup: the descendant envelope with duration-weighted progress. */
function GanttSummaryStrip({ resource, summary, rangeStartMs, rangeEndMs }: GanttSummaryStripProps): React.JSX.Element {
	const viewConfig = useGanttViewConfig();
	const settings = useGanttSettings();
	const span = rangeEndMs - rangeStartMs;
	const style: React.CSSProperties = { insetInlineStart: percent(summary.from), width: `${String(Math.max((summary.to - summary.from) * PERCENT, MIN_BAR_WIDTH_PERCENT))}%` };
	const progressStyle: React.CSSProperties = { width: `${String(summary.progress ?? 0)}%` };
	return (
		<div data-slot="gantt-summary" aria-hidden className="pointer-events-none absolute top-1/2 -translate-y-1/2" style={style}>
			{viewConfig.renderSummary === undefined ? (
				<>
					<span aria-hidden className="absolute start-0 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/50" />
					<span aria-hidden className="absolute end-0 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/50" />
					<div className="relative h-1.5 overflow-hidden rounded-full bg-muted-foreground/20">
						{summary.progress === null ? null : (
							<div data-slot="gantt-summary-progress" className="absolute inset-y-0 start-0 rounded-full bg-muted-foreground/50" style={progressStyle} />
						)}
					</div>
					{summary.progress === null ? null : (
						<span className="absolute start-full top-1/2 ms-2 -translate-y-1/2 whitespace-nowrap text-muted-foreground">
							{settings.i18n.labels.summaryProgress(summary.progress)}
						</span>
					)}
				</>
			) : (
				viewConfig.renderSummary({
					resource,
					start: new Date(rangeStartMs + summary.from * span),
					end: new Date(rangeStartMs + summary.to * span),
					progress: summary.progress,
				})
			)}
		</div>
	);
}

interface OffscreenChip {
	readonly id: string;
	readonly side: "start" | "end";
	readonly top: number;
	readonly color?: string | undefined;
	readonly label: string;
	readonly startMs: number | null;
	/** Distance from the inline start that brings the bar back into view. */
	readonly target: number;
}

function isSameChipList(a: readonly OffscreenChip[], b: readonly OffscreenChip[]): boolean {
	return (
		a.length === b.length &&
		a.every((chip: OffscreenChip, index: number): boolean => {
			const other = b.at(index);
			return chip.id === other?.id && chip.side === other.side && chip.top === other.top && chip.target === other.target;
		})
	);
}

interface GanttOffscreenChipsProps {
	readonly paneRef: React.RefObject<HTMLDivElement | null>;
	readonly occurrences: readonly GanttOccurrence[];
	readonly refreshKey: string;
}

/**
 * Edge chips for rows whose bars sit entirely outside the visible timeline;
 * clicking scrolls the bar back into view and focuses it. Geometry is read
 * from the rows' data attributes, so scrolling never re-renders the grid.
 */
function GanttOffscreenChips({ paneRef, occurrences, refreshKey }: GanttOffscreenChipsProps): React.JSX.Element | null {
	const [chips, setChips] = React.useState<readonly OffscreenChip[]>([]);
	React.useEffect((): (() => void) | undefined => {
		const pane = paneRef.current;
		const viewport = getPaneViewport(pane);
		if (pane === null || viewport === null) {
			return undefined;
		}
		let frame = 0;
		const measure = (): void => {
			frame = 0;
			setChips((previous: readonly OffscreenChip[]): readonly OffscreenChip[] => {
				const next = measureOffscreenChips(pane, viewport);
				return isSameChipList(previous, next) ? previous : next;
			});
		};
		const schedule = (): void => {
			if (frame === 0) {
				frame = requestAnimationFrame(measure);
			}
		};
		viewport.addEventListener("scroll", schedule);
		const observer = hasGlobalConstructor("ResizeObserver") ? new ResizeObserver(schedule) : null;
		observer?.observe(viewport);
		schedule();
		return (): void => {
			viewport.removeEventListener("scroll", schedule);
			observer?.disconnect();
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			pane.querySelector<HTMLElement>("[data-slot=gantt-zoom]")?.style.removeProperty("--gantt-zoom-shift");
		};
	}, [paneRef, occurrences, refreshKey]);

	if (chips.length === 0) {
		return null;
	}
	return (
		<div data-slot="gantt-offscreen-chips" className="pointer-events-none absolute inset-0 overflow-hidden" style={CHIPS_LAYER_STYLE}>
			<TooltipProvider delay={TOOLTIP_DELAY_MS} closeDelay={0} timeout={TOOLTIP_TIMEOUT_MS}>
				{chips.map((chip: OffscreenChip): React.JSX.Element => (
					<GanttOffscreenChip key={`${chip.id}-${chip.side}`} chip={chip} paneRef={paneRef} />
				))}
			</TooltipProvider>
		</div>
	);
}

const CHIPS_LAYER_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.chips };

function measureOffscreenChips(pane: HTMLElement, viewport: HTMLElement): OffscreenChip[] {
	const paneRect = pane.getBoundingClientRect();
	const header = viewport.querySelector<HTMLElement>("[data-slot=gantt-timeline-header]");
	const headerBottom = header === null ? 0 : header.getBoundingClientRect().bottom - paneRect.top;
	const trackWidth = viewport.scrollWidth;
	const visibleStart = getScrollStart(viewport);
	const visibleEnd = visibleStart + viewport.clientWidth;
	// the zoom control glides inward while an end chip occupies its band (the chips' position IS their meaning)
	const zoomElement = pane.querySelector<HTMLElement>("[data-slot=gantt-zoom]");
	const zoomRect = zoomElement?.getBoundingClientRect();
	let isChipInZoomBand = false;
	const next: OffscreenChip[] = [];
	for (const rowElement of viewport.querySelectorAll<HTMLElement>("[data-gantt-row]")) {
		const from = Number.parseFloat(rowElement.dataset.ganttBarMin ?? "");
		const to = Number.parseFloat(rowElement.dataset.ganttBarMax ?? "");
		if (Number.isNaN(from) || Number.isNaN(to)) {
			continue;
		}
		const rect = rowElement.getBoundingClientRect();
		const top = rect.top - paneRect.top + rect.height / 2;
		if (top < headerBottom + CHIP_HEADER_CLEARANCE_PX || top > paneRect.height - CHIP_BOTTOM_CLEARANCE_PX) {
			continue;
		}
		const startPx = from * trackWidth;
		const endPx = to * trackWidth;
		const startMs = Number.parseFloat(rowElement.dataset.ganttBarStartMs ?? "");
		const base = {
			id: rowElement.dataset.ganttRowId ?? "",
			top: Math.round(top),
			color: rowElement.dataset.ganttBarColor,
			label: rowElement.dataset.ganttBarLabel ?? "",
			startMs: Number.isNaN(startMs) ? null : startMs,
		};
		if (endPx <= visibleStart + CHIP_EDGE_TOLERANCE_PX) {
			next.push({ ...base, side: "start", target: startPx - CHIP_JUMP_INSET_PX });
		} else if (startPx >= visibleEnd - CHIP_EDGE_TOLERANCE_PX) {
			if (zoomRect !== undefined && top >= zoomRect.top - paneRect.top - CHIP_ZOOM_BAND_PX && top <= zoomRect.bottom - paneRect.top + CHIP_ZOOM_BAND_PX) {
				isChipInZoomBand = true;
			}
			next.push({ ...base, side: "end", target: endPx - viewport.clientWidth + CHIP_JUMP_INSET_PX });
		}
	}
	zoomElement?.style.setProperty("--gantt-zoom-shift", `${String(isChipInZoomBand ? CHIP_ZOOM_SHIFT_PX : 0)}px`);
	return next;
}

interface GanttOffscreenChipProps {
	readonly chip: OffscreenChip;
	readonly paneRef: React.RefObject<HTMLDivElement | null>;
}

function GanttOffscreenChip({ chip, paneRef }: GanttOffscreenChipProps): React.JSX.Element {
	const settings = useGanttSettings();
	const handleClick = React.useCallback((): void => {
		const viewport = getPaneViewport(paneRef.current);
		if (viewport === null) {
			return;
		}
		const target = Math.max(0, chip.target);
		viewport.scrollTo({ left: getComputedStyle(viewport).direction === "rtl" ? -target : target, behavior: "smooth" });
		// hand keyboard focus to the bar the chip promised (the chip unmounts)
		const row = [...viewport.querySelectorAll<HTMLElement>("[data-gantt-row-id]")].find((element: HTMLElement): boolean => element.dataset.ganttRowId === chip.id);
		row?.querySelector<HTMLElement>("[data-slot=gantt-bar]")?.focus({ preventScroll: true });
	}, [chip, paneRef]);
	const style: React.CSSProperties = chip.side === "start" ? { top: chip.top, insetInlineStart: "0.5rem" } : { top: chip.top, insetInlineEnd: "0.875rem" };
	const dotStyle: GanttStyle = { "--gantt-event-color": chip.color ?? GANTT_DEFAULT_COLOR };
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						data-slot="gantt-offscreen-chip"
						data-side={chip.side}
						aria-label={settings.i18n.labels.jumpToBar(chip.label)}
						className="pointer-events-auto absolute flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs hover:text-foreground"
						style={style}
						onClick={handleClick}
					/>
				}>
				{chip.side === "start" ? <ChevronLeftIcon aria-hidden className="size-3 rtl:rotate-180" /> : <ChevronRightIcon aria-hidden className="size-3 rtl:rotate-180" />}
				<span aria-hidden className="absolute -end-px -top-px size-1.5 rounded-full bg-(--gantt-event-color) ring-1 ring-background" style={dotStyle} />
			</TooltipTrigger>
			<TooltipContent side={chip.side === "start" ? "right" : "left"} className="flex-col items-start gap-0">
				<div className="font-medium">{chip.label}</div>
				{chip.startMs === null ? null : (
					<div className="opacity-80">{format(toZoned(new Date(chip.startMs), settings.timeZone), settings.i18n.formats.longDate, localeOptions(settings.locale))}</div>
				)}
			</TooltipContent>
		</Tooltip>
	);
}
