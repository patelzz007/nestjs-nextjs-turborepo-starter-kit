/**
 * Pure gesture maths for the gantt's interaction engine: pointer position →
 * timeline minutes, snapping (zoned midnights on day grids), drag / resize /
 * create proposals, neighbour clamping and the keyboard move/resize contract.
 * No DOM and no React — `gantt-dnd.tsx` feeds these functions measured
 * geometry, and the unit tests feed them numbers.
 */
import { addDays, differenceInCalendarDays } from "date-fns";

import { MINUTES_PER_DAY, MS_PER_MINUTE, snapMinutes, toZoned, zonedStartOfDay } from "./gantt-lib";
import type { GanttData, GanttDragKind, GanttOccurrence, GanttOverlapPolicy, GanttScale } from "./gantt-types";

/** Every pointer gesture the engine runs: the three bar gestures plus drag-create on empty track. */
export type GanttGestureKind = GanttDragKind | "create";

/** The measured timeline axis a gesture maps pointer x against. */
export interface GanttAxisGeometry {
	/** Viewport px of the axis' left / right edges. */
	readonly left: number;
	readonly right: number;
	readonly rangeStartMs: number;
	readonly rangeEndMs: number;
	/** Snap step in minutes; a whole day or more snaps to zoned midnights. */
	readonly snapMin: number;
	/** Mirrored axis: in RTL the range START sits at the right edge. */
	readonly isRtl: boolean;
}

/** One proposed range of a gesture step. */
export interface GanttGestureRange {
	readonly start: Date;
	readonly end: Date;
}

/** A neighbouring schedule in the same node, as epoch-ms bounds. */
export interface GanttNeighbourSpan {
	readonly start: number;
	readonly end: number;
}

/** The axis snap step for a scale: the configured minutes on the day scale, a whole day elsewhere. */
export function resolveSnapMinutes(scale: GanttScale, snapDuration: number): number {
	return scale === "day" ? snapDuration : MINUTES_PER_DAY;
}

function isDayGrid(snapMin: number): boolean {
	return snapMin >= MINUTES_PER_DAY;
}

/**
 * Pointer x (viewport px) to minutes from the range start, clamped to the
 * track. The single place the horizontal axis direction is resolved.
 */
export function axisMinutesAt(axis: GanttAxisGeometry, x: number): number {
	const width = axis.right - axis.left;
	if (width <= 0) {
		return 0;
	}
	const clamped = Math.min(Math.max(x, axis.left), axis.right);
	const traveled = axis.isRtl ? axis.right - clamped : clamped - axis.left;
	return (traveled / width) * ((axis.rangeEndMs - axis.rangeStartMs) / MS_PER_MINUTE);
}

/**
 * Snap minutes-from-range-start to the axis grid. Day grids snap to REAL
 * zoned midnights, not 1440-minute multiples from the range start — those
 * drift by an hour across DST.
 */
export function snapAxisMinutes(axis: GanttAxisGeometry, minutes: number, timeZone: string): number {
	if (!isDayGrid(axis.snapMin)) {
		return snapMinutes(minutes, axis.snapMin);
	}
	const ms = axis.rangeStartMs + minutes * MS_PER_MINUTE;
	const instant = new Date(ms);
	const dayStart = zonedStartOfDay(instant, timeZone).getTime();
	const dayEnd = zonedStartOfDay(addDays(toZoned(instant, timeZone), 1), timeZone).getTime();
	const snapped = ms - dayStart < dayEnd - ms ? dayStart : dayEnd;
	return (snapped - axis.rangeStartMs) / MS_PER_MINUTE;
}

function isMidnightAligned(date: Date, timeZone: string): boolean {
	return zonedStartOfDay(date, timeZone).getTime() === date.getTime();
}

function isMilestone(range: GanttGestureRange): boolean {
	return range.end.getTime() === range.start.getTime();
}

/**
 * The end of a moved bar. A milestone stays an instant; day-snapped grids keep
 * the CALENDAR span of day-aligned bars (a 3-day bar dragged across a DST
 * change stays midnight-to-midnight); everything else keeps its exact duration.
 */
export function movedEnd(occurrence: GanttGestureRange & { readonly allDay: boolean }, start: Date, snapMin: number, timeZone: string): Date {
	if (isMilestone(occurrence)) {
		return new Date(start.getTime());
	}
	const dayAligned = occurrence.allDay || (isMidnightAligned(occurrence.start, timeZone) && isMidnightAligned(occurrence.end, timeZone));
	if (isDayGrid(snapMin) && dayAligned) {
		const daySpan = Math.max(differenceInCalendarDays(toZoned(occurrence.end, timeZone), toZoned(occurrence.start, timeZone)), 1);
		return new Date(zonedStartOfDay(addDays(toZoned(start, timeZone), daySpan), timeZone).getTime());
	}
	return new Date(start.getTime() + (occurrence.end.getTime() - occurrence.start.getTime()));
}

