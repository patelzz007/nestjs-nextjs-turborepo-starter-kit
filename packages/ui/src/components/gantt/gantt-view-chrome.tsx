"use client";

// GanttView's chrome (enhancement 8.1: split from gantt-view.tsx): the zoom buttons, the now-line, the drag
// layer, the dependency arrows, the summary strip and the off-screen chips.

import { hasGlobalConstructor } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/core/utils";
import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { type GanttColumn, type UseGanttSelectorOptions, useGanttSelector, useGanttSettings, useGanttViewConfig } from "./gantt";
import { GANTT_DEFAULT_COLOR } from "./gantt-dnd";
import { localeOptions } from "./gantt-i18n";
import { buildDependencyPath, resolveEventBaseline, toZoned } from "./gantt-lib";
import type { GanttData, GanttOccurrence, GanttScale, GanttState } from "./gantt-types";
import { type DependencyEdge, type TimelineRow, type TimelineRowBars, fractionOfRange } from "./gantt-view-layout";
import {
	readAxisWidth,
	CHIP_BOTTOM_CLEARANCE_PX,
	CHIP_EDGE_TOLERANCE_PX,
	CHIP_HEADER_CLEARANCE_PX,
	CHIP_JUMP_INSET_PX,
	CHIP_ZOOM_BAND_PX,
	CHIP_ZOOM_SHIFT_PX,
	DEFAULT_COLUMN_WIDTH_PX,
	DEPENDENCY_ARROW_REM,
	DEPENDENCY_CLEARANCE_REM,
	DEPENDENCY_STROKE_PX,
	GANTT_LAYER,
	type GanttStyle,
	MIN_BAR_WIDTH_PERCENT,
	PERCENT,
	TOOLTIP_DELAY_MS,
	TOOLTIP_TIMEOUT_MS,
	getPaneViewport,
	getScrollStart,
	percent,
	rem,
} from "./gantt-view-shared";

export const NO_COLUMNS: readonly GanttColumn[] = [];

export const PERIOD_KEY_FORMAT: Readonly<Record<GanttScale, string>> = { day: "yyyy-MM-dd", week: "RRRR-'W'II", month: "yyyy-MM", quarter: "yyyy-qqq", year: "yyyy" };

export const COLUMN_ALIGN_CLASS: Readonly<Record<"start" | "center" | "end", string>> = { start: "", center: "justify-center", end: "justify-end" };

export const STICKY_HEADER_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.stickyHeader };
export const CHROME_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.chrome };
export const SCROLLBAR_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.chrome };
export const LOADING_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.loading };
export const CONTENT_LAYER_STYLE: React.CSSProperties = { contentVisibility: "auto" };
export const HIDDEN_STYLE: React.CSSProperties = { visibility: "hidden" };

export function scaleAttribute(scale: GanttScale): Readonly<Record<"data-scale", GanttScale>> {
	return { "data-scale": scale };
}

export function stickyTrackHeaderStyle(trackWidth: string): React.CSSProperties {
	return { minWidth: trackWidth, zIndex: GANTT_LAYER.stickyHeader };
}

export function columnWidthStyle(column: GanttColumn): React.CSSProperties {
	return { width: column.width ?? DEFAULT_COLUMN_WIDTH_PX };
}

/* -------------------------------------------------------------------------- */
/*                                 Sub-parts                                  */
/* -------------------------------------------------------------------------- */

export interface GanttZoomButtonProps {
	readonly label: string;
	readonly isEnabled: boolean;
	readonly onClick: () => void;
	readonly edge: "top" | "bottom";
	readonly children: React.ReactNode;
}

/** aria-disabled (not disabled) so the not-allowed cursor still shows at the zoom limits. */
export function GanttZoomButton({ label, isEnabled, onClick, edge, children }: GanttZoomButtonProps): React.JSX.Element {
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

export interface GanttNowMarkProps {
	readonly kind: "line" | "dot";
	readonly nowMs: number | null;
	readonly rangeStartMs: number;
	readonly rangeEndMs: number;
}

/** The now-line (body) or its dot cap (header). Hidden until the client has read the clock. */
export function GanttNowMark({ kind, nowMs, rangeStartMs, rangeEndMs }: GanttNowMarkProps): React.JSX.Element | null {
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
export function GanttCustomDragLayer(): React.JSX.Element | null {
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

export interface DragLink {
	readonly eventId: string;
	readonly startMs: number;
	readonly endMs: number;
}

export function selectDragLink(state: GanttState): DragLink | null {
	return state.drag === null ? null : { eventId: state.drag.occurrence.eventId, startMs: state.drag.proposedStart.getTime(), endMs: state.drag.proposedEnd.getTime() };
}

export function isSameDragLink(a: DragLink | null, b: DragLink | null): boolean {
	return a === b || (a !== null && b !== null && a.eventId === b.eventId && a.startMs === b.startMs && a.endMs === b.endMs);
}

export const DRAG_LINK_OPTIONS: UseGanttSelectorOptions<GanttData, DragLink | null> = { isEqual: isSameDragLink };

export interface GanttDependencyLayerProps {
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
export const GanttDependencyLayer = React.memo(function GanttDependencyLayer({
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

export interface GanttSummaryStripProps {
	readonly resource: TimelineRow["resource"];
	readonly summary: NonNullable<TimelineRowBars["summary"]>;
	readonly rangeStartMs: number;
	readonly rangeEndMs: number;
}

/** Parent rollup: the descendant envelope with duration-weighted progress. */
export function GanttSummaryStrip({ resource, summary, rangeStartMs, rangeEndMs }: GanttSummaryStripProps): React.JSX.Element {
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

export interface OffscreenChip {
	readonly id: string;
	readonly side: "start" | "end";
	readonly top: number;
	readonly color?: string | undefined;
	readonly label: string;
	readonly startMs: number | null;
	/** Distance from the inline start that brings the bar back into view. */
	readonly target: number;
}

export function isSameChipList(a: readonly OffscreenChip[], b: readonly OffscreenChip[]): boolean {
	return (
		a.length === b.length &&
		a.every((chip: OffscreenChip, index: number): boolean => {
			const other = b.at(index);
			return chip.id === other?.id && chip.side === other.side && chip.top === other.top && chip.target === other.target;
		})
	);
}

export interface GanttOffscreenChipsProps {
	readonly paneRef: React.RefObject<HTMLDivElement | null>;
	readonly occurrences: readonly GanttOccurrence[];
	readonly refreshKey: string;
}

/**
 * Edge chips for rows whose bars sit entirely outside the visible timeline;
 * clicking scrolls the bar back into view and focuses it. Geometry is read
 * from the rows' data attributes, so scrolling never re-renders the grid.
 */
export function GanttOffscreenChips({ paneRef, occurrences, refreshKey }: GanttOffscreenChipsProps): React.JSX.Element | null {
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

export const CHIPS_LAYER_STYLE: React.CSSProperties = { zIndex: GANTT_LAYER.chips };

export function measureOffscreenChips(pane: HTMLElement, viewport: HTMLElement): OffscreenChip[] {
	const paneRect = pane.getBoundingClientRect();
	const header = viewport.querySelector<HTMLElement>("[data-slot=gantt-timeline-header]");
	const headerBottom = header === null ? 0 : header.getBoundingClientRect().bottom - paneRect.top;
	const trackWidth = readAxisWidth(viewport);
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

export interface GanttOffscreenChipProps {
	readonly chip: OffscreenChip;
	readonly paneRef: React.RefObject<HTMLDivElement | null>;
}

export function GanttOffscreenChip({ chip, paneRef }: GanttOffscreenChipProps): React.JSX.Element {
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
