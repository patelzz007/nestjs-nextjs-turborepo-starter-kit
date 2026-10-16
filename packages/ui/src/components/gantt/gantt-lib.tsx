/**
 * Pure, React-free calendar math for the gantt: view ranges, zoned day keys,
 * lane packing, the event index, the resource tree and dependency geometry.
 * Nothing here reads the clock or the DOM, so every function is deterministic
 * and unit-tested on its own.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, addYears, differenceInMinutes, format, startOfDay, startOfMonth, startOfQuarter, startOfWeek, startOfYear } from "date-fns";

import { expandRecurrence, isInstanceVisible } from "./gantt-recurrence";
import type {
	GanttBaseline,
	GanttBaselineVariance,
	GanttClock,
	GanttData,
	GanttDateRange,
	GanttEvent,
	GanttHandler,
	GanttOccurrence,
	GanttOffDaysConfig,
	GanttRecurrenceRule,
	GanttResource,
	GanttScale,
	GanttScheduleMode,
	GanttSegment,
} from "./gantt-types";

export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
export const MS_PER_DAY = MS_PER_MINUTE * MINUTES_PER_DAY;
export const DAYS_PER_WEEK = 7;
export const MS_PER_WEEK = MS_PER_DAY * DAYS_PER_WEEK;
export const MONTHS_PER_QUARTER = 3;
/** Fractions are compared with this tolerance (layout weights, zoom steps). */
export const FRACTION_EPSILON = 1e-9;

/** The wall clock. Inject another `GanttClock` (the `clock` prop) to pin "now" in tests or demos. */
export const SYSTEM_GANTT_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return Date.now();
	},
};

/**
 * Packing-effective minimum in minutes so tiny events do not stack invisibly.
 * It is a packing FOOTPRINT, not a render size: two schedules less than this
 * apart are treated as concurrent and split into separate lanes even though
 * their real ranges do not touch.
 */
export const MIN_PACK_SLOT = 30;

/** The instant re-expressed in the display time zone (TZDate extends Date). */
export function toZoned(date: Date, timeZone: string): TZDate {
	return new TZDate(date.getTime(), timeZone);
}

/** Zoned midnight of the day containing the instant. */
export function zonedStartOfDay(date: Date, timeZone: string): TZDate {
	return startOfDay(toZoned(date, timeZone));
}

/** Stable per-day key in the display time zone. */
export function getDayKey(date: Date, timeZone: string): string {
	return format(toZoned(date, timeZone), "yyyy-MM-dd");
}

/** Day length in minutes; 1380/1500 on DST transition days — never assume 1440. */
export function getDayTotalMinutes(dayStart: Date, timeZone: string): number {
	const next = zonedStartOfDay(addDays(toZoned(dayStart, timeZone), 1), timeZone);
	return differenceInMinutes(next, dayStart);
}

export function snapMinutes(minutes: number, snap: number): number {
	return Math.round(minutes / snap) * snap;
}

export interface ViewRangeOptions {
	readonly timeZone: string;
	readonly weekStartsOn: WeekStartsOn;
}

export interface ViewDateRanges {
	readonly visibleRange: GanttDateRange;
	readonly activeRange: GanttDateRange;
}

function sameRanges(range: GanttDateRange): ViewDateRanges {
	return { activeRange: range, visibleRange: range };
}

/** Axis range for the anchor date at the given scale. */
export function getGanttDateRange(scale: GanttScale, date: Date, options: ViewRangeOptions): ViewDateRanges {
	const { timeZone, weekStartsOn } = options;
	const zoned = toZoned(date, timeZone);
	switch (scale) {
		case "week": {
			const start = startOfWeek(zoned, { weekStartsOn });
			return sameRanges({ start, end: addWeeks(start, 1) });
		}
		case "month":
			// exact month: no outside days on the horizontal axis
			return sameRanges({ start: startOfMonth(zoned), end: startOfMonth(addMonths(zoned, 1)) });
		case "quarter": {
			// week-aligned so the axis partitions into uniform week units
			const quarterStart = startOfQuarter(zoned);
			const quarterEnd = startOfQuarter(addMonths(zoned, MONTHS_PER_QUARTER));
			const start = startOfWeek(quarterStart, { weekStartsOn });
			const alignedEnd = startOfWeek(quarterEnd, { weekStartsOn });
			const end = alignedEnd < quarterEnd ? addWeeks(alignedEnd, 1) : alignedEnd;
			return { activeRange: { start: quarterStart, end: quarterEnd }, visibleRange: { start, end } };
		}
		case "year":
			return sameRanges({ start: startOfYear(zoned), end: startOfYear(addYears(zoned, 1)) });
		case "day": {
			const start = startOfDay(zoned);
			return sameRanges({ start, end: addDays(start, 1) });
		}
		default:
			return assertNeverScale(scale);
	}
}

