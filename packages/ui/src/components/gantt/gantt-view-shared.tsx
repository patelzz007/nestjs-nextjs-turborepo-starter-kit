"use client";

// GanttView's constants and small helpers (enhancement 8.1: split from gantt-view.tsx): sizes, timings, style
// builders, scroll and wheel arithmetic, and the store selectors the view and its rows share.

import * as React from "react";
import { type GanttLineStroke, type UseGanttSelectorOptions, isSameOccurrenceList } from "./gantt";
import { GANTT_DEFAULT_COLOR } from "./gantt-dnd";
import { type GanttLaneMemo, getDayKey, getRangeKey } from "./gantt-lib";
import { type GanttInstance } from "./gantt-store";
import type { GanttData, GanttDateRange, GanttOccurrence, GanttResourceReorder, GanttState } from "./gantt-types";

export const DEFAULT_TREE_PANEL = { width: 288, minWidth: 180, maxWidth: 640, resizable: true, nameColumnWidth: 208 };
export const DEFAULT_COLUMN_WIDTH_PX = 96;
export const DEFAULT_ZOOM = 1;
export const DEFAULT_ZOOM_MIN = 0.5;
export const DEFAULT_ZOOM_MAX = 3;
export const DEFAULT_ZOOM_STEP = 0.25;
/** Wheel/pinch zoom sensitivity: zoom × e^(−deltaY × this). */
export const WHEEL_ZOOM_RATE = 0.002;
/** Below this change a wheel zoom is a no-op and the browser keeps the gesture. */
export const WHEEL_ZOOM_EPSILON = 1e-4;
export const ZOOM_DECIMALS = 4;
export const ZOOM_STEP_DECIMALS = 2;
/** Wheel deltaMode line / page units → px. */
export const WHEEL_LINE_PX = 16;
export const WHEEL_PAGE_PX = 400;
export const DOM_DELTA_LINE = 1;
export const DOM_DELTA_PAGE = 2;
export const MIN_TIMELINE_WIDTH_PX = 200;
export const INFINITE_EDGE_PX = 160;
/** Scroll events this long after the last user gesture still count as user scrolling. */
export const USER_SCROLL_WINDOW_MS = 1200;
/** A track within this many px of the pane width has nothing to scroll. */
export const SCROLL_SLACK_PX = 8;
/** Splitter keyboard step (px). */
export const SPLITTER_KEY_STEP_PX = 16;
/** Header / canvas pan activates after this much travel (px). */
export const PAN_ACTIVATION_PX = 4;
/** Indent per tree level (rem). */
export const TREE_INDENT_REM = 0.875;
/** Pending-layout retries before centring gives up waiting for a measured pane. */
export const MAX_SEAT_ATTEMPTS = 20;
/** Root font size fallback (px per rem) before the document is measured. */
export const FALLBACK_REM_PX = 16;
export const DEFAULT_VIRTUALIZATION_THRESHOLD = 60;
export const DEFAULT_OVERSCAN_ROWS = 8;
/** Smallest rendered bar width (% of the track) so a sliver stays visible. */
export const MIN_BAR_WIDTH_PERCENT = 0.5;
export const PERCENT = 100;
/** Dependency route clearance, arrowhead size and stroke (rem / px). */
export const DEPENDENCY_CLEARANCE_REM = 0.625;
export const DEPENDENCY_ARROW_REM = 0.375;
export const DEPENDENCY_STROKE_PX = 1.5;
/** Offscreen chips: header clearance, bottom clearance, jump inset and zoom-control dodge (px). */
export const CHIP_HEADER_CLEARANCE_PX = 10;
export const CHIP_BOTTOM_CLEARANCE_PX = 16;
export const CHIP_JUMP_INSET_PX = 24;
export const CHIP_EDGE_TOLERANCE_PX = 2;
export const CHIP_ZOOM_BAND_PX = 8;
export const CHIP_ZOOM_SHIFT_PX = 28;
export const TOOLTIP_DELAY_MS = 600;
export const TOOLTIP_TIMEOUT_MS = 300;
/** Reorder caret sits this far above the insertion line (px). */
export const REORDER_CARET_OFFSET_PX = 4;
/** Fallback grab offset / row height for a reorder whose row was not measured (px). */
export const REORDER_FALLBACK_GRAB_PX = 8;
export const REORDER_FALLBACK_ROW_PX = 40;

