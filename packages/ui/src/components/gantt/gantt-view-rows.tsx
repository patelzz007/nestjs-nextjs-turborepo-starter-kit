"use client";

// GanttView's rows (enhancement 8.1: split from gantt-view.tsx): the tree row and the timeline row, with their
// ghost and draft snapshots.

import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@workspace/ui/components/context-menu";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronRightIcon, GripVerticalIcon } from "lucide-react";
import * as React from "react";
import { type GanttColumn, type GanttColumnContext, type GanttLineStroke, useGantt, useGanttSelector, useGanttSettings, useGanttViewConfig } from "./gantt";
import { GanttBar } from "./gantt-bar";
import { GANTT_DEFAULT_COLOR, useGanttGestures, wasRecentDrag } from "./gantt-dnd";
import { MS_PER_MINUTE, toZoned } from "./gantt-lib";
import { DEFAULT_ROW_ALIGN, resolveScheduleMode } from "./gantt-store";
import type { GanttDragKind, GanttSegment, GanttState } from "./gantt-types";
import { type HintStop, type TimelineRow, type TimelineRowBars, fractionOfRange, laneBlockRem, laneTopRem, lowestFreeLane, resolveLabelPlacement } from "./gantt-view-layout";
import { COLUMN_ALIGN_CLASS, CONTENT_LAYER_STYLE, GanttSummaryStrip, columnWidthStyle } from "./gantt-view-chrome";
import {
	GANTT_LAYER,
	type GanttStyle,
	MIN_BAR_WIDTH_PERCENT,
	PERCENT,
	ROW_STATIC_MARK,
	TREE_INDENT_REM,
	isElement,
	milestoneInset,
	percent,
	rem,
	trackPoint,
	windowStyle,
} from "./gantt-view-shared";

/** Chrome clicks (chevron, checkbox, grip) are their own actions, not row clicks. */
export function isChromeClick(target: EventTarget): boolean {
	return isElement(target) && target.closest("button, [role=checkbox]") !== null;
}

export interface GanttTreeRowProps {
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

/** Memoized: only rows whose props actually changed re-render. */
export const GanttTreeRow = React.memo(function GanttTreeRow({
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

export interface GhostSnapshot {
	readonly from: number;
	readonly to: number;
	readonly color?: string | undefined;
	readonly valid: boolean;
	readonly title: string;
	readonly kind: GanttDragKind;
	readonly occurrenceKey: string;
	readonly milestone: boolean;
}

export interface DraftSnapshot {
	readonly from: number;
	readonly to: number;
	readonly startMs: number;
	readonly endMs: number;
}

export interface GanttTimelineRowProps {
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

export const NO_SEGMENTS: readonly GanttSegment[] = [];

/** The drag-create / hint slot for a snapped unit (never zero-length). */
export function slotForStop(stop: HintStop, resourceId: string): { readonly start: Date; readonly end: Date; readonly allDay: boolean; readonly resourceId: string } {
	return { start: new Date(stop.ms), end: new Date(Math.max(stop.endMs, stop.ms + 1)), allDay: false, resourceId };
}

export const GanttTimelineRow = React.memo(function GanttTimelineRow({
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

export function isSameGhost(a: GhostSnapshot | null, b: GhostSnapshot | null): boolean {
	return a === b || (a !== null && b !== null && a.from === b.from && a.to === b.to && a.valid === b.valid && a.kind === b.kind && a.occurrenceKey === b.occurrenceKey);
}

export function isSameDraft(a: DraftSnapshot | null, b: DraftSnapshot | null): boolean {
	return a === b || (a !== null && b !== null && a.startMs === b.startMs && a.endMs === b.endMs && a.from === b.from && a.to === b.to);
}

export function ghostStyle(ghost: GhostSnapshot, laneHeightRem: number, topRem: number, ghostHeightRem: number): GanttStyle {
	return {
		insetInlineStart: ghost.milestone ? milestoneInset(ghost.from, laneHeightRem) : percent(ghost.from),
		width: ghost.milestone ? rem(laneHeightRem) : `${String(Math.max((ghost.to - ghost.from) * PERCENT, MIN_BAR_WIDTH_PERCENT))}%`,
		top: rem(topRem),
		zIndex: GANTT_LAYER.ghost,
		"--gantt-ghost-height": rem(ghostHeightRem),
		"--gantt-event-color": ghost.color ?? GANTT_DEFAULT_COLOR,
	};
}

export function draftStyle(draft: DraftSnapshot, topRem: number, laneHeightRem: number): React.CSSProperties {
	return {
		insetInlineStart: percent(draft.from),
		width: `${String(Math.max((draft.to - draft.from) * PERCENT, MIN_BAR_WIDTH_PERCENT))}%`,
		top: rem(topRem),
		height: rem(laneHeightRem),
		zIndex: GANTT_LAYER.ghost,
	};
}

export function draftLabelStyle(draft: DraftSnapshot, topRem: number, laneHeightRem: number): React.CSSProperties {
	return { insetInlineStart: percent(draft.to), top: rem(topRem), height: rem(laneHeightRem), zIndex: GANTT_LAYER.ghost };
}

export function hintStyle(topRem: number): React.CSSProperties {
	return { insetInlineStart: "var(--gantt-hint-x, 50%)", top: rem(topRem), zIndex: GANTT_LAYER.hint };
}
