// A Gantt chart for a phone: a tree of rows beside a timeline that scrolls sideways, each row's work drawn as
// bars (with progress, planned baselines and milestones), group rows rolled up, dependency arrows between bars,
// weekends and holidays shaded and today marked. The web kit's `Gantt` for a phone: the rules are the same ones —
// ranges, the axis, row packing, baselines, rollups, dependencies, recurrence — shared in @workspace/shared
// `lib/gantt`, so both kits lay a schedule out identically.
//
// A phone has no hover and no mouse edges to grab. Tap a bar to select it: a readout shows its dates and progress
// with buttons that move it or change its length, and a selected bar can be dragged along the timeline. Every bar
// is a button that reads its title, dates and progress, with move and resize actions for screen readers. Rows
// reorder through their menu (move up, move down), groups fold, and every change goes through `onEventUpdate` —
// return false to refuse it, or an adjustment (snap to a working day) to change it.

import {
	buildDependencyEdges,
	buildDependencyPath,
	buildDescendantIds,
	buildEventIndex,
	buildRowBars,
	buildTimelineAxis,
	buildTimelineRows,
	computeRowOffsets,
	computeSubtreeProgress,
	fractionOfRange,
	getDayKey,
	getGanttDateRange,
	mergeGanttI18n,
	MS_PER_MINUTE,
	reorderResources,
	stepGanttDate,
	SYSTEM_GANTT_CLOCK,
	type GanttClock,
	type GanttEvent,
	type GanttI18nOverrides,
	type GanttLaneMemo,
	type GanttOffDaysConfig,
	type GanttProposedUpdate,
	type GanttResource,
	type GanttResourceReorder,
	type GanttScale,
	type GanttScheduleMode,
	type GanttSegment,
	type GanttUpdateResult,
	type GanttUpdateSource,
	type RowGeometry,
	type TimelineRow,
	type TimelineRowBars,
	type WeekStartsOn,
} from "@workspace/ui-kit-logic";
import { cva } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import * as React from "react";
import { AccessibilityInfo, type AccessibilityActionEvent, PanResponder, ScrollView, Text, type TextStyle, View, type ViewInstance, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { z } from "zod";

import { cn } from "../lib/cn";
import {
	DEFAULT_GANTT_LABELS,
	ganttDateRangeLabel,
	ganttSiblingPosition,
	ganttStepMinutes,
	ganttToneClass,
	stepGanttEvent,
	type GanttStepKind,
	type NativeGanttLabels,
	type NativeGanttLabelSet,
} from "../lib/gantt";
import { Button } from "./button";
import { DropdownMenu, type DropdownMenuItemData } from "./dropdown-menu";
import { IconButton } from "./icon-button";

/** Points per rem: the shared layout measures in rem. */
const REM = 16;

/** Rows tall enough for a thumb: 28 pt bars, 44 pt at least per row. */
const GEOMETRY: RowGeometry = { laneHeightRem: 1.75, laneGapRem: 0.25, rowPaddingRem: 0.5, minRowRem: 2.75 };
/** The day scale's unit, in minutes: an hour. */
const DAY_SCALE_INTERVAL = 60;
/** A bar shorter than this many points prints its title after itself. */
const LABEL_INSIDE_MIN = 72;
/** A milestone's diamond, in points. */
const MILESTONE_SIZE = 14;
/** Dependency arrows: room before the first bend, the step between lanes, the arrowhead, in points. */
const ARROW_GEOMETRY = { clearance: 8, laneStep: 6, arrowSize: 5 };
/** A rollup bar's thickness, a planned band's, and the gap after a short bar before its title, in points. */
const SUMMARY_HEIGHT = 6;
const PLAN_HEIGHT = 4;
const TITLE_GAP = 4;
const ARROW_STROKE = 1.5;
/** How far a drag must travel before it moves the bar, in points. */
const DRAG_SLOP = 4;
const PERCENT = 100;
const DEFAULT_SCALES: readonly GanttScale[] = ["week", "month", "quarter"];
const NO_EVENTS: readonly GanttEvent[] = [];
/** No lane memory: each pass packs afresh (a phone moves bars a step at a time, so lanes settle where they land). */
const NO_LANES: ReadonlyMap<string, GanttLaneMemo> = new Map();

export const ganttVariants = cva("w-full gap-3");

/** The tree column: the rows' names. */
export const ganttTreeVariants = cva("border-r border-border bg-background", {
	variants: { width: { sm: "w-32", md: "w-44", lg: "w-56" } },
	defaultVariants: { width: "md" },
});

export const ganttBarVariants = cva("absolute justify-center overflow-hidden rounded-md px-2", {
	variants: {
		selected: { true: "border-2 border-foreground", false: "" },
		dimmed: { true: "opacity-50", false: "" },
	},
	defaultVariants: { selected: false, dimmed: false },
});

export type GanttTreeWidth = "sm" | "md" | "lg";

const ColorSchema = z.string();

function defaultTimeZone(): string {
	return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export interface GanttProps {
	/** The bars, controlled; with `onEventsChange`. */
	readonly events?: readonly GanttEvent[] | undefined;
	/** The bars to start with, uncontrolled. */
	readonly defaultEvents?: readonly GanttEvent[] | undefined;
	/** Every accepted change, with the whole list. */
	readonly onEventsChange?: ((events: readonly GanttEvent[]) => void) | undefined;
	/** The commit gate: false refuses a change, an adjustment changes it (a working-day snap). */
	readonly onEventUpdate?: ((update: GanttProposedUpdate) => GanttUpdateResult) | undefined;
	/** A tap on a bar. */
	readonly onEventPress?: ((event: GanttEvent) => void) | undefined;
	/** The rows: a tree; bars attach to rows by `resourceId`. */
	readonly resources: readonly GanttResource[];
	/** Rows reorder (their menu offers move up and down); the proposal carries the whole tree. Return false to refuse. */
	readonly onResourceReorder?: ((proposal: GanttResourceReorder) => false | undefined) | undefined;
	/** Draws a row's name (an avatar and a name, a status). Default its title. */
	readonly renderResource?: ((resource: GanttResource, depth: number) => React.ReactNode) | undefined;
	readonly scale?: GanttScale | undefined;
	readonly defaultScale?: GanttScale | undefined;
	readonly onScaleChange?: ((scale: GanttScale) => void) | undefined;
	/** The scales the view menu offers. Default week, month and quarter. */
	readonly scales?: readonly GanttScale[] | undefined;
	/** The date the view shows, controlled. */
	readonly date?: Date | undefined;
	readonly defaultDate?: Date | undefined;
	readonly onDateChange?: ((date: Date) => void) | undefined;
	/** Where "now" comes from (a fixed clock for a demo or a test). */
	readonly clock?: GanttClock | undefined;
	/** The zone dates are shown in. Default the device's. */
	readonly timeZone?: string | undefined;
	/** Default Sunday (0). */
	readonly weekStartsOn?: WeekStartsOn | undefined;
	/** Shaded days: weekends (`true`, the default), a config with holidays, or none (`false`). */
	readonly offDays?: boolean | GanttOffDaysConfig | undefined;
	/** One bar per row at a time (`single`), or stacked lanes (`multiple`, the default). */
	readonly scheduleMode?: GanttScheduleMode | undefined;
	/** Group rows roll their children up into one bar. Default `true`. */
	readonly summaryBars?: boolean | undefined;
	/** Planned windows ghosted behind bars. Default `true`. */
	readonly baselineBars?: boolean | undefined;
	/** Arrows from each bar to the ones that wait for it. Default `true`. */
	readonly dependencies?: boolean | undefined;
	/** A line at the current time. Default `true`. */
	readonly showToday?: boolean | undefined;
	/** The toolbar: previous, today, next, the title and the scale menu. Default `true`. */
	readonly showNav?: boolean | undefined;
	/** More in the toolbar, after the menu. */
	readonly toolbarContent?: React.ReactNode | undefined;
	readonly treeWidth?: GanttTreeWidth | undefined;
	/** Copy and formats over the English defaults, one key at a time. */
	readonly i18n?: GanttI18nOverrides | undefined;
	readonly labels?: Partial<NativeGanttLabels> | undefined;
	/** The timeline's name for screen readers. Default "Timeline". */
	readonly accessibilityLabel?: string | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A bar's spoken name: its title, dates, row, progress and plan. */
function barLabelOf(
	event: GanttEvent,
	rowTitle: string | undefined,
	timeLabel: string,
	labels: NativeGanttLabelSet,
	formatAria: (parts: Parameters<ReturnType<typeof mergeGanttI18n>["functions"]["formatEventAriaLabel"]>[0]) => string,
): string {
	return formatAria({
		title: event.title,
		timeLabel,
		rowTitle,
		continues: false,
		milestoneLabel: event.start.getTime() === event.end.getTime() ? labels.milestone : undefined,
		progressLabel: event.progress === undefined ? undefined : labels.progress(event.progress),
	});
}

interface BarProps {
	readonly segment: GanttSegment;
	readonly style: ViewStyle;
	readonly label: string;
	readonly selected: boolean;
	readonly dimmed: boolean;
	readonly editable: boolean;
	readonly showTitleInside: boolean;
	readonly labels: NativeGanttLabelSet;
	readonly pointsPerMinute: number;
	readonly onSelect: (eventId: string) => void;
	readonly onStep: (eventId: string, kind: GanttStepKind, steps: number, source: GanttUpdateSource) => void;
	readonly onDragMinutes: (eventId: string, minutes: number) => void;
}

const BAR_ACTIONS = ["earlier", "later", "shorter", "longer"];

/** One bar: a button that selects it, with move and resize actions; dragged sideways once selected. */
const Bar = React.memo(function Bar({
	segment,
	style,
	label,
	selected,
	dimmed,
	editable,
	showTitleInside,
	labels,
	pointsPerMinute,
	onSelect,
	onStep,
	onDragMinutes,
}: BarProps): React.JSX.Element {
	const event = segment.occurrence.event;
	const [dragX, setDragX] = React.useState(0);
	const draggable = selected && editable;
	// One responder for both gestures (a Pressable's own responder would take the touch from it): a short release
	// is a tap that selects; a longer move drags a selected bar. An unselected bar lets the timeline scroll.
	const responder = React.useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: (): boolean => true,
				onPanResponderTerminationRequest: (): boolean => !draggable,
				onPanResponderMove: (_, gesture): void => {
					if (draggable) {
						setDragX(gesture.dx);
					}
				},
				onPanResponderRelease: (_, gesture): void => {
					setDragX(0);
					if (Math.abs(gesture.dx) <= DRAG_SLOP) {
						onSelect(event.id);
					} else if (draggable) {
						onDragMinutes(event.id, gesture.dx / pointsPerMinute);
					}
				},
				onPanResponderTerminate: (): void => {
					setDragX(0);
				},
			}),
		[draggable, event.id, onDragMinutes, onSelect, pointsPerMinute],
	);
	const actions = React.useMemo(
		() => [
			{ name: "activate" },
			...(editable
				? [
						{ name: "earlier", label: labels.moveEarlier },
						{ name: "later", label: labels.moveLater },
						{ name: "shorter", label: labels.shorten },
						{ name: "longer", label: labels.lengthen },
					]
				: []),
		],
		[editable, labels],
	);
	const handleAction = React.useCallback(
		(action: AccessibilityActionEvent): void => {
			if (action.nativeEvent.actionName === "activate") {
				onSelect(event.id);
				return;
			}
			const name = BAR_ACTIONS.find((candidate): boolean => candidate === action.nativeEvent.actionName);
			if (name === undefined) {
				return;
			}
			const kind: GanttStepKind = name === "earlier" || name === "later" ? "move" : "end";
			onStep(event.id, kind, name === "earlier" || name === "shorter" ? -1 : 1, "keyboard");
		},
		[event.id, onSelect, onStep],
	);
	const dragStyle = React.useMemo((): ViewStyle => ({ ...style, transform: [{ translateX: dragX }] }), [dragX, style]);
	const milestone = event.start.getTime() === event.end.getTime();
	const progress = event.progress;
	const progressStyle = React.useMemo(
		(): ViewStyle | undefined => (progress === undefined ? undefined : { width: `${String(Math.max(0, Math.min(progress, PERCENT)))}%` }),
		[progress],
	);
	const accessibilityState = React.useMemo(() => ({ selected }), [selected]);
	return (
		<View
			{...responder.panHandlers}
			accessible
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={editable ? labels.barKeyboardHint : undefined}
			accessibilityState={accessibilityState}
			accessibilityActions={actions}
			onAccessibilityAction={handleAction}
			style={dragStyle}
			className={milestone ? "absolute items-center justify-center" : cn(ganttBarVariants({ selected, dimmed }), ganttToneClass(event.color))}>
			{milestone ? (
				<View className={cn("size-3.5 rotate-45 rounded-sm", ganttToneClass(event.color), selected ? "border-2 border-foreground" : "")} />
			) : (
				<>
					{progressStyle === undefined ? null : <View style={progressStyle} className="absolute top-0 bottom-0 left-0 bg-foreground/20" />}
					{showTitleInside ? (
						<Text numberOfLines={1} className="text-caption font-sans-medium text-status-foreground">
							{event.title}
						</Text>
					) : null}
				</>
			)}
		</View>
	);
});