function assertNeverScale(value: never): never {
	throw new Error(`Unhandled gantt scale: ${String(value)}`);
}

export type GanttStepDirection = 1 | -1;

/** The anchor date stepped one period forward or backward for the scale. */
export function stepGanttDate(scale: GanttScale, date: Date, direction: GanttStepDirection, options: Pick<ViewRangeOptions, "timeZone">): Date {
	const zoned = toZoned(date, options.timeZone);
	switch (scale) {
		case "week":
			return addWeeks(zoned, direction);
		case "month":
			return addMonths(zoned, direction);
		case "quarter":
			return addMonths(zoned, direction * MONTHS_PER_QUARTER);
		case "year":
			return addYears(zoned, direction);
		case "day":
			return addDays(zoned, direction);
		default:
			return assertNeverScale(scale);
	}
}

export function rangesIntersect(a: GanttDateRange, b: GanttDateRange): boolean {
	return a.start < b.end && a.end > b.start;
}

export function eventsOverlap(a: GanttDateRange, b: GanttDateRange): boolean {
	return a.start < b.end && a.end > b.start;
}

/**
 * Range visibility for an occurrence: half-open like rangesIntersect, except a
 * zero-length occurrence (a milestone) compares its start closed so an instant
 * exactly on the range start is still admitted.
 */
export function occurrenceIntersects(occurrence: GanttDateRange, range: GanttDateRange): boolean {
	return isInstanceVisible(occurrence.start.getTime(), occurrence.end.getTime(), range);
}

export function spansMultipleDays(occurrence: GanttDateRange): boolean {
	// An event ending exactly at the next midnight is still single-day (exclusive end).
	return occurrence.end.getTime() - occurrence.start.getTime() > MS_PER_DAY;
}

/** Anything that can carry a planned window: an event or a tree node. */
export interface GanttBaselineSubject {
	readonly baselineStart?: Date | undefined;
	readonly baselineEnd?: Date | undefined;
	readonly recurrence?: GanttRecurrenceRule | string | undefined;
}

/**
 * The subject's validated planned window, or null: both instants present, end
 * not before start, and (for events) non-recurring — a series has no single
 * planned window. Structural on purpose: a GanttResource node's own baseline
 * pair resolves through the same rule.
 */
export function resolveEventBaseline(subject: GanttBaselineSubject): GanttBaseline | null {
	const { baselineStart, baselineEnd, recurrence } = subject;
	if (baselineStart === undefined || baselineEnd === undefined || recurrence !== undefined) {
		return null;
	}
	const startMs = baselineStart.getTime();
	const endMs = baselineEnd.getTime();
	if (endMs < startMs) {
		return null;
	}
	return { start: baselineStart, end: baselineEnd, milestone: endMs === startMs };
}

/** Actual end instant against a planned end instant. */
export function compareToPlan(actualEndMs: number, plannedEndMs: number): GanttBaselineVariance {
	if (actualEndMs > plannedEndMs) {
		return "late";
	}
	return actualEndMs < plannedEndMs ? "early" : "on-time";
}

/** Actual end against the planned end; null when no valid baseline exists. */
export function getBaselineVariance<TData extends GanttData>(event: GanttEvent<TData>): GanttBaselineVariance | null {
	const baseline = resolveEventBaseline(event);
	return baseline === null ? null : compareToPlan(event.end.getTime(), baseline.end.getTime());
}

export interface GanttDependencyGeometry {
	/** Orthogonal elbow path for the connector line, in the caller's units. */
	readonly line: string;
	/** Filled arrowhead at the target anchor, pointing along +x. */
	readonly arrow: string;
}

export interface GanttPoint {
	readonly x: number;
	readonly y: number;
}