/** In-gantt stacking: the gantt root is an isolated stacking context, so these stay local. */
export const GANTT_LAYER = { nowLine: 10, bar: 10, stickyHeader: 30, hint: 30, chips: 30, ghost: 40, chrome: 40, loading: 50, reorder: 60 };

export const OFF_DAY_CLASS = "bg-muted/40";
export const OFF_DAY_BODY_CLASS =
	"bg-muted/25 bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,color-mix(in_oklab,var(--color-border)_35%,transparent)_5px,color-mix(in_oklab,var(--color-border)_35%,transparent)_6px)]";
export const DASHED_LINE_CLASS = "bg-[repeating-linear-gradient(to_bottom,var(--color-border)_0,var(--color-border)_3px,transparent_3px,transparent_6px)]";

export const ROW_STATIC_MARK = "";

/* -------------------------------------------------------------------------- */
/*                                Style helpers                               */
/* -------------------------------------------------------------------------- */

export type GanttStyle = React.CSSProperties & Partial<Record<"--gantt-event-color" | "--gantt-ghost-height", string>>;

export function percent(fraction: number): string {
	return `${String(fraction * PERCENT)}%`;
}

export function rem(value: number): string {
	return `${String(value)}rem`;
}

export function spanStyle(start: number, width: number): React.CSSProperties {
	return { insetInlineStart: percent(start), width: percent(width) };
}

export function lineStyle(fraction: number): React.CSSProperties {
	return { insetInlineStart: `calc(${percent(fraction)} - 1px)` };
}

export function flexStyle(weight: number): React.CSSProperties {
	return { flex: `${String(weight)} 0 0px` };
}

/** A lane-height square centred on an instant, clamped into the row box (a milestone). */
export function milestoneInset(from: number, laneHeightRem: number): string {
	return `clamp(0rem, ${percent(from)} - ${rem(laneHeightRem / 2)}, 100% - ${rem(laneHeightRem)})`;
}

export function windowStyle(from: number, to: number, isMilestone: boolean, laneHeightRem: number, top: number, height: number, color: string | undefined): GanttStyle {
	return {
		"--gantt-event-color": color ?? GANTT_DEFAULT_COLOR,
		insetInlineStart: isMilestone ? milestoneInset(from, laneHeightRem) : percent(from),
		width: isMilestone ? rem(laneHeightRem) : `${String(Math.max((to - from) * PERCENT, MIN_BAR_WIDTH_PERCENT))}%`,
		top: rem(top),
		height: rem(height),
	};
}

export function strokeClass(stroke: GanttLineStroke | null): string {
	return stroke === "dashed" ? DASHED_LINE_CLASS : "bg-border";
}

/* -------------------------------------------------------------------------- */
/*                               DOM utilities                                */
/* -------------------------------------------------------------------------- */

/** The pane's scrollable viewport (custom ScrollArea or native host). */
export function getPaneViewport(pane: HTMLElement | null): HTMLElement | null {
	return pane?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]") ?? null;
}

/** Distance scrolled from the inline-start edge (RTL reports negative). */
export function getScrollStart(viewport: HTMLElement): number {
	return Math.abs(viewport.scrollLeft);
}

export function setScrollStart(viewport: HTMLElement, value: number): void {
	viewport.scrollLeft = getComputedStyle(viewport).direction === "rtl" ? -value : value;
}

export interface LiveAxis {
	readonly startMs: number;
	readonly endMs: number;
}

/** The axis range as rendered (the DOM may lag React by a frame during growth). */
export function readLiveAxis(viewport: HTMLElement): LiveAxis | null {
	const axis = viewport.querySelector<HTMLElement>("[data-gantt-axis]");
	const startMs = Number(axis?.dataset.ganttRangeStart);
	const endMs = Number(axis?.dataset.ganttRangeEnd);
	return axis === null || Number.isNaN(startMs) || Number.isNaN(endMs) ? null : { startMs, endMs };
}

/**
 * The time axis's own laid-out width: the pixels its range maps onto. Not the viewport's `scrollWidth`, which also
 * counts anything overflowing past the axis's end (a bar's label): mapping an instant through that put "today" off
 * centre by half the overflow, and only once the overflowing text had laid out (so by a different amount per run).
 * The viewport's scroll width stands in before the axis renders.
 */
