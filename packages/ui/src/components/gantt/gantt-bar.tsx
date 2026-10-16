"use client";

// Ported from ReUI (https://reui.io/r/base-vega/gantt-bar.json). `GanttBar`,
// `useGanttBarContext`, `GANTT_COLORS` and the `data-*` contract match ReUI,
// with these deliberate deviations:
// - `GANTT_COLORS` maps onto the kit's categorical tone tokens (`--tone-*`),
//   never palette primitives.
// - The bar is keyboard-movable: arrows move it one snap unit, Shift + arrows
//   move its end, Alt + arrows its start (announced and described).
// - `variant` / `size` CVA axes, a derived `state` axis, and a forwarded ref.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@workspace/ui/components/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon, RepeatIcon } from "lucide-react";
import * as React from "react";

import { useGantt, useGanttSelector, useGanttViewConfig, type GanttRenderEventProps } from "./gantt";
import { GANTT_DEFAULT_COLOR, useGanttGestures, wasRecentDrag } from "./gantt-dnd";
import { clampNumber, findResource, getBaselineVariance, resolveEventBaseline, toZoned } from "./gantt-lib";
import type { GanttDragKind, GanttOccurrence, GanttSegment, GanttState } from "./gantt-types";

export interface GanttColorOption {
	readonly name: string;
	readonly value: string;
}

/** Bar colour presets: the kit's categorical tones, legible on light and dark surfaces through the bar's alpha fill. */
export const GANTT_COLORS: readonly GanttColorOption[] = [
	{ name: "Blue", value: "var(--tone-blue)" },
	{ name: "Green", value: "var(--tone-green)" },
	{ name: "Violet", value: "var(--tone-violet)" },
	{ name: "Red", value: "var(--tone-red)" },
	{ name: "Yellow", value: "var(--tone-yellow)" },
	{ name: "Teal", value: "var(--tone-teal)" },
	{ name: "Orange", value: "var(--tone-orange)" },
];

const PERCENT_MIN = 0;
const PERCENT_MAX = 100;
/** Hover delay before a bar's range tooltip opens. */
const BAR_TOOLTIP_DELAY_MS = 500;
const BAR_TOOLTIP_TIMEOUT_MS = 300;

export interface GanttBarContextValue {
	readonly occurrence: GanttOccurrence;
	readonly segment: GanttSegment;
	readonly isDragging: boolean;
	readonly isSelected: boolean;
}

const GanttBarContext = React.createContext<GanttBarContextValue | null>(null);

/** The bar's subject; usable inside renderEvent content and bar children. */
export function useGanttBarContext(): GanttBarContextValue {
	const context = React.useContext(GanttBarContext);
	if (context === null) {
		throw new Error("useGanttBarContext must be used within <GanttBar>");
	}
	return context;
}

export const ganttBarVariants = cva(
	[
		"group/gantt-bar-group @container relative flex w-full min-w-0 cursor-pointer touch-none items-center gap-1.5 overflow-hidden rounded-sm text-start leading-normal text-foreground select-none",
		"outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
		"data-[drag-kind=move]:opacity-0 data-[drag-kind=resize-end]:opacity-40 data-[drag-kind=resize-start]:opacity-40",
		"data-milestone:justify-center data-milestone:bg-transparent data-milestone:px-0 data-milestone:hover:bg-transparent",
	],
	{
		variants: {
			variant: {
				default: "bg-(--gantt-event-color)/20 hover:bg-(--gantt-event-color)/30",
				outline: "border border-(--gantt-event-color)/55 bg-background hover:bg-(--gantt-event-color)/10",
			},
			size: {
				default: "px-1.5 py-0.5",
				sm: "px-1 py-0",
			},
			state: {
				default: "",
				selected: "bg-(--gantt-event-color)/30 data-milestone:bg-transparent",
				disabled: "cursor-default",
			},
		},
		defaultVariants: { variant: "default", size: "default", state: "default" },
	},
);

export interface GanttBarProps extends Omit<useRender.ComponentProps<"button">, "children">, VariantProps<typeof ganttBarVariants> {
	readonly segment: GanttSegment;
	/** Replaces the default bar CONTENT; the wrapper stays gantt-owned. */
	readonly children?: React.ReactNode;
	/** The title renders beside the bar (view-owned), so the default inner content is suppressed. */
	readonly labelOutside?: boolean | undefined;
	/** The owning row's title for the aria-label; omitting falls back to a tree lookup. */
	readonly rowTitle?: string | undefined;
}