export interface GanttDependencyPathOptions {
	readonly clearance: number;
	readonly laneStep: number;
	readonly arrowSize: number;
}

/** The arrowhead's half-height, as a share of its length. */
const ARROW_HALF_HEIGHT_RATIO = 0.6;

/**
 * Finish-to-start connector geometry from a predecessor's END anchor to a
 * successor's START anchor, in whatever units the caller works in. A target
 * with room ahead takes the classic Z route: out by `clearance`, across to the
 * target lane, in. A target at or behind the source's exit loops instead: out,
 * hop `laneStep` toward the target's side (down when level), back past the
 * target, in. The line stops `arrowSize` short of the anchor.
 */
export function buildDependencyPath(from: GanttPoint, to: GanttPoint, options: GanttDependencyPathOptions): GanttDependencyGeometry {
	const { clearance, laneStep, arrowSize } = options;
	const lineEndX = to.x - arrowSize;
	const halfHeight = arrowSize * ARROW_HALF_HEIGHT_RATIO;
	const arrow = `M ${String(to.x)} ${String(to.y)} L ${String(lineEndX)} ${String(to.y - halfHeight)} L ${String(lineEndX)} ${String(to.y + halfHeight)} Z`;
	const exitX = from.x + clearance;
	if (lineEndX >= exitX) {
		return { line: `M ${String(from.x)} ${String(from.y)} H ${String(exitX)} V ${String(to.y)} H ${String(lineEndX)}`, arrow };
	}
	const midY = to.y >= from.y ? from.y + laneStep : from.y - laneStep;
	return {
		line: `M ${String(from.x)} ${String(from.y)} H ${String(exitX)} V ${String(midY)} H ${String(to.x - clearance)} V ${String(to.y)} H ${String(lineEndX)}`,
		arrow,
	};
}

/**
 * Identity of a schedule ACROSS time edits. `occurrence.key` embeds the start
 * instant, so it changes the moment a schedule is moved; this key survives the
 * edit: the event id plus, for a recurring series, its position in it.
 */
export function getLaneKey(occurrence: { readonly eventId: string; readonly recurrenceIndex?: number | undefined }): string {
	return `${occurrence.eventId}::${String(occurrence.recurrenceIndex ?? 0)}`;
}

/** What one schedule held on the previous layout pass (the times tell edited schedules apart). */
export interface GanttLaneMemo {
	readonly lane: number;
	readonly startMs: number;
	readonly endMs: number;
}

export interface PackOptions {
	/**
	 * Where each schedule sat on the previous pass, by getLaneKey. A schedule
	 * whose times are UNCHANGED keeps its lane if still free, so editing one
	 * schedule never re-indexes the others; the edited one re-seeks the lowest
	 * free lane.
	 */
	readonly preferredLanes?: ReadonlyMap<string, GanttLaneMemo> | undefined;
	/** "single" collapses the row to one track; see GanttScheduleMode. */
	readonly mode?: GanttScheduleMode | undefined;
}

interface LaneInterval {
	readonly from: number;
	readonly to: number;
}

interface PackItem {
	readonly position: number;
	readonly occurrence: GanttOccurrence;
	readonly startMin: number;
	readonly effEnd: number;
	lane: number;
	interval: LaneInterval | null;
}

const UNASSIGNED_LANE = -1;

function sortPackItems(left: PackItem, right: PackItem): number {
	return left.startMin - right.startMin || right.effEnd - right.startMin - (left.effEnd - left.startMin) || left.occurrence.key.localeCompare(right.occurrence.key);
}

/** Sweep the time-sorted items into connected clusters (items that transitively overlap). */
function clusterPackItems(items: readonly PackItem[]): PackItem[][] {
	const clusters: PackItem[][] = [];
	let current: PackItem[] = [];
	let clusterEnd = Number.NEGATIVE_INFINITY;
	for (const item of items) {
		if (item.startMin >= clusterEnd) {
			current = [];
			clusters.push(current);
			clusterEnd = Number.NEGATIVE_INFINITY;
		}
		current.push(item);
		clusterEnd = Math.max(clusterEnd, item.effEnd);
	}
	return clusters;
}