export function readAxisWidth(viewport: HTMLElement): number {
	return viewport.querySelector<HTMLElement>("[data-gantt-axis]")?.offsetWidth ?? viewport.scrollWidth;
}

/** Pointer x against an element's TIME axis: the 0..1 fraction and the pixel-snapped offset (RTL mirrored). */
export function trackPoint(element: HTMLElement, clientX: number): { readonly fraction: number; readonly offset: number } {
	const rect = element.getBoundingClientRect();
	const isRtl = getComputedStyle(element).direction === "rtl";
	const offset = isRtl ? rect.right - clientX : clientX - rect.left;
	const snapped = isRtl ? rect.right - Math.round(clientX) : Math.round(clientX) - rect.left;
	return { fraction: rect.width > 0 ? offset / rect.width : 0, offset: snapped };
}

export function wheelUnitPx(event: WheelEvent, pageHeight: number): number {
	if (event.deltaMode === DOM_DELTA_LINE) {
		return WHEEL_LINE_PX;
	}
	return event.deltaMode === DOM_DELTA_PAGE ? pageHeight : 1;
}

export function readRemPx(): number {
	const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
	return Number.isFinite(size) && size > 0 ? size : FALLBACK_REM_PX;
}

export function isElement(target: EventTarget | null): target is Element {
	return target instanceof Element;
}

/* -------------------------------------------------------------------------- */
/*                                   Hooks                                    */
/* -------------------------------------------------------------------------- */

export function readServerTodayKey(): null {
	return null;
}

/** Today's zoned day key: re-renders only at the midnight rollover, never on the 30s now tick. */
export function useTodayKey(instance: GanttInstance, timeZone: string): string | null {
	const getSnapshot = (): string => getDayKey(new Date(instance.internals.getNowMs()), timeZone);
	return React.useSyncExternalStore(instance.internals.subscribeNow, getSnapshot, readServerTodayKey);
}

export interface LaneMemory {
	readonly read: () => ReadonlyMap<string, GanttLaneMemo>;
	readonly write: (lanes: ReadonlyMap<string, GanttLaneMemo>) => void;
}

/**
 * Lane memory across layout passes. The pass is idempotent (feeding its own
 * output back produces the same assignment), so a StrictMode double render is
 * a no-op.
 */
export function createLaneMemory(): LaneMemory {
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

export function isSameRange(a: GanttDateRange, b: GanttDateRange): boolean {
	return getRangeKey(a) === getRangeKey(b);
}

export const RANGE_SELECTOR_OPTIONS: UseGanttSelectorOptions<GanttData, GanttDateRange> = { isEqual: isSameRange };
export const OCCURRENCES_SELECTOR_OPTIONS: UseGanttSelectorOptions<GanttData, readonly GanttOccurrence[]> = { isEqual: isSameOccurrenceList };

export interface DraftLayout {
	readonly resourceId: string;
	readonly startMs: number;
	readonly endMs: number;
}

export function selectDraftLayout(state: GanttState): DraftLayout | null {
	const draft = state.slotDraft;
	return draft?.resourceId === undefined ? null : { resourceId: draft.resourceId, startMs: draft.start.getTime(), endMs: draft.end.getTime() };
}

export function isSameDraftLayout(a: DraftLayout | null, b: DraftLayout | null): boolean {
	return a === b || (a !== null && b !== null && a.resourceId === b.resourceId && a.startMs === b.startMs && a.endMs === b.endMs);
}

export const DRAFT_SELECTOR_OPTIONS: UseGanttSelectorOptions<GanttData, DraftLayout | null> = { isEqual: isSameDraftLayout };

/** Controlled-or-uncontrolled id list (selected rows, collapsed groups). */
export function useIdList(
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

export interface ReorderState {
	readonly resourceId: string;
	/** Insertion offset (px) within the tree pane. */
	readonly top: number;
	readonly valid: boolean;
	readonly proposal: GanttResourceReorder | null;
}

export interface PendingRestore {
	readonly ms: number;
	readonly align: "start" | "center";
	readonly offsetPx?: number | undefined;
}

/* -------------------------------------------------------------------------- */
/*                                  GanttView                                 */
/* -------------------------------------------------------------------------- */
