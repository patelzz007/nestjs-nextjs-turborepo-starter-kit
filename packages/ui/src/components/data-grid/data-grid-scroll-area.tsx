"use client";

// The grid's scroll container: a Base UI ScrollArea with thin overlay
// scrollbars. With `tableLayout.headerSticky` the vertical bar is a custom
// overlay that starts BELOW the sticky header (and above a sticky footer), so
// the thumb never paints over the column titles. With pinned columns the
// horizontal track is inset to the scrollable centre region.

import { DirectionProvider, useDirection } from "@base-ui/react/direction-provider";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { hasGlobalConstructor } from "@workspace/shared";
import { useDataGrid, type DataGridGridVisitor } from "@workspace/ui/components/data-grid/data-grid";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import * as React from "react";

const MIN_THUMB_SIZE = 24;
const FALLBACK_SCROLLBAR_SIZE = 12;
/** Gap between each track and the grid edge (the tracks' mb-px / me-px). */
const SCROLLBAR_EDGE_GAP = 1;
/** Sub-pixel slack before a viewport counts as overflowing. */
const OVERFLOW_EPSILON_PX = 0.5;

export type DataGridScrollAreaOrientation = "horizontal" | "vertical" | "both";

export interface DataGridScrollbarMetrics {
	readonly hasVerticalOverflow: boolean;
	readonly headerHeight: number;
	readonly horizontalScrollbarSize: number;
	readonly thumbHeight: number;
	readonly thumbTop: number;
	readonly trackHeight: number;
}

const INITIAL_METRICS: DataGridScrollbarMetrics = {
	hasVerticalOverflow: false,
	headerHeight: 0,
	horizontalScrollbarSize: 0,
	thumbHeight: 0,
	thumbTop: 0,
	trackHeight: 0,
};

