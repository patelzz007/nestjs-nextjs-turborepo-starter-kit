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
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { Spinner } from "@workspace/ui/components/spinner";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { format } from "date-fns";
import { MinusIcon, PlusIcon } from "lucide-react";
import * as React from "react";
import { resolveTimelineLines, useGantt, useGanttNow, useGanttSelector, useGanttSettings, useGanttViewConfig, type GanttColumn } from "./gantt";
import { cancelActiveGanttGestures, markGestureEnd, useGanttGestureTeardown } from "./gantt-dnd";
import { resolveSnapMinutes } from "./gantt-gesture-math";
import { clampNumber, FRACTION_EPSILON, getRangeKey, reorderResources, toZoned } from "./gantt-lib";
import type { GanttDateRange, GanttEvent, GanttOccurrence, GanttResourceReorder, GanttScale, GanttState } from "./gantt-types";
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
	MAX_INTERVAL_MIN,
	MIN_INTERVAL_MIN,
	MIN_ROW_HEIGHT_REM,
	resolveCenterTarget,
	resolveHintStop,
	ROW_PADDING_REM,
	type HintStop,
	type RowWindow,
	type TimelineRow,
	type TimelineRowBars,
	type UnitFraction,
} from "./gantt-view-layout";
import {
	CHROME_STYLE,
	COLUMN_ALIGN_CLASS,
	columnWidthStyle,
	GanttCustomDragLayer,
	GanttDependencyLayer,
	GanttNowMark,
	GanttOffscreenChips,
	GanttZoomButton,
	LOADING_STYLE,
	NO_COLUMNS,
	PERIOD_KEY_FORMAT,
	scaleAttribute,
	SCROLLBAR_STYLE,
	STICKY_HEADER_STYLE,
	stickyTrackHeaderStyle,
} from "./gantt-view-chrome";
import { GanttTimelineRow, GanttTreeRow } from "./gantt-view-rows";
import {
	readAxisWidth,
	DEFAULT_OVERSCAN_ROWS,
	DEFAULT_TREE_PANEL,
	DEFAULT_VIRTUALIZATION_THRESHOLD,
	DEFAULT_ZOOM,
	DEFAULT_ZOOM_MAX,
	DEFAULT_ZOOM_MIN,
	DEFAULT_ZOOM_STEP,
	DOM_DELTA_LINE,
	DOM_DELTA_PAGE,
	DRAFT_SELECTOR_OPTIONS,
	GANTT_LAYER,
	INFINITE_EDGE_PX,
	MAX_SEAT_ATTEMPTS,
	MIN_TIMELINE_WIDTH_PX,
	OCCURRENCES_SELECTOR_OPTIONS,
	OFF_DAY_BODY_CLASS,
	OFF_DAY_CLASS,
	PAN_ACTIVATION_PX,
	type PendingRestore,
	RANGE_SELECTOR_OPTIONS,
	REORDER_CARET_OFFSET_PX,
	REORDER_FALLBACK_GRAB_PX,
	REORDER_FALLBACK_ROW_PX,
	type ReorderState,
	SCROLL_SLACK_PX,
	SPLITTER_KEY_STEP_PX,
	TOOLTIP_DELAY_MS,
	TOOLTIP_TIMEOUT_MS,
	USER_SCROLL_WINDOW_MS,
	WHEEL_LINE_PX,
	WHEEL_PAGE_PX,
	WHEEL_ZOOM_EPSILON,
	WHEEL_ZOOM_RATE,
	ZOOM_DECIMALS,
	ZOOM_STEP_DECIMALS,
	createLaneMemory,
	flexStyle,
	getPaneViewport,
	getScrollStart,
	isElement,
	lineStyle,
	readLiveAxis,
	readRemPx,
	rem,
	selectDraftLayout,
	setScrollStart,
	spanStyle,
	strokeClass,
	trackPoint,
	useIdList,
	useTodayKey,
	wheelUnitPx,
} from "./gantt-view-shared";

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
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
		const run = (): void => {
			const viewport = getPaneViewport(timelinePaneRef.current);
			const axisNode = viewport?.querySelector("[data-gantt-axis]") ?? null;
			if (manageRef.current.userTook || viewport === null || axisNode === null) {
				return;
			}
			if (viewport.clientWidth === 0) {
				// deferred mount (hidden tab): the size watcher below runs this again once the pane has a size
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
			setScrollStart(viewport, Math.max(0, fractionOfRange(target, rangeStartMs, rangeEndMs) * readAxisWidth(viewport) - viewport.clientWidth / 2));
		};
		// Until the user takes over, the target stays centred through every change of the pane's size: a hidden tab
		// gaining one, the web fonts arriving (the tree panel's width, so the timeline's, follows its text), a sidebar
		// folding, the window resizing. Centring once at mount left it off by half of any later change.
		const viewport = getPaneViewport(timelinePaneRef.current);
		const watcher = viewport !== null && hasGlobalConstructor("ResizeObserver") ? new ResizeObserver(run) : null;
		if (viewport !== null && watcher !== null) {
			watcher.observe(viewport);
			const axisNode = viewport.querySelector("[data-gantt-axis]");
			if (axisNode !== null) {
				watcher.observe(axisNode);
			}
		}
		run();
		return (): void => {
			watcher?.disconnect();
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
			pendingRestoreRef.current = { ms: live.startMs + (getScrollStart(viewport) / readAxisWidth(viewport)) * (live.endMs - live.startMs), align: "start" };
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
			const fraction = (getScrollStart(viewport) + viewport.clientWidth / 2) / Math.max(1, readAxisWidth(viewport));
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
				setScrollStart(viewport, Math.max(0, fractionOfRange(pending.ms, rangeStartMs, rangeEndMs) * readAxisWidth(viewport) - offset));
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
			ms: live.startMs + ((getScrollStart(viewport) + offsetPx) / readAxisWidth(viewport)) * (live.endMs - live.startMs),
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