function packCluster(cluster: readonly PackItem[], preferredLanes: ReadonlyMap<string, GanttLaneMemo> | undefined): void {
	// Per-lane occupancy INTERVALS, not a single running end: pass 1 claims
	// remembered lanes out of time order.
	const laneIntervals: LaneInterval[][] = [];
	const isFree = (lane: number, item: PackItem): boolean =>
		!(laneIntervals.at(lane) ?? []).some((interval: LaneInterval): boolean => interval.from < item.effEnd && interval.to > item.startMin);
	const claim = (lane: number, item: PackItem): void => {
		while (laneIntervals.length <= lane) {
			laneIntervals.push([]);
		}
		const interval: LaneInterval = { from: item.startMin, to: item.effEnd };
		laneIntervals.at(lane)?.push(interval);
		item.lane = lane;
		item.interval = interval;
	};
	const release = (item: PackItem): void => {
		const occupants = laneIntervals.at(item.lane) ?? [];
		const at = item.interval === null ? -1 : occupants.indexOf(item.interval);
		if (at >= 0) {
			occupants.splice(at, 1);
		}
	};

	// pass 1: schedules that did not move keep the lane they had
	const pending: PackItem[] = [];
	for (const item of cluster) {
		const memo = preferredLanes?.get(getLaneKey(item.occurrence));
		const untouched = memo?.startMs === item.occurrence.start.getTime() && memo.endMs === item.occurrence.end.getTime();
		if (untouched && memo.lane >= 0 && isFree(memo.lane, item)) {
			claim(memo.lane, item);
		} else {
			pending.push(item);
		}
	}
	// pass 2: the rest take the lowest free lane
	for (const item of pending) {
		let lane = 0;
		while (!isFree(lane, item)) {
			lane += 1;
		}
		claim(lane, item);
	}
	// pass 3: nothing floats above an empty lane — settle downward, in lane order
	const byLane = [...cluster].sort((left: PackItem, right: PackItem): number => left.lane - right.lane || left.startMin - right.startMin);
	for (const item of byLane) {
		if (item.lane === 0) {
			continue;
		}
		let lane = 0;
		while (lane < item.lane && !isFree(lane, item)) {
			lane += 1;
		}
		if (lane < item.lane) {
			release(item);
			claim(lane, item);
		}
	}
}

/** How far each item can widen rightward into free lanes of its own cluster. */
function spanOf(item: PackItem, cluster: readonly PackItem[], columnCount: number): number {
	let span = 1;
	while (item.lane + span < columnCount) {
		const blocked = cluster.some(
			(other: PackItem): boolean => other !== item && other.lane === item.lane + span && other.startMin < item.effEnd && other.effEnd > item.startMin,
		);
		if (blocked) {
			break;
		}
		span += 1;
	}
	return span;
}

/**
 * Overlap packing for one row's timed segments. Returns NEW segments (same
 * order as the input) carrying column / columnCount / columnSpan; the input is
 * never mutated. z resolution happens at render: event.zIndex verbatim, else
 * a base layer plus the column.
 */
export function packTimedSegments<TData extends GanttData>(segments: readonly GanttSegment<TData>[], options: PackOptions = {}): GanttSegment<TData>[] {
	if (segments.length === 0) {
		return [];
	}
	if (options.mode === "single") {
		// one track: every schedule shares lane 0 and the row never grows
		return segments.map((segment: GanttSegment<TData>): GanttSegment<TData> => ({ ...segment, column: 0, columnCount: 1, columnSpan: 1 }));
	}
	const items: PackItem[] = segments
		.map((segment: GanttSegment<TData>, position: number): PackItem => {
			const startMin = segment.startMin ?? 0;
			const endMin = segment.endMin ?? startMin;
			return { position, occurrence: segment.occurrence, startMin, effEnd: Math.max(endMin, startMin + MIN_PACK_SLOT), lane: UNASSIGNED_LANE, interval: null };
		})
		.sort(sortPackItems);
	const clusters = clusterPackItems(items);
	for (const cluster of clusters) {
		packCluster(cluster, options.preferredLanes);
	}
	// Collapse the row's USED lanes onto 0..n-1 so lane memory holes never grow the row.
	const used = [...new Set(items.map((item: PackItem): number => item.lane))].sort((left: number, right: number): number => left - right);
	const compacted = new Map(used.map((lane: number, index: number): [number, number] => [lane, index]));
	const columnCount = used.length;
	for (const item of items) {
		item.lane = compacted.get(item.lane) ?? 0;
	}
	const placement = new Map<number, { readonly column: number; readonly columnSpan: number }>();
	for (const cluster of clusters) {
		for (const item of cluster) {
			placement.set(item.position, { column: item.lane, columnSpan: spanOf(item, cluster, columnCount) });
		}
	}
	return segments.map((segment: GanttSegment<TData>, position: number): GanttSegment<TData> => {
		const placed = placement.get(position);
		return { ...segment, column: placed?.column ?? 0, columnCount, columnSpan: placed?.columnSpan ?? 1 };
	});
}