interface RowLabelProps {
	readonly row: TimelineRow;
	readonly heightStyle: ViewStyle;
	readonly content: React.ReactNode;
	readonly onToggle: (id: string) => void;
	readonly reorderable: boolean;
	readonly onReorder: (id: string, by: -1 | 1) => void;
	readonly labels: NativeGanttLabelSet;
}

/** A row's name in the tree column: indented by depth, with a fold button for a group and a menu to reorder. */
const RowLabel = React.memo(function RowLabel({ row, heightStyle, content, onToggle, reorderable, onReorder, labels }: RowLabelProps): React.JSX.Element {
	const { resource, isGroup, collapsed, depth } = row;
	const toggle = React.useCallback((): void => {
		onToggle(resource.id);
	}, [onToggle, resource.id]);
	const items = React.useMemo(
		(): DropdownMenuItemData<"up" | "down">[] => [
			{ value: "up", label: labels.moveRowUp },
			{ value: "down", label: labels.moveRowDown },
		],
		[labels.moveRowDown, labels.moveRowUp],
	);
	const handleReorder = React.useCallback(
		(direction: "up" | "down"): void => {
			onReorder(resource.id, direction === "up" ? -1 : 1);
		},
		[onReorder, resource.id],
	);
	const indent = React.useMemo((): ViewStyle => ({ paddingLeft: depth * REM }), [depth]);
	return (
		<View style={heightStyle} className="flex-row items-center border-b border-border pr-1">
			<View style={indent} className="min-w-0 flex-1 flex-row items-center gap-1 pl-2">
				{isGroup ? (
					<IconButton
						icon={collapsed ? ChevronRightIcon : ChevronDownIcon}
						label={collapsed ? labels.expand(resource.title) : labels.collapse(resource.title)}
						onPress={toggle}
						variant="ghost"
						size="sm"
					/>
				) : null}
				<View className="min-w-0 flex-1">{content}</View>
			</View>
			{reorderable ? (
				<DropdownMenu
					label={`${labels.reorder} ${resource.title}`}
					title={resource.title}
					items={items}
					onSelect={handleReorder}
					icon={EllipsisVerticalIcon}
					variant="ghost"
					size="icon"
					hideChevron
				/>
			) : null}
		</View>
	);
});