/** The latest start a start-resize may reach: one snap unit (or the last zoned midnight) before the end. */
export function maxResizeStartMs(occurrence: GanttGestureRange, snapMin: number, timeZone: string): number {
	if (!isDayGrid(snapMin)) {
		return occurrence.end.getTime() - snapMin * MS_PER_MINUTE;
	}
	const anchor = isMidnightAligned(occurrence.end, timeZone) ? addDays(toZoned(occurrence.end, timeZone), -1) : occurrence.end;
	return zonedStartOfDay(anchor, timeZone).getTime();
}

/** The earliest end an end-resize may reach: one snap unit (or the first zoned midnight) after the start. */
export function minResizeEndMs(occurrence: GanttGestureRange, snapMin: number, timeZone: string): number {
	if (!isDayGrid(snapMin)) {
		return occurrence.start.getTime() + snapMin * MS_PER_MINUTE;
	}
	return zonedStartOfDay(addDays(toZoned(occurrence.start, timeZone), 1), timeZone).getTime();
}

/**
 * Stop a gesture at the neighbour's edge (the "clamp" overlap policy). Only
 * neighbours clear of the bar's CURRENT span count — a pre-existing overlap
 * has no edge to stop at. A move keeps its duration and parks against
 * whichever edge it meets; a window narrower than the bar parks at the
 * earlier edge.
 */
export function clampToNeighbours(kind: GanttDragKind, proposal: GanttGestureRange, current: GanttGestureRange, neighbours: readonly GanttNeighbourSpan[]): GanttGestureRange {
	const anchorStart = current.start.getTime();
	const anchorEnd = current.end.getTime();
	let floor = Number.NEGATIVE_INFINITY;
	let ceiling = Number.POSITIVE_INFINITY;
	for (const other of neighbours) {
		if (other.end <= anchorStart) {
			floor = Math.max(floor, other.end);
		} else if (other.start >= anchorEnd) {
			ceiling = Math.min(ceiling, other.start);
		}
	}
	if (floor === Number.NEGATIVE_INFINITY && ceiling === Number.POSITIVE_INFINITY) {
		return proposal;
	}
	let from = proposal.start.getTime();
	let to = proposal.end.getTime();
	if (kind === "resize-start") {
		from = Math.min(Math.max(from, floor), to);
	} else if (kind === "resize-end") {
		to = Math.max(Math.min(to, ceiling), from);
	} else {
		const duration = to - from;
		if (from < floor) {
			from = floor;
			to = from + duration;
		}
		if (to > ceiling) {
			to = ceiling;
			from = to - duration;
		}
		if (from < floor) {
			from = floor;
			to = from + duration;
		}
	}
	return { start: new Date(from), end: new Date(to) };
}

/** Does the range overlap any neighbouring schedule? (the "reject" overlap policy) */
export function overlapsNeighbours(range: GanttGestureRange, neighbours: readonly GanttNeighbourSpan[]): boolean {
	return neighbours.some((other: GanttNeighbourSpan): boolean => other.start < range.end.getTime() && other.end > range.start.getTime());
}

/** A node in "single" schedule mode refuses any concurrency, whatever the overlap option says. */
export function resolveOverlapPolicy(isSingleTrack: boolean, overlap: GanttOverlapPolicy): GanttOverlapPolicy {
	return isSingleTrack ? "reject" : overlap;
}

export interface GanttBarGestureInput<TData extends GanttData = GanttData> {
	readonly kind: GanttDragKind;
	readonly axis: GanttAxisGeometry;
	readonly occurrence: GanttOccurrence<TData>;
	/** Pointer x of the current step. */
	readonly pointerX: number;
	/** Minutes between the bar's TRUE start and the grab point (move only). */
	readonly grabOffsetMin: number;
	readonly timeZone: string;
	readonly overlap: GanttOverlapPolicy;
	readonly neighbours: readonly GanttNeighbourSpan[];
}

/**
 * The snapped range one pointer step of a move / resize proposes. A move
 * preserves the pointer DELTA (no clamping to the visible range, or bars
 * crossing the window edge would teleport to it); resizes keep at least one
 * snap unit. The "clamp" overlap policy applies after snapping.
 */
export function computeBarGestureRange<TData extends GanttData>(input: GanttBarGestureInput<TData>): GanttGestureRange {
	const { kind, axis, occurrence, pointerX, grabOffsetMin, timeZone } = input;
	const at = (minutes: number): Date => new Date(axis.rangeStartMs + minutes * MS_PER_MINUTE);
	const pointerMin = axisMinutesAt(axis, pointerX);
	let proposal: GanttGestureRange;
	if (kind === "move") {
		const start = at(snapAxisMinutes(axis, pointerMin - grabOffsetMin, timeZone));
		proposal = { start, end: movedEnd(occurrence, start, axis.snapMin, timeZone) };
	} else if (kind === "resize-start") {
		const maxStartMin = (maxResizeStartMs(occurrence, axis.snapMin, timeZone) - axis.rangeStartMs) / MS_PER_MINUTE;
		const clamped = Math.min(Math.max(snapAxisMinutes(axis, pointerMin, timeZone), 0), maxStartMin);
		proposal = { start: at(clamped), end: occurrence.end };
	} else {
		const rangeMinutes = (axis.rangeEndMs - axis.rangeStartMs) / MS_PER_MINUTE;
		const minEndMin = (minResizeEndMs(occurrence, axis.snapMin, timeZone) - axis.rangeStartMs) / MS_PER_MINUTE;
		const clamped = Math.max(Math.min(snapAxisMinutes(axis, pointerMin, timeZone), rangeMinutes), minEndMin);
		proposal = { start: occurrence.start, end: at(clamped) };
	}
	return input.overlap === "clamp" ? clampToNeighbours(kind, proposal, occurrence, input.neighbours) : proposal;
}