function readServerPast(): boolean {
	return false;
}

/** Re-renders only when the bar crosses into the past, not on every clock tick. */
function useIsPast(endMs: number): boolean {
	const instance = useGantt();
	const getSnapshot = (): boolean => endMs < instance.internals.getNowMs();
	return React.useSyncExternalStore(instance.internals.subscribeNow, getSnapshot, readServerPast);
}

interface GanttResizeHandleProps {
	readonly edge: "start" | "end";
	readonly segment: GanttSegment;
	readonly onBegin: (event: React.PointerEvent<HTMLElement>, segment: GanttSegment, edge: "start" | "end") => void;
}

const HANDLE_EDGE_CLASS: Readonly<Record<"start" | "end", string>> = { start: "start-0.5 justify-start", end: "end-0.5 justify-end" };

function GanttResizeHandle({ edge, segment, onBegin }: GanttResizeHandleProps): React.JSX.Element {
	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLElement>): void => {
			onBegin(event, segment, edge);
		},
		[onBegin, segment, edge],
	);
	return (
		<span
			data-slot="gantt-resize-handle"
			data-edge={edge}
			aria-hidden
			className={cn(
				"absolute inset-y-0 flex w-2 cursor-ew-resize items-center opacity-0 group-hover/gantt-bar-group:opacity-100 pointer-coarse:opacity-100",
				HANDLE_EDGE_CLASS[edge],
			)}
			onPointerDown={handlePointerDown}>
			<span className="h-2.5 w-0.5 rounded-full bg-foreground/40" />
		</span>
	);
}

function selectDragKind(state: GanttState, key: string): GanttDragKind | null {
	return state.drag?.occurrence.key === key ? state.drag.kind : null;
}

/**
 * The one interactive bar element. The wrapper owns positioning hooks, a11y,
 * selection, drag/resize/keyboard listeners and data attributes; content comes
 * from children, the root renderEvent override, or the built-in default.
 */