export const Gantt = React.memo(
	React.forwardRef<ViewInstance, GanttProps>(function Gantt(
		{
			events: controlledEvents,
			defaultEvents = NO_EVENTS,
			onEventsChange,
			onEventUpdate,
			onEventPress,
			resources,
			onResourceReorder,
			renderResource,
			scale: controlledScale,
			defaultScale = "month",
			onScaleChange,
			scales = DEFAULT_SCALES,
			date: controlledDate,
			defaultDate,
			onDateChange,
			clock = SYSTEM_GANTT_CLOCK,
			timeZone: timeZoneProp,
			weekStartsOn = 0,
			offDays = true,
			scheduleMode = "multiple",
			summaryBars = true,
			baselineBars = true,
			dependencies = true,
			showToday = true,
			showNav = true,
			toolbarContent,
			treeWidth = "md",
			i18n,
			labels: labelsOverride,
			accessibilityLabel,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const labels = React.useMemo((): NativeGanttLabelSet => ({ ...DEFAULT_GANTT_LABELS, ...labelsOverride }), [labelsOverride]);
		const copy = React.useMemo(() => mergeGanttI18n(DEFAULT_GANTT_LABELS, i18n), [i18n]);
		const timeZone = React.useMemo((): string => timeZoneProp ?? defaultTimeZone(), [timeZoneProp]);
		const nowMs = clock.nowEpochMs();
		const [ownEvents, setOwnEvents] = React.useState<readonly GanttEvent[]>(defaultEvents);
		const events = controlledEvents ?? ownEvents;
		const [ownScale, setOwnScale] = React.useState<GanttScale>(defaultScale);
		const scale = controlledScale ?? ownScale;
		const [ownDate, setOwnDate] = React.useState<Date>(() => defaultDate ?? new Date(nowMs));
		const date = controlledDate ?? ownDate;
		const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());
		const [selectedId, setSelectedId] = React.useState<string | null>(null);
		const lineColor = ColorSchema.safeParse(useCSSVariable("--color-muted-foreground")).data;

		const ranges = React.useMemo(() => getGanttDateRange(scale, date, { timeZone, weekStartsOn }), [date, scale, timeZone, weekStartsOn]);
		const range = ranges.visibleRange;
		const totalMin = (range.end.getTime() - range.start.getTime()) / MS_PER_MINUTE;
		const axis = React.useMemo(
			() =>
				buildTimelineAxis({
					scale,
					interval: DAY_SCALE_INTERVAL,
					range,
					timeZone,
					weekStartsOn,
					formats: copy.formats,
					labels: copy.labels,
					offDays,
					todayKey: getDayKey(new Date(nowMs), timeZone),
				}),
			[copy.formats, copy.labels, nowMs, offDays, range, scale, timeZone, weekStartsOn],
		);
		const totalWeight = axis.units.reduce((sum, unit): number => sum + unit.weight, 0);
		const trackWidth = totalWeight * axis.unitWidthRem * REM;
		const pointsPerMinute = totalMin > 0 ? trackWidth / totalMin : 0;
		const rows = React.useMemo(() => buildTimelineRows(resources, collapsed), [collapsed, resources]);
		const occurrences = React.useMemo(() => buildEventIndex(events, range, { timeZone }).occurrences, [events, range, timeZone]);
		const descendantIds = React.useMemo(() => buildDescendantIds(resources), [resources]);
		const subtreeProgress = React.useMemo(() => computeSubtreeProgress(rows, events, descendantIds), [descendantIds, events, rows]);
		const barsResult = React.useMemo(
			() =>
				buildRowBars({
					rows,
					occurrences,
					events,
					range,
					geometry: GEOMETRY,
					scheduleMode,
					summaryBars,
					baselineBars,
					descendantIds,
					subtreeProgress,
					previousLanes: NO_LANES,
					eventsLabel: copy.labels.events,
				}),
			[baselineBars, copy.labels.events, descendantIds, events, occurrences, range, rows, scheduleMode, subtreeProgress, summaryBars],
		);
		const rowHeightsRem = React.useMemo(
			(): number[] => rows.map((row): number => barsResult.bars.get(row.resource.id)?.heightRem ?? GEOMETRY.minRowRem),
			[barsResult.bars, rows],
		);
		const rowHeights = rowHeightsRem.map((height): number => height * REM);
		const rowOffsets = React.useMemo((): number[] => computeRowOffsets(rowHeightsRem).map((offset): number => offset * REM), [rowHeightsRem]);
		const rowsHeight = rowOffsets.at(-1) ?? 0;
		const edges = React.useMemo(
			() => (dependencies ? buildDependencyEdges({ rows, bars: barsResult.bars, range, trackRemWidth: trackWidth / REM, geometry: GEOMETRY }).edges : []),
			[barsResult.bars, dependencies, range, rows, trackWidth],
		);
		const rowTitles = React.useMemo((): ReadonlyMap<string, string> => new Map(rows.map((row): [string, string] => [row.resource.id, row.resource.title])), [rows]);
		const selectedEvent = selectedId === null ? undefined : events.find((event): boolean => event.id === selectedId);

		// ── Changes ──
		const commit = React.useCallback(
			(event: GanttEvent, start: Date, end: Date, source: GanttUpdateSource): void => {
				const update: GanttProposedUpdate = { event, occurrence: null, start, end, allDay: event.allDay ?? false, resourceId: event.resourceId, source };
				const result = onEventUpdate?.(update);
				if (result === false) {
					return;
				}
				const adjusted =
					result === true || result === undefined ? update : { ...update, start: result.start ?? start, end: result.end ?? end, allDay: result.allDay ?? update.allDay };
				const next = events.map((candidate): GanttEvent =>
					candidate.id === event.id ? { ...candidate, start: adjusted.start, end: adjusted.end, allDay: adjusted.allDay } : candidate,
				);
				setOwnEvents(next);
				onEventsChange?.(next);
				AccessibilityInfo.announceForAccessibility(
					copy.labels.announceUpdate(event.title, ganttDateRangeLabel(adjusted, { formats: copy.formats, rangeSeparator: copy.labels.rangeSeparator }, timeZone)),
				);
			},
			[copy.formats, copy.labels, events, onEventUpdate, onEventsChange, timeZone],
		);
		const step = React.useCallback(
			(eventId: string, kind: GanttStepKind, steps: number, source: GanttUpdateSource): void => {
				const event = events.find((candidate): boolean => candidate.id === eventId);
				if (event === undefined || steps === 0) {
					return;
				}
				const next = stepGanttEvent(event, kind, steps, scale, timeZone);
				commit(event, next.start, next.end, kind === "move" ? source : "resize-end");
			},
			[commit, events, scale, timeZone],
		);
		const dragMinutes = React.useCallback(
			(eventId: string, minutes: number): void => {
				const event = events.find((candidate): boolean => candidate.id === eventId);
				if (event === undefined) {
					return;
				}
				step(eventId, "move", Math.round(minutes / ganttStepMinutes(event, scale)), "drag");
			},
			[events, scale, step],
		);
		const select = React.useCallback(
			(eventId: string): void => {
				setSelectedId((current): string | null => (current === eventId ? null : eventId));
				const event = events.find((candidate): boolean => candidate.id === eventId);
				if (event !== undefined) {
					onEventPress?.(event);
				}
			},
			[events, onEventPress],
		);
		const clearSelection = React.useCallback((): void => {
			setSelectedId(null);
		}, []);
		const toggleRow = React.useCallback((id: string): void => {
			setCollapsed((current): ReadonlySet<string> => {
				const next = new Set(current);
				if (!next.delete(id)) {
					next.add(id);
				}
				return next;
			});
		}, []);
		const reorder = React.useCallback(
			(id: string, by: -1 | 1): void => {
				const position = ganttSiblingPosition(resources, id);
				if (position === null || onResourceReorder === undefined) {
					return;
				}
				const index = position.index + by;
				if (index < 0 || index >= position.count) {
					return;
				}
				const next = reorderResources(resources, id, position.parentId, index);
				if (next === null) {
					return;
				}
				if (onResourceReorder({ resourceId: id, parentId: position.parentId, index, resources: next }) !== false) {
					AccessibilityInfo.announceForAccessibility(copy.labels.announceReorder(rowTitles.get(id) ?? id));
				}
			},
			[copy.labels, onResourceReorder, resources, rowTitles],
		);

		// ── Navigation ──
		const setDate = React.useCallback(
			(next: Date): void => {
				setOwnDate(next);
				onDateChange?.(next);
			},
			[onDateChange],
		);
		const goPrevious = React.useCallback((): void => {
			setDate(stepGanttDate(scale, date, -1, { timeZone }));
		}, [date, scale, setDate, timeZone]);
		const goNext = React.useCallback((): void => {
			setDate(stepGanttDate(scale, date, 1, { timeZone }));
		}, [date, scale, setDate, timeZone]);
		const goToday = React.useCallback((): void => {
			setDate(new Date(clock.nowEpochMs()));
		}, [clock, setDate]);
		const scaleItems = React.useMemo(
			(): DropdownMenuItemData<GanttScale>[] =>
				scales.map((option): DropdownMenuItemData<GanttScale> => ({ value: option, label: copy.labels.scales[option], kind: "radio", checked: option === scale })),
			[copy.labels.scales, scale, scales],
		);
		const chooseScale = React.useCallback(
			(next: GanttScale): void => {
				setOwnScale(next);
				onScaleChange?.(next);
			},
			[onScaleChange],
		);
		const title = copy.functions.formatTitle(scale, { date, activeRange: ranges.activeRange, visibleRange: range });

		// ── Geometry ──
		const unitStyles = React.useMemo((): ViewStyle[] => axis.units.map((unit): ViewStyle => ({ width: unit.weight * axis.unitWidthRem * REM })), [axis]);
		const groupStyles = React.useMemo((): ViewStyle[] => axis.groups.map((group): ViewStyle => ({ width: group.span * axis.unitWidthRem * REM })), [axis]);
		const trackStyle = React.useMemo((): ViewStyle => ({ width: trackWidth, height: rowsHeight }), [rowsHeight, trackWidth]);
		const offColumns = React.useMemo((): { readonly key: string; readonly style: ViewStyle }[] => {
			let left = 0;
			const columns: { readonly key: string; readonly style: ViewStyle }[] = [];
			axis.units.forEach((unit): void => {
				const width = unit.weight * axis.unitWidthRem * REM;
				if (unit.isOff) {
					columns.push({ key: unit.key, style: { left, width, top: 0, bottom: 0 } });
				}
				left += width;
			});
			return columns;
		}, [axis]);
		const todayStyle = React.useMemo((): ViewStyle | null => {
			if (!showToday || nowMs < range.start.getTime() || nowMs > range.end.getTime()) {
				return null;
			}
			return { left: fractionOfRange(nowMs, range.start.getTime(), range.end.getTime()) * trackWidth, top: 0, bottom: 0 };
		}, [nowMs, range, showToday, trackWidth]);
		const xOf = React.useCallback((minutes: number | undefined): number => (minutes ?? 0) * pointsPerMinute, [pointsPerMinute]);
		const timeLabelOf = React.useCallback(
			(event: GanttEvent): string => ganttDateRangeLabel(event, { formats: copy.formats, rangeSeparator: copy.labels.rangeSeparator }, timeZone),
			[copy.formats, copy.labels.rangeSeparator, timeZone],
		);

		const rowViews = rows.map((row, index): React.JSX.Element => {
			const rowTop = rowOffsets.at(index) ?? 0;
			const height = rowHeights.at(index) ?? GEOMETRY.minRowRem * REM;
			const bars: TimelineRowBars | undefined = barsResult.bars.get(row.resource.id);
			return (
				<TrackRow
					key={row.resource.id}
					top={rowTop}
					height={height}
					bars={bars}
					xOf={xOf}
					rowTitle={row.resource.title}
					selectedId={selectedId}
					labels={labels}
					pointsPerMinute={pointsPerMinute}
					timeLabelOf={timeLabelOf}
					formatAria={copy.functions.formatEventAriaLabel}
					onSelect={select}
					onStep={step}
					onDragMinutes={dragMinutes}
				/>
			);
		});

		return (
			<View ref={ref} testID={testID} className={cn(ganttVariants(), className)}>
				{showNav ? (
					<View className="flex-row flex-wrap items-center gap-2">
						<IconButton icon={ChevronLeftIcon} label={copy.labels.previous} onPress={goPrevious} variant="secondary" size="sm" />
						<Button label={copy.labels.today} variant="outline" size="sm" onPress={goToday} />
						<IconButton icon={ChevronRightIcon} label={copy.labels.next} onPress={goNext} variant="secondary" size="sm" />
						<Text accessibilityRole="header" numberOfLines={1} className="text-label font-sans-semibold flex-1 text-foreground">
							{title}
						</Text>
						<DropdownMenu label={copy.labels.scales[scale]} title={copy.labels.selectView} items={scaleItems} onSelect={chooseScale} size="sm" />
						{toolbarContent}
					</View>
				) : null}
				{selectedEvent === undefined ? null : (
					<BarReadout event={selectedEvent} timeLabel={timeLabelOf(selectedEvent)} labels={labels} onStep={step} onDone={clearSelection} />
				)}
				<View className="flex-row overflow-hidden rounded-lg border border-border">
					<View className={ganttTreeVariants({ width: treeWidth })}>
						<View className="h-14 justify-end border-b border-border px-2 pb-1">
							<Text className="text-caption font-sans-medium text-muted-foreground">{copy.labels.resources}</Text>
						</View>
						{rows.map((row, index): React.JSX.Element => (
							<RowLabel
								key={row.resource.id}
								row={row}
								heightStyle={heightStyleOf(rowHeights.at(index) ?? GEOMETRY.minRowRem * REM)}
								content={
									renderResource?.(row.resource, row.depth) ?? (
										<Text numberOfLines={1} className={cn("text-label font-sans text-foreground", row.isGroup ? "font-sans-semibold" : "")}>
											{row.resource.title}
										</Text>
									)
								}
								onToggle={toggleRow}
								reorderable={onResourceReorder !== undefined}
								onReorder={reorder}
								labels={labels}
							/>
						))}
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" accessibilityLabel={accessibilityLabel ?? copy.labels.timeline}>
						<View>
							<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="h-14 border-b border-border">
								<View className="h-7 flex-row">
									{axis.groups.map((group, index): React.JSX.Element => (
										<View key={group.key} style={groupStyles.at(index)} className="justify-center border-l border-border px-1">
											<Text numberOfLines={1} className="text-caption font-sans-medium text-foreground">
												{group.label}
											</Text>
										</View>
									))}
								</View>
								<View className="h-7 flex-row">
									{axis.units.map((unit, index): React.JSX.Element => (
										<View key={unit.key} style={unitStyles.at(index)} className={cn("items-center justify-center border-l border-border", unit.isOff ? "bg-muted/50" : "")}>
											<Text numberOfLines={1} className={cn("text-overline font-sans", unit.isToday ? "font-sans-semibold text-primary" : "text-muted-foreground")}>
												{unit.label}
											</Text>
										</View>
									))}
								</View>
							</View>
							<View style={trackStyle}>
								{offColumns.map((column): React.JSX.Element => (
									<View key={column.key} style={column.style} className="absolute bg-muted/50" />
								))}
								{rowViews}
								{lineColor === undefined || edges.length === 0 ? null : (
									<Svg width={trackWidth} height={rowsHeight} pointerEvents="none" style={OVERLAY}>
										{edges.map((edge): React.JSX.Element => {
											const path = buildDependencyPath({ x: edge.fromX * REM, y: edge.fromY * REM }, { x: edge.toX * REM, y: edge.toY * REM }, ARROW_GEOMETRY);
											return (
												<React.Fragment key={edge.key}>
													<Path d={path.line} stroke={lineColor} strokeWidth={ARROW_STROKE} fill="none" />
													<Path d={path.arrow} fill={lineColor} />
												</React.Fragment>
											);
										})}
									</Svg>
								)}
								{todayStyle === null ? null : <View pointerEvents="none" style={todayStyle} className="absolute w-0.5 bg-destructive" />}
							</View>
						</View>
					</ScrollView>
				</View>
			</View>
		);
	}),
);