export function defaultEventOrder<TData extends GanttData>(a: GanttOccurrence<TData>, b: GanttOccurrence<TData>): number {
	return a.start.getTime() - b.start.getTime() || b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime()) || a.key.localeCompare(b.key);
}

/** A custom expansion's instance: the plain range of one occurrence. */
export interface GanttOccurrenceRange {
	readonly start: Date;
	readonly end: Date;
}

export type GanttOccurrencesResolver<TData extends GanttData> = GanttHandler<
	[event: GanttEvent<TData>, range: GanttDateRange, context: { readonly timeZone: string }],
	readonly GanttOccurrenceRange[] | null | undefined
>;

export interface BuildIndexOptions<TData extends GanttData = GanttData> {
	readonly timeZone: string;
	/** Escape hatch for exotic recurrence: return the expanded occurrences. */
	readonly getOccurrences?: GanttOccurrencesResolver<TData> | undefined;
	readonly eventOrder?: ((a: GanttOccurrence<TData>, b: GanttOccurrence<TData>) => number) | undefined;
}

export interface GanttIndex<TData extends GanttData = GanttData> {
	readonly occurrences: readonly GanttOccurrence<TData>[];
}

/** RECURRENCE-ID overrides: series id → the original instants its edited occurrences replace. */
function collectOverrideTimes<TData extends GanttData>(events: readonly GanttEvent<TData>[]): Map<string, Set<number>> {
	const overrideTimes = new Map<string, Set<number>>();
	for (const event of events) {
		if (event.recurringEventId === undefined || event.originalStart === undefined) {
			continue;
		}
		const times = overrideTimes.get(event.recurringEventId) ?? new Set<number>();
		times.add(event.originalStart.getTime());
		overrideTimes.set(event.recurringEventId, times);
	}
	return overrideTimes;
}

export function buildEventIndex<TData extends GanttData>(
	events: readonly GanttEvent<TData>[],
	visibleRange: GanttDateRange,
	options: BuildIndexOptions<TData>,
): GanttIndex<TData> {
	const { timeZone } = options;
	const order = options.eventOrder ?? defaultEventOrder;
	const overrideTimes = collectOverrideTimes(events);
	const occurrences: GanttOccurrence<TData>[] = [];
	for (const event of events) {
		const replaced = overrideTimes.get(event.id);
		const custom = options.getOccurrences?.(event, visibleRange, { timeZone });
		if (custom !== null && custom !== undefined) {
			custom.forEach((instance: GanttOccurrenceRange, recurrenceIndex: number): void => {
				if (replaced?.has(instance.start.getTime()) === true || !occurrenceIntersects(instance, visibleRange)) {
					return;
				}
				occurrences.push({
					key: `${event.id}::${instance.start.toISOString()}`,
					eventId: event.id,
					event,
					start: instance.start,
					end: instance.end,
					allDay: event.allDay ?? false,
					isRecurring: true,
					recurrenceIndex,
				});
			});
			continue;
		}
		const expanded = expandRecurrence(event, visibleRange, { timeZone });
		for (const occurrence of expanded) {
			if (replaced?.has(occurrence.start.getTime()) !== true) {
				occurrences.push(occurrence);
			}
		}
	}
	occurrences.sort(order);
	return { occurrences };
}

/** Cache key for index memoization; cheap string compare. */
export function getRangeKey(range: GanttDateRange): string {
	return `${String(range.start.getTime())}-${String(range.end.getTime())}`;
}

export interface GanttFlatResource {
	readonly resource: GanttResource;
	readonly depth: number;
}