/** What the custom vertical bar measures from the viewport. */
export interface DataGridScrollMeasurement {
	readonly headerHeight: number;
	readonly footerHeight: number;
	readonly viewportHeight: number;
	readonly viewportWidth: number;
	readonly scrollHeight: number;
	readonly scrollWidth: number;
	readonly scrollTop: number;
	readonly horizontalScrollbarHeight: number;
	readonly showHorizontal: boolean;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** The custom vertical scrollbar's geometry for one measurement. */
export function computeDataGridScrollbarMetrics(measure: DataGridScrollMeasurement): DataGridScrollbarMetrics {
	const { headerHeight, footerHeight, viewportHeight, scrollHeight } = measure;
	const hasHorizontalOverflow = measure.showHorizontal && measure.scrollWidth > measure.viewportWidth + OVERFLOW_EPSILON_PX;
	const horizontalScrollbarSize = hasHorizontalOverflow
		? (measure.horizontalScrollbarHeight > 0 ? measure.horizontalScrollbarHeight : FALLBACK_SCROLLBAR_SIZE) + SCROLLBAR_EDGE_GAP
		: 0;
	// The horizontal bar overlays the bottom, which a sticky footer already covers: only the larger is taken off.
	const trackHeight = Math.max(0, viewportHeight - headerHeight - Math.max(footerHeight, horizontalScrollbarSize));
	const maxScroll = Math.max(0, scrollHeight - viewportHeight);
	if (trackHeight === 0 || maxScroll === 0) {
		return { hasVerticalOverflow: false, headerHeight, horizontalScrollbarSize, thumbHeight: trackHeight, thumbTop: 0, trackHeight };
	}
	const bodyContentHeight = Math.max(trackHeight, scrollHeight - headerHeight - footerHeight);
	const thumbHeight = clamp(trackHeight * (trackHeight / bodyContentHeight), MIN_THUMB_SIZE, trackHeight);
	const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
	const thumbTop = maxThumbTop > 0 ? (measure.scrollTop / maxScroll) * maxThumbTop : 0;
	return { hasVerticalOverflow: true, headerHeight, horizontalScrollbarSize, thumbHeight, thumbTop, trackHeight };
}

/** The scroll position a thumb offset maps to. */
export function getDataGridScrollTopForThumb(thumbOffset: number, metrics: DataGridScrollbarMetrics, maxScroll: number): number {
	const maxThumbTop = Math.max(0, metrics.trackHeight - metrics.thumbHeight);
	if (maxScroll === 0 || maxThumbTop === 0) {
		return 0;
	}
	return (clamp(thumbOffset, 0, maxThumbTop) / maxThumbTop) * maxScroll;
}

function areMetricsEqual(next: DataGridScrollbarMetrics, prev: DataGridScrollbarMetrics): boolean {
	return (
		next.hasVerticalOverflow === prev.hasVerticalOverflow &&
		next.headerHeight === prev.headerHeight &&
		next.horizontalScrollbarSize === prev.horizontalScrollbarSize &&
		next.thumbHeight === prev.thumbHeight &&
		next.thumbTop === prev.thumbTop &&
		next.trackHeight === prev.trackHeight
	);
}

/** A footer held at the bottom takes the track's lower end, the way the sticky header takes its top. */
function getStickyFooterHeight(table: HTMLElement | null): number {
	const footer = table instanceof HTMLTableElement ? table.tFoot : null;
	if (footer === null) {
		return 0;
	}
	const firstCell = footer.rows.item(0)?.cells.item(0) ?? null;
	const isSticky = [footer, firstCell].some((element) => element !== null && getComputedStyle(element).position === "sticky");
	return isSticky ? footer.getBoundingClientRect().height : 0;
}

/** Written on the overlay only: these inherit, and thumbTop changes every scroll frame. */
function applyMetrics(element: HTMLElement, metrics: DataGridScrollbarMetrics): void {
	element.style.setProperty("--data-grid-scrollbar-header-height", `${String(metrics.headerHeight)}px`);
	element.style.setProperty("--data-grid-scrollbar-thumb-height", `${String(metrics.thumbHeight)}px`);
	element.style.setProperty("--data-grid-scrollbar-thumb-top", `${String(metrics.thumbTop)}px`);
	element.style.setProperty("--data-grid-scrollbar-track-height", `${String(metrics.trackHeight)}px`);
}

function setBodyUserSelect(value: string): void {
	document.body.style.setProperty("user-select", value);
	document.body.style.setProperty("-webkit-user-select", value);
}

/**
 * Track footprint: `--data-grid-scrollbar-size` (10px default) in both
 * orientations, less the transparent border and padding, so every thumb lands
 * 3px thinner, held 1px off the grid edge.
 */
export const dataGridScrollbarVariants = cva(
	"flex touch-none p-px transition-colors select-none data-[orientation=horizontal]:mb-px data-[orientation=horizontal]:h-[var(--data-grid-scrollbar-size,0.625rem)] data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent data-[orientation=vertical]:me-px data-[orientation=vertical]:h-full data-[orientation=vertical]:w-[var(--data-grid-scrollbar-size,0.625rem)] data-[orientation=vertical]:border-s data-[orientation=vertical]:border-s-transparent",
	{
		variants: {
			orientation: {
				horizontal: "",
				vertical: "",
			},
		},
		defaultVariants: { orientation: "vertical" },
	},
);

/** The ::before reaches the track's outer edge, so the whole track thickness grabs the thumb. */
const SCROLLBAR_THUMB_CLASS_NAME = "relative flex-1 rounded-full bg-border before:absolute before:-inset-0.5";

export interface DataGridScrollAreaProps extends Omit<ScrollAreaPrimitive.Root.Props, "children"> {
	readonly children: React.ReactNode;
	readonly orientation?: DataGridScrollAreaOrientation;
}

interface ObservedElements {
	header: HTMLElement | null;
	horizontalScrollbar: HTMLElement | null;
	table: HTMLElement | null;
	tableViewport: HTMLElement | null;
}

interface ThumbDrag {
	readonly pointerId: number;
	readonly startScrollTop: number;
	readonly startY: number;
}

interface PinnedInsets {
	readonly start: number;
	readonly end: number;
}

const PINNED_INSETS_VISITOR: DataGridGridVisitor<PinnedInsets> = {
	visit: ({ table }) => ({ start: table.getStartTotalSize(), end: table.getEndTotalSize() }),
};

function readLayoutDirection(element: HTMLElement): boolean {
	return getComputedStyle(element).direction === "rtl";
}

/** The grid's scroll container, with thin overlay scrollbars. */
export const DataGridScrollArea = React.forwardRef<HTMLDivElement, DataGridScrollAreaProps>(function DataGridScrollArea(
	{ children, className, orientation = "both", ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, withGrid } = useDataGrid();
	const containerRef = React.useRef<HTMLDivElement>(null);
	const overlayRef = React.useRef<HTMLDivElement | null>(null);
	const viewportRef = React.useRef<HTMLDivElement | null>(null);
	const dragRef = React.useRef<ThumbDrag | null>(null);
	const metricsRef = React.useRef<DataGridScrollbarMetrics>(INITIAL_METRICS);
	const observedElementsRef = React.useRef<ObservedElements>({ header: null, horizontalScrollbar: null, table: null, tableViewport: null });

	const showHorizontal = orientation !== "vertical";
	const showVertical = orientation !== "horizontal";
	const usesCustomVerticalScrollbar = showVertical && gridProps.tableLayout.headerSticky;
	const isColumnsPinnable = gridProps.tableLayout.columnsPinnable;
	const pinnedInsets = React.useMemo((): PinnedInsets => withGrid(PINNED_INSETS_VISITOR), [withGrid]);
	const scrollbarInsetStart = isColumnsPinnable ? pinnedInsets.start : 0;
	const scrollbarInsetEnd = isColumnsPinnable ? pinnedInsets.end : 0;
	const horizontalScrollbarStyle = React.useMemo(
		(): React.CSSProperties | undefined =>
			scrollbarInsetStart > 0 || scrollbarInsetEnd > 0
				? {
						marginInlineStart: scrollbarInsetStart > 0 ? scrollbarInsetStart : undefined,
						marginInlineEnd: scrollbarInsetEnd > 0 ? scrollbarInsetEnd : undefined,
					}
				: undefined,
		[scrollbarInsetStart, scrollbarInsetEnd],
	);
	const [hasCustomVerticalOverflow, setHasCustomVerticalOverflow] = React.useState(false);

	// Base UI's thumb math reads direction from its own context, which a bare
	// dir="rtl" page never provides, so RTL is read off the layout. LTR passes
	// the inherited value through untouched.
	const inheritedDirection = useDirection();
	const [isLayoutRtl, setIsLayoutRtl] = React.useState(false);

	React.useLayoutEffect((): (() => void) | undefined => {
		const container = containerRef.current;
		if (container === null || !hasGlobalConstructor("MutationObserver")) {
			return undefined;
		}
		const readDirection = (): void => {
			setIsLayoutRtl(readLayoutDirection(container));
		};
		// Only a dir attribute flips it at runtime (an RTL toggle on <html>).
		const observer = new MutationObserver(readDirection);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"], subtree: true });
		const frame = requestAnimationFrame(readDirection);
		return (): void => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, []);

	const clearDragState = React.useCallback((): void => {
		dragRef.current = null;
		setBodyUserSelect("");
	}, []);

	// The overlay mounts one commit after the sync that detected overflow, so
	// seeding it from the ref callback lands the geometry before paint.
	const setOverlayRef = React.useCallback((node: HTMLDivElement | null): void => {
		overlayRef.current = node;
		if (node !== null) {
			applyMetrics(node, metricsRef.current);
		}
	}, []);

	const syncCustomVerticalScrollbar = React.useCallback((): void => {
		const viewport = viewportRef.current;
		if (viewport === null) {
			return;
		}
		const { header, horizontalScrollbar, table } = observedElementsRef.current;
		const nextMetrics = usesCustomVerticalScrollbar
			? computeDataGridScrollbarMetrics({
					headerHeight: header?.getBoundingClientRect().height ?? 0,
					footerHeight: getStickyFooterHeight(table),
					viewportHeight: viewport.clientHeight,
					viewportWidth: viewport.clientWidth,
					scrollHeight: viewport.scrollHeight,
					scrollWidth: viewport.scrollWidth,
					scrollTop: viewport.scrollTop,
					horizontalScrollbarHeight: horizontalScrollbar?.offsetHeight ?? 0,
					showHorizontal,
				})
			: INITIAL_METRICS;
		if (!areMetricsEqual(nextMetrics, metricsRef.current)) {
			metricsRef.current = nextMetrics;
			if (overlayRef.current !== null) {
				applyMetrics(overlayRef.current, nextMetrics);
			}
		}
		setHasCustomVerticalOverflow(nextMetrics.hasVerticalOverflow);
	}, [showHorizontal, usesCustomVerticalScrollbar]);

	React.useEffect((): (() => void) | undefined => {
		const container = containerRef.current;
		const viewport = viewportRef.current;
		if (container === null || viewport === null) {
			return undefined;
		}

		let frame = 0;
		const scheduleSync = (): void => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(syncCustomVerticalScrollbar);
		};

		if (!usesCustomVerticalScrollbar) {
			scheduleSync();
			return (): void => {
				cancelAnimationFrame(frame);
			};
		}

		const observer = hasGlobalConstructor("ResizeObserver") ? new ResizeObserver(scheduleSync) : null;
		const observed = new Set<HTMLElement>();
		const observeElement = (element: HTMLElement | null): void => {
			if (element !== null && observer !== null && !observed.has(element)) {
				observer.observe(element);
				observed.add(element);
			}
		};
		const resolveObservedElements = (): boolean => {
			observedElementsRef.current = {
				header: container.querySelector<HTMLElement>('[data-slot="data-grid-table"] thead'),
				horizontalScrollbar: container.querySelector<HTMLElement>('[data-slot="data-grid-scrollbar"][data-orientation="horizontal"]'),
				table: container.querySelector<HTMLElement>('[data-slot="data-grid-table"]'),
				tableViewport: container.querySelector<HTMLElement>('[data-slot="data-grid-table-viewport"]'),
			};
			observeElement(observedElementsRef.current.header);
			observeElement(observedElementsRef.current.table);
			observeElement(observedElementsRef.current.tableViewport);
			return observedElementsRef.current.header !== null && observedElementsRef.current.table !== null;
		};

		observeElement(viewport);
		const resolvedOnMount = resolveObservedElements();
		scheduleSync();
		viewport.addEventListener("scroll", scheduleSync, { passive: true });

		// A table that mounts after this effect (empty state swapped for data)
		// would otherwise never be observed. One-shot: disconnects once resolved.
		let mutationObserver: MutationObserver | null = null;
		if (!resolvedOnMount && hasGlobalConstructor("MutationObserver")) {
			const watcher = new MutationObserver((): void => {
				if (resolveObservedElements()) {
					watcher.disconnect();
					mutationObserver = null;
					scheduleSync();
				}
			});
			watcher.observe(container, { childList: true, subtree: true });
			mutationObserver = watcher;
		}

		return (): void => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
			mutationObserver?.disconnect();
			viewport.removeEventListener("scroll", scheduleSync);
			clearDragState();
		};
	}, [clearDragState, syncCustomVerticalScrollbar, usesCustomVerticalScrollbar]);

	const handleThumbPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
		const viewport = viewportRef.current;
		if (viewport === null) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = { pointerId: event.pointerId, startScrollTop: viewport.scrollTop, startY: event.clientY };
		setBodyUserSelect("none");
	}, []);

	const handleThumbPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
		const viewport = viewportRef.current;
		const dragState = dragRef.current;
		if (viewport === null || dragState?.pointerId !== event.pointerId) {
			return;
		}
		const { thumbHeight, trackHeight } = metricsRef.current;
		const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
		const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
		if (maxThumbTop === 0 || maxScroll === 0) {
			return;
		}
		const deltaY = event.clientY - dragState.startY;
		viewport.scrollTop = clamp(dragState.startScrollTop + (deltaY / maxThumbTop) * maxScroll, 0, maxScroll);
	}, []);

	const handleThumbPointerUp = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			if (dragRef.current?.pointerId === event.pointerId) {
				clearDragState();
			}
		},
		[clearDragState],
	);

	const handleTrackPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
		const viewport = viewportRef.current;
		if (event.target !== event.currentTarget || viewport === null) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		const metrics = metricsRef.current;
		const rect = event.currentTarget.getBoundingClientRect();
		const offsetY = event.clientY - rect.top - metrics.thumbHeight / 2;
		viewport.scrollTop = getDataGridScrollTopForThumb(offsetY, metrics, Math.max(0, viewport.scrollHeight - viewport.clientHeight));
	}, []);

	return (
		<DirectionProvider direction={isLayoutRtl ? "rtl" : inheritedDirection}>
			<div ref={containerRef} className="relative">
				<ScrollAreaPrimitive.Root
					ref={ref}
					data-slot="data-grid-scroll-area"
					// Present while the sticky-header mode detects vertical overflow, for ancestor styling.
					data-overflow-vertical={hasCustomVerticalOverflow ? "true" : undefined}
					className={cn("relative", className)}
					{...props}>
					<ScrollAreaPrimitive.Viewport ref={viewportRef} data-slot="scroll-area-viewport" className="size-full">
						<ScrollAreaPrimitive.Content data-slot="scroll-area-content">{children}</ScrollAreaPrimitive.Content>
					</ScrollAreaPrimitive.Viewport>

					{showHorizontal ? (
						<ScrollAreaPrimitive.Scrollbar
							data-slot="data-grid-scrollbar"
							data-orientation="horizontal"
							orientation="horizontal"
							className={dataGridScrollbarVariants({ orientation: "horizontal" })}
							style={horizontalScrollbarStyle}>
							<ScrollAreaPrimitive.Thumb data-slot="data-grid-thumb" className={SCROLLBAR_THUMB_CLASS_NAME} />
						</ScrollAreaPrimitive.Scrollbar>
					) : null}

					{showVertical && !usesCustomVerticalScrollbar ? (
						<ScrollAreaPrimitive.Scrollbar
							data-slot="data-grid-scrollbar"
							data-orientation="vertical"
							orientation="vertical"
							className={dataGridScrollbarVariants({ orientation: "vertical" })}>
							<ScrollAreaPrimitive.Thumb data-slot="data-grid-thumb" className={SCROLLBAR_THUMB_CLASS_NAME} />
						</ScrollAreaPrimitive.Scrollbar>
					) : null}
				</ScrollAreaPrimitive.Root>

				{usesCustomVerticalScrollbar && hasCustomVerticalOverflow ? (
					<div
						ref={setOverlayRef}
						aria-hidden="true"
						data-slot="data-grid-scrollbar-overlay"
						className="pointer-events-none absolute inset-e-px top-(--data-grid-scrollbar-header-height) z-20 h-(--data-grid-scrollbar-track-height)">
						{/* Pointer-only affordance mirroring the native thumb; keyboard and wheel scroll the viewport itself. */}
						<div
							role="presentation"
							className="pointer-events-auto relative h-full w-[var(--data-grid-scrollbar-size,0.625rem)] touch-none p-px"
							onPointerDown={handleTrackPointerDown}>
							<div
								role="presentation"
								className="absolute end-px top-(--data-grid-scrollbar-thumb-top) h-(--data-grid-scrollbar-thumb-height) w-[calc(var(--data-grid-scrollbar-size,0.625rem)-0.1875rem)] rounded-full bg-border before:absolute before:-inset-0.5"
								onLostPointerCapture={clearDragState}
								onPointerCancel={handleThumbPointerUp}
								onPointerDown={handleThumbPointerDown}
								onPointerMove={handleThumbPointerMove}
								onPointerUp={handleThumbPointerUp}
							/>
						</div>
					</div>
				) : null}
			</div>
		</DirectionProvider>
	);
});