/** The dependency layer sits over the rows. */
const OVERLAY: ViewStyle = { position: "absolute", left: 0, top: 0 };

function heightStyleOf(height: number): ViewStyle {
	return { height };
}

interface TrackRowProps {
	readonly top: number;
	readonly height: number;
	readonly bars: TimelineRowBars | undefined;
	readonly xOf: (minutes: number | undefined) => number;
	readonly rowTitle: string;
	readonly selectedId: string | null;
	readonly labels: NativeGanttLabelSet;
	readonly pointsPerMinute: number;
	readonly timeLabelOf: (event: GanttEvent) => string;
	readonly formatAria: ReturnType<typeof mergeGanttI18n>["functions"]["formatEventAriaLabel"];
	readonly onSelect: (eventId: string) => void;
	readonly onStep: (eventId: string, kind: GanttStepKind, steps: number, source: GanttUpdateSource) => void;
	readonly onDragMinutes: (eventId: string, minutes: number) => void;
}

/** One row of the timeline: its planned bands, its rollup, and its bars in their lanes. */
function TrackRow({
	top,
	height,
	bars,
	xOf,
	rowTitle,
	selectedId,
	labels,
	pointsPerMinute,
	timeLabelOf,
	formatAria,
	onSelect,
	onStep,
	onDragMinutes,
}: TrackRowProps): React.JSX.Element {
	const rowStyle: ViewStyle = { position: "absolute", left: 0, right: 0, top, height };
	const laneTop = (lane: number): number => ((bars?.laneOffsetRem ?? GEOMETRY.rowPaddingRem) + lane * (GEOMETRY.laneHeightRem + GEOMETRY.laneGapRem)) * REM;
	const laneHeight = GEOMETRY.laneHeightRem * REM;
	return (
		<View style={rowStyle} className="border-b border-border">
			{bars?.rowBaseline === null || bars?.rowBaseline === undefined ? null : (
				<View style={bandStyle(xOf(bars.rowBaseline.startMin), xOf(bars.rowBaseline.endMin), 0, height)} className="absolute bg-muted-foreground/10" />
			)}
			{bars?.summary === null || bars?.summary === undefined ? null : (
				<View
					style={bandStyle(xOf(bars.summary.from), xOf(bars.summary.to), (height - SUMMARY_HEIGHT) / 2, SUMMARY_HEIGHT)}
					className="absolute rounded-full bg-foreground/70"
				/>
			)}
			{(bars?.baselines ?? []).map((baseline): React.JSX.Element => (
				<View
					key={`plan-${baseline.event.id}`}
					style={bandStyle(xOf(baseline.startMin), xOf(baseline.endMin), laneTop(baseline.lane) + laneHeight - PLAN_HEIGHT, PLAN_HEIGHT)}
					className={cn("absolute rounded-full", baseline.variance === "late" ? "bg-destructive/60" : "bg-muted-foreground/40")}
				/>
			))}
			{(bars?.segments ?? []).map((segment): React.JSX.Element => {
				const event = segment.occurrence.event;
				const left = xOf(segment.startMin);
				const width = Math.max(xOf(segment.endMin) - left, 0);
				const milestone = event.start.getTime() === event.end.getTime();
				const style: ViewStyle = milestone
					? { left: left - MILESTONE_SIZE, top: laneTop(segment.column ?? 0), width: MILESTONE_SIZE * 2, height: laneHeight }
					: { left, top: laneTop(segment.column ?? 0), width, height: laneHeight };
				const showTitleInside = width >= LABEL_INSIDE_MIN;
				const dimmed = selectedId === null ? false : selectedId !== event.id;
				const editable = event.readOnly === true || event.draggable === false ? false : !segment.occurrence.isRecurring;
				return (
					<React.Fragment key={segment.occurrence.key}>
						<Bar
							segment={segment}
							style={style}
							label={barLabelOf(event, rowTitle, timeLabelOf(event), labels, formatAria)}
							selected={selectedId === event.id}
							dimmed={dimmed}
							editable={editable}
							showTitleInside={showTitleInside}
							labels={labels}
							pointsPerMinute={pointsPerMinute}
							onSelect={onSelect}
							onStep={onStep}
							onDragMinutes={onDragMinutes}
						/>
						{showTitleInside ? null : (
							<Text
								numberOfLines={1}
								style={afterStyle(left + Math.max(width, milestone ? MILESTONE_SIZE : 0), laneTop(segment.column ?? 0), laneHeight)}
								className="text-caption absolute font-sans text-foreground">
								{event.title}
							</Text>
						)}
					</React.Fragment>
				);
			})}
		</View>
	);
}