export interface GanttCreateGestureInput {
	readonly axis: GanttAxisGeometry;
	readonly anchorX: number;
	readonly pointerX: number;
	readonly timeZone: string;
	/** Minimum slot length in minutes for a bare click. */
	readonly slotDuration: number;
}

/** The drag-create rectangle: anchor to pointer, snapped, never shorter than one slot. */
export function computeCreateGestureRange(input: GanttCreateGestureInput): GanttGestureRange {
	const { axis, timeZone } = input;
	const anchorMin = snapAxisMinutes(axis, axisMinutesAt(axis, input.anchorX), timeZone);
	const currentMin = snapAxisMinutes(axis, axisMinutesAt(axis, input.pointerX), timeZone);
	const low = Math.min(anchorMin, currentMin);
	const high = Math.max(anchorMin, currentMin, low + Math.max(axis.snapMin, input.slotDuration));
	return { start: new Date(axis.rangeStartMs + low * MS_PER_MINUTE), end: new Date(axis.rangeStartMs + high * MS_PER_MINUTE) };
}

export type GanttStepDirectionSign = 1 | -1;

/** A keyboard request on a focused bar. */
export interface GanttKeyboardIntent {
	readonly kind: GanttDragKind;
	/** +1 = later in time, -1 = earlier. */
	readonly direction: GanttStepDirectionSign;
}

export interface GanttKeyboardKeys {
	readonly key: string;
	readonly shiftKey: boolean;
	readonly altKey: boolean;
	readonly isRtl: boolean;
}

/**
 * The keyboard contract of a focused bar: ArrowLeft / ArrowRight move it one
 * snap unit, Shift + arrows move its END, Alt + arrows move its START. In RTL
 * the arrows follow the mirrored axis (ArrowLeft is later). Any other key is
 * not a gesture (null).
 */
export function resolveKeyboardIntent(keys: GanttKeyboardKeys): GanttKeyboardIntent | null {
	if (keys.key !== "ArrowLeft" && keys.key !== "ArrowRight") {
		return null;
	}
	const towardEnd = (keys.key === "ArrowRight") !== keys.isRtl;
	const direction: GanttStepDirectionSign = towardEnd ? 1 : -1;
	if (keys.shiftKey) {
		return { kind: "resize-end", direction };
	}
	if (keys.altKey) {
		return { kind: "resize-start", direction };
	}
	return { kind: "move", direction };
}

function stepInstant(date: Date, direction: GanttStepDirectionSign, snapMin: number, timeZone: string): Date {
	if (isDayGrid(snapMin)) {
		// a plain instant: consumers never receive zone-carrying TZDate values
		return new Date(zonedStartOfDay(addDays(toZoned(date, timeZone), direction), timeZone).getTime());
	}
	return new Date(date.getTime() + direction * snapMin * MS_PER_MINUTE);
}

export interface GanttKeyboardStepInput {
	readonly intent: GanttKeyboardIntent;
	readonly occurrence: GanttGestureRange & { readonly allDay: boolean };
	readonly snapMin: number;
	readonly timeZone: string;
}

/**
 * The range one keyboard step proposes, or null when the step would collapse
 * the bar (a resize may never make it shorter than one snap unit) or targets a
 * milestone's non-existent edge. A day-grid step lands on zoned midnights.
 */
export function computeKeyboardStep(input: GanttKeyboardStepInput): GanttGestureRange | null {
	const { intent, occurrence, snapMin, timeZone } = input;
	if (intent.kind === "move") {
		const start = stepInstant(occurrence.start, intent.direction, snapMin, timeZone);
		return { start, end: movedEnd(occurrence, start, snapMin, timeZone) };
	}
	if (isMilestone(occurrence)) {
		return null;
	}
	if (intent.kind === "resize-start") {
		const start = stepInstant(occurrence.start, intent.direction, snapMin, timeZone);
		return start.getTime() > maxResizeStartMs(occurrence, snapMin, timeZone) ? null : { start, end: occurrence.end };
	}
	const end = stepInstant(occurrence.end, intent.direction, snapMin, timeZone);
	return end.getTime() < minResizeEndMs(occurrence, snapMin, timeZone) ? null : { start: occurrence.start, end };
}