export const GanttBar = React.forwardRef<HTMLButtonElement, GanttBarProps>(function GanttBar(
	{ segment, className, render, children, labelOutside, rowTitle: rowTitleProp, variant, size, ...props },
	ref,
): React.ReactElement {
	const instance = useGantt();
	const viewConfig = useGanttViewConfig();
	const gestures = useGanttGestures();
	const { settings } = instance;
	const occurrence = segment.occurrence;
	const event = occurrence.event;
	const descriptionId = React.useId();

	const isSelected = useGanttSelector((state: GanttState): boolean => state.selection.eventKeys.includes(occurrence.key));
	const dragKind = useGanttSelector((state: GanttState): GanttDragKind | null => selectDragKind(state, occurrence.key));
	const isDragging = dragKind !== null;
	// Hover-only range tooltip (focus opens are dropped so it never flashes when a dialog returns focus).
	const [isTipOpen, setTipOpen] = React.useState(false);
	const isInteracting = useGanttSelector((state: GanttState): boolean => isTipOpen && (state.drag !== null || state.slotDraft !== null));
	const isPast = useIsPast(occurrence.end.getTime());

	const progress = event.progress === undefined ? null : clampNumber(Math.round(event.progress), PERCENT_MIN, PERCENT_MAX);
	// A zero-duration occurrence is a MILESTONE: the diamond replaces the tinted body.
	const isMilestone = occurrence.end.getTime() === occurrence.start.getTime();
	const baseline = viewConfig.baselineBars ? resolveEventBaseline(event) : null;
	const baselineVariance = baseline === null ? null : getBaselineVariance(event);
	const canDrag = gestures.canDrag(segment);
	const canResize = gestures.canResize(segment);

	const { i18n, timeZone, locale } = settings;
	const timeLabel = i18n.functions.formatEventTime(toZoned(occurrence.start, timeZone), toZoned(occurrence.end, timeZone), occurrence.allDay, locale);
	const baselineStartMs = baseline?.start.getTime();
	const baselineEndMs = baseline?.end.getTime();
	const plannedLabel: string | undefined =
		baselineStartMs === undefined || baselineEndMs === undefined
			? undefined
			: i18n.labels.planned(
					i18n.functions.formatEventTime(toZoned(new Date(baselineStartMs), timeZone), toZoned(new Date(baselineEndMs), timeZone), occurrence.allDay, locale),
				);
	const fallbackRowTitle: string | undefined =
		rowTitleProp === undefined && event.resourceId !== undefined ? findResource(settings.resources, event.resourceId)?.title : undefined;
	const rowTitle = rowTitleProp ?? fallbackRowTitle;

	const renderProps = React.useMemo((): GanttRenderEventProps => ({ occurrence, segment, isDragging, isSelected }), [occurrence, segment, isDragging, isSelected]);
	const consumerContent = children ?? viewConfig.renderEvent?.(renderProps);
	// Consumer-owned content owns the WHOLE inner visualization (progress stays readable via data-progress).
	const isConsumerContent = children !== undefined || viewConfig.renderEvent !== undefined;
	const defaultContent =
		labelOutside === true || isMilestone ? null : (
			<>
				{occurrence.isRecurring ? <RepeatIcon aria-hidden className="size-2.5 shrink-0 opacity-70" /> : null}
				<span className="truncate font-medium">{event.title}</span>
				{!occurrence.allDay && segment.isStart ? <span className="hidden truncate text-muted-foreground @[8rem]:inline">{timeLabel}</span> : null}
			</>
		);

	const handlePointerDown = React.useCallback(
		(pointerEvent: React.PointerEvent<HTMLElement>): void => {
			pointerEvent.stopPropagation();
			gestures.beginMove(pointerEvent, segment);
		},
		[gestures, segment],
	);
	const handleClick = React.useCallback(
		(mouseEvent: React.MouseEvent<HTMLElement>): void => {
			mouseEvent.stopPropagation();
			if (wasRecentDrag()) {
				return;
			}
			instance.api.selectEvent(occurrence.key);
			instance.settings.onEventClick?.(occurrence, mouseEvent);
		},
		[instance, occurrence],
	);
	const handleDoubleClick = React.useCallback(
		(mouseEvent: React.MouseEvent<HTMLElement>): void => {
			mouseEvent.stopPropagation();
			instance.settings.onEventDoubleClick?.(occurrence, mouseEvent);
		},
		[instance, occurrence],
	);
	const handleKeyDown = React.useCallback(
		(keyboardEvent: React.KeyboardEvent<HTMLElement>): void => {
			if (gestures.handleKeyDown(keyboardEvent, segment)) {
				keyboardEvent.stopPropagation();
			}
		},
		[gestures, segment],
	);
	const handleTipOpenChange = React.useCallback((open: boolean, details: { readonly reason: string }): void => {
		// opens only on hover; focus/press opens are dropped
		if (open && details.reason !== "trigger-hover") {
			return;
		}
		setTipOpen(open);
	}, []);

	const style = React.useMemo(
		(): React.CSSProperties & Record<"--gantt-event-color", string> => ({ "--gantt-event-color": event.color ?? GANTT_DEFAULT_COLOR }),
		[event.color],
	);
	const progressStyle = React.useMemo((): React.CSSProperties => ({ width: `${String(progress ?? 0)}%` }), [progress]);
	const isMovable = canDrag || canResize;

	const dataAttributes: Readonly<Record<string, string | number | undefined>> = {
		"data-slot": "gantt-bar",
		"data-milestone": presence(isMilestone),
		"data-all-day": presence(occurrence.allDay),
		"data-recurring": presence(occurrence.isRecurring),
		"data-selected": presence(isSelected),
		"data-dragging": presence(isDragging),
		"data-drag-kind": dragKind ?? undefined,
		"data-past": presence(isPast),
		"data-label-outside": presence(labelOutside === true),
		"data-progress": progress ?? undefined,
		"data-completed": presence(progress === PERCENT_MAX),
		"data-baseline": presence(baseline !== null),
		"data-baseline-variance": baselineVariance ?? undefined,
	};
	const element = useRender({
		ref,
		defaultTagName: "button",
		render,
		props: mergeProps<"button">(
			{
				type: "button",
				...dataAttributes,
				"aria-label": i18n.functions.formatEventAriaLabel({
					title: event.title,
					timeLabel,
					milestoneLabel: isMilestone ? i18n.labels.milestone : undefined,
					rowTitle,
					progressLabel: progress === null ? undefined : i18n.labels.progress(progress),
					plannedLabel,
					continues: segment.continuesBefore || segment.continuesAfter,
				}),
				"aria-describedby": isMovable ? descriptionId : undefined,
				"aria-pressed": isSelected,
				style,
				onPointerDown: handlePointerDown,
				onClick: handleClick,
				onDoubleClick: handleDoubleClick,
				onKeyDown: handleKeyDown,
				className: cn(
					ganttBarVariants({ variant, size, state: isSelected ? "selected" : isMovable ? "default" : "disabled" }),
					segment.continuesBefore && "rounded-s-none",
					segment.continuesAfter && "rounded-e-none",
					viewConfig.classNames?.event,
					className,
				),
				children: (
					<>
						{isMilestone && !isConsumerContent ? (
							<span
								aria-hidden
								data-slot="gantt-bar-milestone"
								className={cn("size-2.5 shrink-0 rotate-45 rounded-xs border border-(--gantt-event-color) bg-(--gantt-event-color)/80", isSelected && "ring-2 ring-ring/50")}
							/>
						) : null}
						{progress !== null && !isMilestone ? (
							<span
								aria-hidden
								data-slot="gantt-bar-progress"
								data-full={progress === PERCENT_MAX ? "" : undefined}
								className="pointer-events-none absolute inset-y-0 start-0 border-e border-(--gantt-event-color)/65 bg-(--gantt-event-color)/40 data-full:border-e-0"
								style={progressStyle}
							/>
						) : null}
						{progress === PERCENT_MAX && !isConsumerContent && !isMilestone ? <CheckIcon aria-hidden className="relative size-2.5 shrink-0 opacity-80" /> : null}
						{isConsumerContent ? consumerContent : defaultContent}
						{canResize && segment.isStart ? <GanttResizeHandle edge="start" segment={segment} onBegin={gestures.beginResize} /> : null}
						{canResize && segment.isEnd ? <GanttResizeHandle edge="end" segment={segment} onBegin={gestures.beginResize} /> : null}
						{isMovable ? (
							<span id={descriptionId} className="sr-only">
								{i18n.labels.barKeyboardHint}
							</span>
						) : null}
					</>
				),
			},
			props,
		),
	});

	const menu = viewConfig.renderEventMenu?.(renderProps);
	const trigger = menu === undefined || menu === null ? <TooltipTrigger render={element} /> : <ContextMenuTrigger render={<TooltipTrigger render={element} />} />;
	const isTooltipVisible = isTipOpen && !isInteracting;
	const barTree = (
		<TooltipProvider delay={BAR_TOOLTIP_DELAY_MS} closeDelay={0} timeout={BAR_TOOLTIP_TIMEOUT_MS}>
			<Tooltip open={isTooltipVisible} onOpenChange={handleTipOpenChange}>
				{trigger}
				{isTooltipVisible ? (
					<TooltipContent side="top" className="pointer-events-none flex-col items-start gap-0">
						<div className="font-medium">{event.title}</div>
						<div className="opacity-80">{timeLabel}</div>
						{plannedLabel === undefined ? null : <div className="opacity-80">{plannedLabel}</div>}
					</TooltipContent>
				) : null}
			</Tooltip>
		</TooltipProvider>
	);

	const contextValue = React.useMemo((): GanttBarContextValue => ({ occurrence, segment, isDragging, isSelected }), [occurrence, segment, isDragging, isSelected]);
	return (
		<GanttBarContext.Provider value={contextValue}>
			{menu === undefined || menu === null ? (
				barTree
			) : (
				<ContextMenu>
					{barTree}
					<ContextMenuContent data-slot="gantt-bar-menu" className="min-w-44">
						{menu}
					</ContextMenuContent>
				</ContextMenu>
			)}
		</GanttBarContext.Provider>
	);
});

/** A boolean as a `data-*` presence attribute ("" when on, absent when off). */
function presence(isOn: boolean): "" | undefined {
	return isOn ? "" : undefined;
}