/** The narrowest a band is drawn, so a one-instant plan still shows, in points. */
const MIN_BAND = 2;

/** A band from `left` to `right` points, `top` and `height` points. */
function bandStyle(left: number, right: number, top: number, height: number): ViewStyle {
	return { left, width: Math.max(right - left, MIN_BAND), top, height };
}

/** A title after its short bar, centred on the bar's lane. */
function afterStyle(left: number, top: number, height: number): TextStyle {
	return { left: left + TITLE_GAP, top, height, lineHeight: height };
}

/** The selected bar's readout: its title, dates and progress, with buttons that move it or change its length. */
function BarReadout({
	event,
	timeLabel,
	labels,
	onStep,
	onDone,
}: {
	readonly event: GanttEvent;
	readonly timeLabel: string;
	readonly labels: NativeGanttLabelSet;
	readonly onStep: (eventId: string, kind: GanttStepKind, steps: number, source: GanttUpdateSource) => void;
	readonly onDone: () => void;
}): React.JSX.Element {
	const editable = event.readOnly !== true && event.draggable !== false;
	const earlier = React.useCallback((): void => {
		onStep(event.id, "move", -1, "keyboard");
	}, [event.id, onStep]);
	const later = React.useCallback((): void => {
		onStep(event.id, "move", 1, "keyboard");
	}, [event.id, onStep]);
	const shorter = React.useCallback((): void => {
		onStep(event.id, "end", -1, "keyboard");
	}, [event.id, onStep]);
	const longer = React.useCallback((): void => {
		onStep(event.id, "end", 1, "keyboard");
	}, [event.id, onStep]);
	return (
		<View accessibilityLiveRegion="polite" className="gap-2 rounded-lg bg-muted/60 p-3">
			<View className="flex-row items-center gap-2">
				<View className={cn("size-2.5 rounded-full", ganttToneClass(event.color))} />
				<Text numberOfLines={1} className="text-label font-sans-semibold flex-1 text-foreground">
					{event.title}
				</Text>
				<Button label={labels.clearSelection} variant="ghost" size="xs" onPress={onDone} />
			</View>
			<Text className="text-caption font-sans text-muted-foreground">{event.progress === undefined ? timeLabel : `${timeLabel} · ${labels.progress(event.progress)}`}</Text>
			{editable ? (
				<View className="flex-row flex-wrap gap-2">
					<Button label={labels.moveEarlier} variant="outline" size="xs" onPress={earlier} />
					<Button label={labels.moveLater} variant="outline" size="xs" onPress={later} />
					{event.resizable === false ? null : (
						<>
							<Button label={labels.shorten} variant="outline" size="xs" onPress={shorter} />
							<Button label={labels.lengthen} variant="outline" size="xs" onPress={longer} />
						</>
					)}
				</View>
			) : null}
		</View>
	);
}