/** Depth-first flatten of the resource tree (parents included). */
export function flattenResources(resources: readonly GanttResource[], depth = 0): GanttFlatResource[] {
	const rows: GanttFlatResource[] = [];
	for (const resource of resources) {
		rows.push({ resource, depth });
		if (resource.children !== undefined && resource.children.length > 0) {
			rows.push(...flattenResources(resource.children, depth + 1));
		}
	}
	return rows;
}

/** Depth-first lookup of one node in the tree. */
export function findResource(resources: readonly GanttResource[], id: string): GanttResource | null {
	for (const resource of resources) {
		if (resource.id === id) {
			return resource;
		}
		const found = resource.children === undefined ? null : findResource(resource.children, id);
		if (found !== null) {
			return found;
		}
	}
	return null;
}

interface StrippedTree {
	readonly nodes: readonly GanttResource[];
	readonly moved: GanttResource | null;
}

function stripResource(nodes: readonly GanttResource[], resourceId: string): StrippedTree {
	let moved: GanttResource | null = null;
	const kept: GanttResource[] = [];
	for (const node of nodes) {
		if (node.id === resourceId) {
			moved = node;
			continue;
		}
		if (node.children === undefined || node.children.length === 0) {
			kept.push(node);
			continue;
		}
		const inner = stripResource(node.children, resourceId);
		moved = inner.moved ?? moved;
		kept.push({ ...node, children: inner.nodes });
	}
	return { nodes: kept, moved };
}

function subtreeContains(node: GanttResource, id: string): boolean {
	return node.id === id || (node.children ?? []).some((child: GanttResource): boolean => subtreeContains(child, id));
}

function insertAt(nodes: readonly GanttResource[], index: number, node: GanttResource): GanttResource[] {
	const at = Math.min(Math.max(index, 0), nodes.length);
	return [...nodes.slice(0, at), node, ...nodes.slice(at)];
}

function insertUnder(nodes: readonly GanttResource[], parentId: string, index: number, node: GanttResource): GanttResource[] {
	return nodes.map((candidate: GanttResource): GanttResource => {
		if (candidate.id === parentId) {
			return { ...candidate, children: insertAt(candidate.children ?? [], index, node) };
		}
		if (candidate.children === undefined || candidate.children.length === 0) {
			return candidate;
		}
		return { ...candidate, children: insertUnder(candidate.children, parentId, index, node) };
	});
}

/**
 * Pure tree move: removes `resourceId` from wherever it sits and reinserts it
 * under `parentId` (null = root) at `index`. Returns a new tree; the original
 * is untouched. Returns null for impossible moves (unknown ids, or dropping a
 * node into its own subtree).
 */
export function reorderResources(resources: readonly GanttResource[], resourceId: string, parentId: string | null, index: number): GanttResource[] | null {
	const { nodes, moved } = stripResource(resources, resourceId);
	if (moved === null) {
		return null;
	}
	if (parentId === null) {
		return insertAt(nodes, index, moved);
	}
	if (subtreeContains(moved, parentId)) {
		return null;
	}
	const next = insertUnder(nodes, parentId, index, moved);
	// unknown parentId: the node vanished — reject
	return findResource(next, resourceId) === null ? null : next;
}

/** Saturday and Sunday (`Date#getDay()` numbers). */
export const DEFAULT_WEEKEND_DAYS: readonly number[] = [0, 6];

const EMPTY_OFF_DAYS: GanttOffDaysConfig = {};

/** Resolves whether a day is an off day (non-working) in the display zone. */
export function resolveOffDay(day: Date, timeZone: string, config: boolean | GanttOffDaysConfig | undefined): boolean {
	if (config === undefined || config === false) {
		return false;
	}
	const resolved = config === true ? EMPTY_OFF_DAYS : config;
	const weekendDays = resolved.weekendDays ?? DEFAULT_WEEKEND_DAYS;
	if (weekendDays.includes(toZoned(day, timeZone).getDay())) {
		return true;
	}
	const key = getDayKey(day, timeZone);
	if ((resolved.dates ?? []).some((date: Date): boolean => getDayKey(date, timeZone) === key)) {
		return true;
	}
	return resolved.isOffDay?.(day) ?? false;
}

/** `value` clamped into [min, max]. */
export function clampNumber(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
