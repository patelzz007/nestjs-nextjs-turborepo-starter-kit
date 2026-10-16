/**
 * Pure layout maths for GanttView: the visible tree rows, the two-row time
 * axis (units + groups, DST-true weights), per-row lane packing with baselines
 * and parent rollups, dependency anchors, label placement and row windowing.
 * React-free and deterministic — every input is passed in (including "today"),
 * so the view memoizes these and the tests call them directly.
 */
import { addDays, addMinutes, addMonths, format, getWeek, startOfMonth, startOfQuarter, startOfWeek, type Locale } from "date-fns";

import type { GanttDateFormats, GanttI18nLabels } from "./gantt-i18n";
import { localeOptions } from "./gantt-i18n";
import {
	clampNumber,
	compareToPlan,
	DAYS_PER_WEEK,
	FRACTION_EPSILON,
	getBaselineVariance,
	getDayKey,
	getLaneKey,
	MIN_PACK_SLOT,
	MINUTES_PER_HOUR,
	MS_PER_DAY,
	MS_PER_MINUTE,
	MS_PER_WEEK,
	packTimedSegments,
	resolveEventBaseline,
	resolveOffDay,
	toZoned,
	zonedStartOfDay,
	type GanttLaneMemo,
	type WeekStartsOn,
} from "./gantt-lib";
import { resolveScheduleMode } from "./gantt-store";
import type {
	GanttBaseline,
	GanttBaselineVariance,
	GanttDateRange,
	GanttEvent,
	GanttOccurrence,
	GanttOffDaysConfig,
	GanttResource,
	GanttScale,
	GanttScheduleMode,
	GanttSegment,
} from "./gantt-types";

/** Bar height (rem). */
export const LANE_HEIGHT_REM = 1.25;
/** Gap between stacked schedules in one node (rem). */
export const LANE_GAP_REM = 0.1875;
/** Inset between a row's edges and its block of schedules (rem). */
export const ROW_PADDING_REM = 0.5;
/** Minimum row height (rem). */
export const MIN_ROW_HEIGHT_REM = 2.5;
/** Default drop-indicator height (rem). */
export const GHOST_HEIGHT_REM = 1.25;
/** Bars narrower than this flip their title outside in barLabel "auto" (rem). */
export const AUTO_LABEL_MIN_REM = 7;
/** Day-scale interval bounds (minutes). */
export const MIN_INTERVAL_MIN = 15;
export const MAX_INTERVAL_MIN = 240;

/** Unit widths at zoom 1 (rem). */
const DAY_UNIT_MIN_WIDTH_REM = 2.5;
const DAY_UNIT_WIDTH_PER_HOUR_REM = 5;
const WEEK_UNIT_WIDTH_REM = 10;
const MONTH_UNIT_WIDTH_REM = 4;
const QUARTER_UNIT_WIDTH_REM = 8;
const YEAR_UNIT_WIDTH_REM = 10;

export interface TimelineUnit {
	readonly key: string;
	readonly label: string;
	readonly ms: number;
	/** Relative width share; uniform scales use 1 (year: days per month). */
	readonly weight: number;
	readonly isToday: boolean;
	readonly isOff: boolean;
}

export interface TimelineGroup {
	readonly key: string;
	readonly label: string;
	readonly span: number;
}

export interface TimelineAxis {
	readonly units: readonly TimelineUnit[];
	readonly groups: readonly TimelineGroup[];
	readonly unitWidthRem: number;
}

export interface TimelineAxisInput {
	readonly scale: GanttScale;
	/** Day-scale unit interval in minutes (already clamped). */
	readonly interval: number;
	readonly range: GanttDateRange;
	readonly timeZone: string;
	readonly locale?: Locale | undefined;
	readonly weekStartsOn: WeekStartsOn;
	readonly formats: GanttDateFormats;
	readonly labels: Pick<GanttI18nLabels, "week" | "weekGroup" | "rangeSeparator">;
	readonly offDays: boolean | GanttOffDaysConfig | undefined;
	/** Today's zoned day key, or null before the client has read the clock. */
	readonly todayKey: string | null;
	readonly unitWidths?: Partial<Record<GanttScale, number>> | undefined;
}

/** Appends a weighted unit to its group (merging with the previous one of the same key). */
function addToGroup(groups: TimelineGroup[], key: string, label: string, weight: number): void {
	const last = groups.at(-1);
	if (last?.key === key) {
		groups.splice(-1, 1, { ...last, span: last.span + weight });
		return;
	}
	groups.push({ key, label, span: weight });
}

function dayAxis(input: TimelineAxisInput): TimelineAxis {
	const { interval, range, timeZone, formats } = input;
	const options = localeOptions(input.locale);
	const units: TimelineUnit[] = [];
	const groups: TimelineGroup[] = [];
	const labelFormat = interval % MINUTES_PER_HOUR === 0 ? formats.timeGutter : formats.timeGutterFine;
	// walk whole days: infinite scroll can extend the range past one day
	let dayCursor: Date = zonedStartOfDay(range.start, timeZone);
	while (dayCursor.getTime() < range.end.getTime()) {
		const zonedDay = toZoned(dayCursor, timeZone);
		const nextDay = zonedStartOfDay(addDays(zonedDay, 1), timeZone);
		const dayMinutes = (nextDay.getTime() - dayCursor.getTime()) / MS_PER_MINUTE;
		const dayKey = getDayKey(dayCursor, timeZone);
		const isOff = resolveOffDay(dayCursor, timeZone, input.offDays ?? true);
		let span = 0;
		for (let minute = 0; minute < dayMinutes; minute += interval) {
			const time = addMinutes(zonedDay, minute);
			// a DST day whose minutes don't divide evenly leaves a short final unit at its REAL share
			const weight = Math.min(interval, dayMinutes - minute) / interval;
			units.push({ key: `${dayKey}-m${String(minute)}`, label: format(time, labelFormat, options), ms: time.getTime(), weight, isToday: false, isOff });
			span += weight;
		}
		groups.push({ key: dayKey, label: format(zonedDay, formats.dayTitle, options), span });
		dayCursor = nextDay;
	}
	const unitWidthRem = input.unitWidths?.day ?? Math.max(DAY_UNIT_MIN_WIDTH_REM, DAY_UNIT_WIDTH_PER_HOUR_REM * (interval / MINUTES_PER_HOUR));
	return { units, groups, unitWidthRem };
}

function quarterAxis(input: TimelineAxisInput): TimelineAxis {
	const { range, timeZone, formats } = input;
	const options = localeOptions(input.locale);
	const units: TimelineUnit[] = [];
	const groups: TimelineGroup[] = [];
	let cursor: Date = zonedStartOfDay(range.start, timeZone);
	while (cursor.getTime() < range.end.getTime()) {
		const zoned = toZoned(cursor, timeZone);
		const next = zonedStartOfDay(addDays(zoned, DAYS_PER_WEEK), timeZone);
		// real week duration / nominal week: 1 except across DST changes
		const weight = (next.getTime() - cursor.getTime()) / MS_PER_WEEK;
		const isToday = input.todayKey !== null && containsDayKey(cursor, next, input.todayKey, timeZone);
		units.push({ key: getDayKey(cursor, timeZone), label: format(zoned, formats.weekUnit, options), ms: cursor.getTime(), weight, isToday, isOff: false });
		addToGroup(groups, format(zoned, "yyyy-MM"), format(zoned, formats.monthGroup, options), weight);
		cursor = next;
	}
	return { units, groups, unitWidthRem: input.unitWidths?.quarter ?? QUARTER_UNIT_WIDTH_REM };
}

function yearAxis(input: TimelineAxisInput): TimelineAxis {
	const { range, timeZone, formats } = input;
	const options = localeOptions(input.locale);
	const units: TimelineUnit[] = [];
	const groups: TimelineGroup[] = [];
	let cursor: Date = startOfMonth(toZoned(range.start, timeZone));
	while (cursor.getTime() < range.end.getTime()) {
		const next = startOfMonth(addMonths(cursor, 1));
		// nominal-day units so a month reads ~30 wide; real ms keeps DST months true
		const weight = (next.getTime() - cursor.getTime()) / MS_PER_DAY;
		const isToday = input.todayKey !== null && containsDayKey(cursor, next, input.todayKey, timeZone);
		units.push({ key: format(cursor, "yyyy-MM"), label: format(cursor, formats.monthUnit, options), ms: cursor.getTime(), weight, isToday, isOff: false });
		const quarterStart = startOfQuarter(cursor);
		addToGroup(groups, format(quarterStart, "yyyy-QQQ"), format(quarterStart, formats.quarterTitle, options), weight);
		cursor = next;
	}
	return { units, groups, unitWidthRem: input.unitWidths?.year ?? YEAR_UNIT_WIDTH_REM };
}

/** Does [from, to) contain the zoned day named by `dayKey`? */
function containsDayKey(from: Date, to: Date, dayKey: string, timeZone: string): boolean {
	return getDayKey(from, timeZone) <= dayKey && dayKey < getDayKey(to, timeZone);
}

function dayUnitAxis(input: TimelineAxisInput, scale: "week" | "month"): TimelineAxis {
	const { range, timeZone, formats, labels, weekStartsOn } = input;
	const options = localeOptions(input.locale);
	const units: TimelineUnit[] = [];
	const groups: TimelineGroup[] = [];
	let cursor: Date = zonedStartOfDay(range.start, timeZone);
	while (cursor.getTime() < range.end.getTime()) {
		const zoned = toZoned(cursor, timeZone);
		const nextDay = zonedStartOfDay(addDays(zoned, 1), timeZone);
		// real day duration / 24h: 1 except the 23h/25h DST days
		const weight = (nextDay.getTime() - cursor.getTime()) / MS_PER_DAY;
		const dayKey = getDayKey(cursor, timeZone);
		units.push({
			key: dayKey,
			label: format(zoned, formats.dayUnit, options),
			ms: cursor.getTime(),
			weight,
			isToday: dayKey === input.todayKey,
			isOff: resolveOffDay(cursor, timeZone, input.offDays ?? true),
		});
		// the locale supplies firstWeekContainsDate; weekStartsOn keeps the number aligned with the grid
		const weekNumber = getWeek(zoned, { ...options, weekStartsOn });
		const weekStart = startOfWeek(zoned, { weekStartsOn });
		const rangeLabel = `${format(weekStart, formats.weekGroupStart, options)}${labels.rangeSeparator}${format(addDays(weekStart, DAYS_PER_WEEK - 1), formats.weekGroupEnd, options)}`;
		addToGroup(groups, `w-${format(weekStart, "yyyy-MM-dd")}`, labels.weekGroup(labels.week(weekNumber), rangeLabel), weight);
		cursor = nextDay;
	}
	const fallbackWidth = scale === "week" ? WEEK_UNIT_WIDTH_REM : MONTH_UNIT_WIDTH_REM;
	return { units, groups, unitWidthRem: input.unitWidths?.[scale] ?? fallbackWidth };
}

/**
 * The header model: bottom row = units, top row = grouping sectors. Weights
 * are proportional to REAL duration (a 23h/25h DST day differs from its
 * siblings), so gridlines, bar geometry and pointer maths share one system.
 */
export function buildTimelineAxis(input: TimelineAxisInput): TimelineAxis {
	switch (input.scale) {
		case "day":
			return dayAxis(input);
		case "quarter":
			return quarterAxis(input);
		case "year":
			return yearAxis(input);
		case "week":
		case "month":
			return dayUnitAxis(input, input.scale);
		default:
			return assertNeverAxisScale(input.scale);
	}
}

function assertNeverAxisScale(value: never): never {
	throw new Error(`Unhandled gantt scale: ${String(value)}`);
}

export interface UnitFraction {
	readonly unit: TimelineUnit;
	/** Start and width as shares of the whole track (0..1). */
	readonly start: number;
	readonly width: number;
}

/** Cumulative start/width fractions per unit, for backdrop stripes and gridlines. */
export function computeUnitFractions(units: readonly TimelineUnit[]): UnitFraction[] {
	const totalWeight = units.reduce((sum: number, unit: TimelineUnit): number => sum + unit.weight, 0);
	if (totalWeight <= 0) {
		return [];
	}
	let accumulated = 0;
	return units.map((unit: TimelineUnit): UnitFraction => {
		const start = accumulated / totalWeight;
		accumulated += unit.weight;
		return { unit, start, width: unit.weight / totalWeight };
	});
}

/** Group boundary fractions (between groups only). */
export function computeGroupBoundaries(groups: readonly TimelineGroup[], units: readonly TimelineUnit[]): number[] {
	const totalWeight = units.reduce((sum: number, unit: TimelineUnit): number => sum + unit.weight, 0);
	if (totalWeight <= 0) {
		return [];
	}
	const boundaries: number[] = [];
	let accumulated = 0;
	for (const group of groups.slice(0, -1)) {
		accumulated += group.span;
		boundaries.push(accumulated / totalWeight);
	}
	return boundaries;
}

/** Are all units the same width? (uniform tracks need no explicit unit lines) */
export function hasUniformUnits(units: readonly TimelineUnit[]): boolean {
	const [first] = units;
	return first === undefined || units.every((unit: TimelineUnit): boolean => Math.abs(unit.weight - first.weight) < FRACTION_EPSILON);
}

/** A unit the hint snaps to: its index, centre fraction and time span. */
export interface HintStop {
	readonly index: number;
	readonly center: number;
	readonly ms: number;
	readonly endMs: number;
}

/** Snap a track fraction to the unit under it. */
export function resolveHintStop(fractions: readonly UnitFraction[], fraction: number): HintStop | null {
	const lastIndex = fractions.length - 1;
	for (const [index, { unit, start, width }] of fractions.entries()) {
		if (fraction < start + width || index === lastIndex) {
			return { index, center: start + width / 2, ms: unit.ms, endMs: fractions.at(index + 1)?.unit.ms ?? unit.ms };
		}
	}
	return null;
}

export interface TimelineRow {
	readonly resource: GanttResource;
	readonly parentId: string | null;
	readonly depth: number;
	readonly isGroup: boolean;
	readonly collapsed: boolean;
}

/** The visible tree rows, depth-first, skipping the children of collapsed groups. */
export function buildTimelineRows(resources: readonly GanttResource[], collapsed: ReadonlySet<string>): TimelineRow[] {
	const rows: TimelineRow[] = [];
	const walk = (nodes: readonly GanttResource[], depth: number, parentId: string | null): void => {
		for (const resource of nodes) {
			const children = resource.children ?? [];
			const isGroup = children.length > 0;
			const isCollapsed = collapsed.has(resource.id);
			rows.push({ resource, parentId, depth, isGroup, collapsed: isCollapsed });
			if (isGroup && !isCollapsed) {
				walk(children, depth + 1, resource.id);
			}
		}
	};
	walk(resources, 0, null);
	return rows;
}

/** Resource id → every descendant id, for parent rollups. */
export function buildDescendantIds(resources: readonly GanttResource[]): Map<string, string[]> {
	const map = new Map<string, string[]>();
	const walk = (resource: GanttResource): string[] => {
		const ids = (resource.children ?? []).flatMap((child: GanttResource): string[] => [child.id, ...walk(child)]);
		map.set(resource.id, ids);
		return ids;
	};
	resources.forEach(walk);
	return map;
}

/**
 * Duration-weighted mean progress of each group's descendant events (0-100),
 * or null when none carry progress. One pass over events, then a cheap
 * descendant sum per group — never O(rows × events).
 */
export function computeSubtreeProgress(
	rows: readonly TimelineRow[],
	events: readonly GanttEvent[],
	descendantIds: ReadonlyMap<string, readonly string[]>,
): Map<string, number | null> {
	const perResource = new Map<string, { weighted: number; total: number; hasProgress: boolean }>();
	for (const event of events) {
		if (event.resourceId === undefined) {
			continue;
		}
		const aggregate = perResource.get(event.resourceId) ?? { weighted: 0, total: 0, hasProgress: false };
		const duration = Math.max(event.end.getTime() - event.start.getTime(), 1);
		aggregate.total += duration;
		if (event.progress !== undefined) {
			aggregate.hasProgress = true;
			aggregate.weighted += event.progress * duration;
		}
		perResource.set(event.resourceId, aggregate);
	}
	const map = new Map<string, number | null>();
	for (const row of rows) {
		if (!row.isGroup) {
			continue;
		}
		let weighted = 0;
		let total = 0;
		let hasProgress = false;
		for (const id of descendantIds.get(row.resource.id) ?? []) {
			const aggregate = perResource.get(id);
			if (aggregate === undefined) {
				continue;
			}
			total += aggregate.total;
			if (aggregate.hasProgress) {
				hasProgress = true;
				weighted += aggregate.weighted;
			}
		}
		map.set(row.resource.id, hasProgress && total > 0 ? clampNumber(Math.round(weighted / total), 0, PERCENT_MAX) : null);
	}
	return map;
}

const PERCENT_MAX = 100;

/** Top of lane `lane` inside a row: the ONE lane-pitch formula every overlay reads. */
export function laneTopRem(laneOffsetRem: number, lane: number, laneHeightRem: number, laneGapRem: number): number {
	return laneOffsetRem + lane * (laneHeightRem + laneGapRem);
}

/** Height of a stack of `count` lanes, inter-lane gaps included. */
export function laneBlockRem(count: number, laneHeightRem: number, laneGapRem: number): number {
	return count * laneHeightRem + (count - 1) * laneGapRem;
}

/**
 * Lowest lane free for [startMs, endMs) among a row's segments, padded by
 * MIN_PACK_SLOT exactly as the packer pads its own occupancy test.
 */
export function lowestFreeLane(segments: readonly GanttSegment[], startMs: number, endMs: number): number {
	const padMs = MIN_PACK_SLOT * MS_PER_MINUTE;
	const to = Math.max(endMs, startMs + padMs);
	const busy = new Set<number>();
	for (const segment of segments) {
		const segmentStart = segment.occurrence.start.getTime();
		const segmentEnd = Math.max(segment.occurrence.end.getTime(), segmentStart + padMs);
		if (segmentStart < to && segmentEnd > startMs) {
			busy.add(segment.column ?? 0);
		}
	}
	let lane = 0;
	while (busy.has(lane)) {
		lane += 1;
	}
	return lane;
}

/** One planned window resolved against the visible range. */
export interface RowBaseline {
	readonly event: GanttEvent;
	readonly baseline: GanttBaseline;
	readonly startMin: number;
	readonly endMin: number;
	readonly lane: number;
	readonly variance: GanttBaselineVariance;
}

/** The NODE's own planned window, resolved against the visible range. */
export interface RowLevelBaseline {
	readonly baseline: GanttBaseline;
	readonly startMin: number;
	readonly endMin: number;
	readonly variance: GanttBaselineVariance | null;
}

export interface RowExtent {
	readonly from: number;
	readonly to: number;
	readonly color?: string | undefined;
	readonly label: string;
	readonly startMs: number;
}

export interface RowSummary {
	readonly from: number;
	readonly to: number;
	readonly progress: number | null;
}

/** Per-row packed bars plus the extents the off-screen chips need. */
export interface TimelineRowBars {
	readonly segments: readonly GanttSegment[];
	readonly laneCount: number;
	readonly baselines: readonly RowBaseline[];
	readonly rowBaseline: RowLevelBaseline | null;
	/** Lane a drag-create in flight would land on (reserved), or null. */
	readonly draftLane: number | null;
	readonly scheduleMode: GanttScheduleMode;
	readonly heightRem: number;
	readonly laneOffsetRem: number;
	/** The band the FIRST schedule occupies, its gaps included (the tree label box). */
	readonly bandRem: number;
	readonly extent: RowExtent | null;
	readonly summary: RowSummary | null;
}

export interface RowGeometry {
	readonly laneHeightRem: number;
	readonly laneGapRem: number;
	readonly rowPaddingRem: number;
	readonly minRowRem: number;
}

export interface RowBarsInput {
	readonly rows: readonly TimelineRow[];
	readonly occurrences: readonly GanttOccurrence[];
	readonly events: readonly GanttEvent[];
	readonly range: GanttDateRange;
	readonly geometry: RowGeometry;
	readonly scheduleMode: GanttScheduleMode;
	readonly summaryBars: boolean;
	readonly baselineBars: boolean;
	readonly descendantIds: ReadonlyMap<string, readonly string[]>;
	readonly subtreeProgress: ReadonlyMap<string, number | null>;
	readonly previousLanes: ReadonlyMap<string, GanttLaneMemo>;
	/** "N events" label for a row's off-screen chip. */
	readonly eventsLabel: (count: number) => string;
}

export interface RowBarsResult {
	readonly bars: ReadonlyMap<string, TimelineRowBars>;
	/** The lanes this pass settled on, for the next pass's lane memory. */
	readonly lanes: ReadonlyMap<string, GanttLaneMemo>;
}

/** Minutes from the range start, clamped to the range. */
function clampedMinutes(ms: number, rangeStartMs: number, totalMin: number): number {
	return clampNumber((ms - rangeStartMs) / MS_PER_MINUTE, 0, totalMin);
}

function isPlanVisible(baseline: GanttBaseline, rangeStartMs: number, rangeEndMs: number): boolean {
	const startMs = baseline.start.getTime();
	// half-open like the bars; a planned milestone exactly on a range edge stays visible
	return baseline.milestone ? startMs >= rangeStartMs && startMs <= rangeEndMs : startMs < rangeEndMs && baseline.end.getTime() > rangeStartMs;
}

interface ResourceEnvelope {
	fromMin: number;
	toMin: number;
}

/**
 * Packs every visible row: segments with stable lanes, baselines riding their
 * bar's lane, the node's own planned band, the parent rollup and the extent
 * the off-screen chips read.
 */
export function buildRowBars(input: RowBarsInput): RowBarsResult {
	const { rows, range, geometry } = input;
	const rangeStartMs = range.start.getTime();
	const rangeEndMs = range.end.getTime();
	const totalMin = (rangeEndMs - rangeStartMs) / MS_PER_MINUTE;
	const byResource = new Map<string, GanttOccurrence[]>();
	const envelopes = new Map<string, ResourceEnvelope>();
	for (const occurrence of input.occurrences) {
		const resourceId = occurrence.event.resourceId;
		if (resourceId === undefined) {
			continue;
		}
		byResource.set(resourceId, [...(byResource.get(resourceId) ?? []), occurrence]);
		const fromMin = clampedMinutes(occurrence.start.getTime(), rangeStartMs, totalMin);
		const toMin = clampedMinutes(occurrence.end.getTime(), rangeStartMs, totalMin);
		const envelope = envelopes.get(resourceId);
		if (envelope === undefined) {
			envelopes.set(resourceId, { fromMin, toMin });
		} else {
			envelope.fromMin = Math.min(envelope.fromMin, fromMin);
			envelope.toMin = Math.max(envelope.toMin, toMin);
		}
	}
	// planned windows group by node over EVENTS, so a bar that slipped out of range still shows its plan
	const plansByResource = new Map<string, { readonly event: GanttEvent; readonly baseline: GanttBaseline }[]>();
	const latestEndByResource = new Map<string, number>();
	if (input.baselineBars) {
		for (const event of input.events) {
			if (event.resourceId === undefined) {
				continue;
			}
			latestEndByResource.set(event.resourceId, Math.max(latestEndByResource.get(event.resourceId) ?? Number.NEGATIVE_INFINITY, event.end.getTime()));
			const baseline = resolveEventBaseline(event);
			if (baseline === null || !isPlanVisible(baseline, rangeStartMs, rangeEndMs)) {
				continue;
			}
			plansByResource.set(event.resourceId, [...(plansByResource.get(event.resourceId) ?? []), { event, baseline }]);
		}
	}
	const bars = new Map<string, TimelineRowBars>();
	const lanes = new Map<string, GanttLaneMemo>();
	for (const row of rows) {
		const mine = byResource.get(row.resource.id) ?? [];
		const mode = resolveScheduleMode(row.resource, input.scheduleMode);
		const segments = packTimedSegments(
			mine.map((occurrence: GanttOccurrence): GanttSegment => ({
				occurrence,
				day: range.start,
				isStart: occurrence.start.getTime() >= rangeStartMs,
				isEnd: occurrence.end.getTime() <= rangeEndMs,
				continuesBefore: occurrence.start.getTime() < rangeStartMs,
				continuesAfter: occurrence.end.getTime() > rangeEndMs,
				startMin: clampedMinutes(occurrence.start.getTime(), rangeStartMs, totalMin),
				endMin: clampedMinutes(occurrence.end.getTime(), rangeStartMs, totalMin),
			})),
			{ mode, preferredLanes: input.previousLanes },
		);
		for (const segment of segments) {
			lanes.set(getLaneKey(segment.occurrence), { lane: segment.column ?? 0, startMs: segment.occurrence.start.getTime(), endMs: segment.occurrence.end.getTime() });
		}
		const laneCount = segments.reduce((max: number, segment: GanttSegment): number => Math.max(max, (segment.column ?? 0) + 1), 1);
		const baselines = resolveRowBaselines(plansByResource.get(row.resource.id) ?? [], segments, mode, laneCount, rangeStartMs, totalMin);
		const summary = row.isGroup && segments.length === 0 && input.summaryBars ? resolveSummary(row, envelopes, input, totalMin) : null;
		const rowBaseline = input.baselineBars ? resolveRowLevelBaseline(row, latestEndByResource, input.descendantIds, rangeStartMs, rangeEndMs, totalMin) : null;
		const blockRem = laneBlockRem(laneCount, geometry.laneHeightRem, geometry.laneGapRem);
		const heightRem = Math.max(geometry.minRowRem, blockRem + 2 * geometry.rowPaddingRem);
		const laneOffsetRem = (heightRem - blockRem) / 2;
		bars.set(row.resource.id, {
			segments,
			laneCount,
			baselines,
			rowBaseline,
			draftLane: null,
			scheduleMode: mode,
			heightRem,
			laneOffsetRem,
			bandRem: geometry.laneHeightRem + laneOffsetRem * 2,
			extent: resolveExtent(segments, summary, row, input, totalMin),
			summary,
		});
	}
	return { bars, lanes };
}

function resolveRowBaselines(
	plans: readonly { readonly event: GanttEvent; readonly baseline: GanttBaseline }[],
	segments: readonly GanttSegment[],
	mode: GanttScheduleMode,
	laneCount: number,
	rangeStartMs: number,
	totalMin: number,
): RowBaseline[] {
	const laneByEvent = new Map(segments.map((segment: GanttSegment): [string, number] => [segment.occurrence.eventId, segment.column ?? 0]));
	return plans.flatMap(({ event, baseline }: { readonly event: GanttEvent; readonly baseline: GanttBaseline }): RowBaseline[] => {
		// an ORPHAN plan (its bar slipped out of range) takes the lowest FREE lane, or is omitted
		let lane = laneByEvent.get(event.id);
		if (lane === undefined) {
			if (mode === "single" || segments.length === 0) {
				lane = 0;
			} else {
				const free = lowestFreeLane(segments, baseline.start.getTime(), baseline.end.getTime());
				if (free >= laneCount) {
					return [];
				}
				lane = free;
			}
		}
		return [
			{
				event,
				baseline,
				startMin: clampedMinutes(baseline.start.getTime(), rangeStartMs, totalMin),
				endMin: clampedMinutes(baseline.end.getTime(), rangeStartMs, totalMin),
				lane,
				variance: getBaselineVariance(event) ?? "on-time",
			},
		];
	});
}

function resolveSummary(row: TimelineRow, envelopes: ReadonlyMap<string, ResourceEnvelope>, input: RowBarsInput, totalMin: number): RowSummary | null {
	let from = Number.POSITIVE_INFINITY;
	let to = Number.NEGATIVE_INFINITY;
	for (const id of input.descendantIds.get(row.resource.id) ?? []) {
		const envelope = envelopes.get(id);
		if (envelope !== undefined) {
			from = Math.min(from, envelope.fromMin / totalMin);
			to = Math.max(to, envelope.toMin / totalMin);
		}
	}
	return to > from ? { from, to, progress: input.subtreeProgress.get(row.resource.id) ?? null } : null;
}

function resolveRowLevelBaseline(
	row: TimelineRow,
	latestEndByResource: ReadonlyMap<string, number>,
	descendantIds: ReadonlyMap<string, readonly string[]>,
	rangeStartMs: number,
	rangeEndMs: number,
	totalMin: number,
): RowLevelBaseline | null {
	const plan = resolveEventBaseline(row.resource);
	if (plan === null || !isPlanVisible(plan, rangeStartMs, rangeEndMs)) {
		return null;
	}
	const ids = row.isGroup ? [row.resource.id, ...(descendantIds.get(row.resource.id) ?? [])] : [row.resource.id];
	let latest: number | undefined;
	for (const id of ids) {
		const end = latestEndByResource.get(id);
		if (end !== undefined && (latest === undefined || end > latest)) {
			latest = end;
		}
	}
	return {
		baseline: plan,
		startMin: clampedMinutes(plan.start.getTime(), rangeStartMs, totalMin),
		endMin: clampedMinutes(plan.end.getTime(), rangeStartMs, totalMin),
		variance: latest === undefined ? null : compareToPlan(latest, plan.end.getTime()),
	};
}

function resolveExtent(segments: readonly GanttSegment[], summary: RowSummary | null, row: TimelineRow, input: RowBarsInput, totalMin: number): RowExtent | null {
	const [first] = segments;
	if (first === undefined) {
		const rangeStartMs = input.range.start.getTime();
		return summary === null
			? null
			: { from: summary.from, to: summary.to, label: row.resource.title, startMs: rangeStartMs + summary.from * (input.range.end.getTime() - rangeStartMs) };
	}
	let from = Number.POSITIVE_INFINITY;
	let to = Number.NEGATIVE_INFINITY;
	for (const segment of segments) {
		from = Math.min(from, (segment.startMin ?? 0) / totalMin);
		to = Math.max(to, (segment.endMin ?? 0) / totalMin);
	}
	return {
		from,
		to,
		color: first.occurrence.event.color,
		label: segments.length === 1 ? first.occurrence.event.title : input.eventsLabel(segments.length),
		startMs: Math.min(...segments.map((segment: GanttSegment): number => segment.occurrence.start.getTime())),
	};
}

/**
 * Reserve the lane a drag-create in flight will land on — growing the row
 * BELOW what is already there (laneOffset / band never move). Only the drafted
 * row's entry is replaced, so every other row keeps its memoized identity.
 */
export function applyDraftLane(
	bars: ReadonlyMap<string, TimelineRowBars>,
	draft: { readonly resourceId: string; readonly startMs: number; readonly endMs: number } | null,
	geometry: Pick<RowGeometry, "laneHeightRem" | "laneGapRem">,
): ReadonlyMap<string, TimelineRowBars> {
	if (draft === null) {
		return bars;
	}
	const base = bars.get(draft.resourceId);
	if (base === undefined) {
		return bars;
	}
	const next = new Map(bars);
	if (base.scheduleMode === "single") {
		next.set(draft.resourceId, { ...base, draftLane: 0 });
		return next;
	}
	const draftLane = lowestFreeLane(base.segments, draft.startMs, draft.endMs);
	const trackCount = Math.max(base.laneCount, draftLane + 1);
	const blockRem = laneBlockRem(trackCount, geometry.laneHeightRem, geometry.laneGapRem);
	next.set(draft.resourceId, { ...base, draftLane, heightRem: Math.max(base.heightRem, base.laneOffsetRem * 2 + blockRem) });
	return next;
}

/** One finish-to-start arrow, both anchors in track rem coordinates. */
export interface DependencyEdge {
	readonly key: string;
	readonly fromId: string;
	readonly toId: string;
	readonly fromX: number;
	readonly fromY: number;
	readonly toX: number;
	readonly toY: number;
}

export interface DependencyEdgesInput {
	readonly rows: readonly TimelineRow[];
	readonly bars: ReadonlyMap<string, TimelineRowBars>;
	readonly range: GanttDateRange;
	readonly trackRemWidth: number;
	readonly geometry: Pick<RowGeometry, "laneHeightRem" | "laneGapRem" | "minRowRem">;
}

export interface DependencyEdges {
	readonly edges: readonly DependencyEdge[];
	readonly totalRem: number;
}

const NO_EDGES: DependencyEdges = { edges: [], totalRem: 0 };

/**
 * Anchors of every visible, non-recurring bar (x from the range start, y from
 * the rows-block top) and the arrows between them. Endpoints without a
 * visible bar are skipped — an arrow to a hidden row would point at nothing.
 */
export function buildDependencyEdges(input: DependencyEdgesInput): DependencyEdges {
	const { geometry } = input;
	const totalMin = (input.range.end.getTime() - input.range.start.getTime()) / MS_PER_MINUTE;
	if (totalMin <= 0) {
		return NO_EDGES;
	}
	const anchors = new Map<string, { readonly endX: number; readonly y: number }>();
	const pending: { readonly id: string; readonly dependencies: readonly string[]; readonly startX: number; readonly y: number }[] = [];
	let topRem = 0;
	for (const row of input.rows) {
		const bars = input.bars.get(row.resource.id);
		for (const segment of bars?.segments ?? []) {
			const occurrence = segment.occurrence;
			if (occurrence.isRecurring || bars === undefined) {
				continue;
			}
			const y = topRem + laneTopRem(bars.laneOffsetRem, segment.column ?? 0, geometry.laneHeightRem, geometry.laneGapRem) + geometry.laneHeightRem / 2;
			const startX = ((segment.startMin ?? 0) / totalMin) * input.trackRemWidth;
			anchors.set(occurrence.eventId, { endX: ((segment.endMin ?? 0) / totalMin) * input.trackRemWidth, y });
			const dependencies = occurrence.event.dependencies ?? [];
			if (dependencies.length > 0) {
				pending.push({ id: occurrence.eventId, dependencies, startX, y });
			}
		}
		topRem += bars?.heightRem ?? geometry.minRowRem;
	}
	const edges: DependencyEdge[] = [];
	for (const item of pending) {
		for (const dependencyId of item.dependencies) {
			const from = anchors.get(dependencyId);
			if (dependencyId === item.id || from === undefined) {
				continue;
			}
			edges.push({ key: `${dependencyId}->${item.id}`, fromId: dependencyId, toId: item.id, fromX: from.endX, fromY: from.y, toX: item.startX, toY: item.y });
		}
	}
	return edges.length === 0 ? NO_EDGES : { edges, totalRem: topRem };
}

/** Events another event names as a predecessor (label spacing for departing arrows). */
export function collectDependencySources(events: readonly GanttEvent[]): Set<string> {
	return new Set(events.flatMap((event: GanttEvent): readonly string[] => event.dependencies ?? []));
}

export type BarLabelPlacement = "inside" | "after" | "before";

/** Labels flip before the bar once its end passes this share of the track. */
const LABEL_FLIP_END = 0.92;
const LABEL_FLIP_START = 0.08;

/**
 * Title placement: outside beside the bar when wanted (or too short in
 * "auto"), flipped before the bar near the range end, and back inside when
 * the bar spans the whole view. A milestone always keeps its title outside.
 */
export function resolveLabelPlacement(input: {
	readonly mode: "inside" | "outside" | "auto";
	readonly isMilestone: boolean;
	readonly from: number;
	readonly to: number;
	readonly barRemWidth: number;
	readonly autoLabelMinRem: number;
}): BarLabelPlacement {
	const wantsOutside = input.isMilestone || input.mode === "outside" || (input.mode === "auto" && input.barRemWidth < input.autoLabelMinRem);
	if (!wantsOutside) {
		return "inside";
	}
	if (input.to <= LABEL_FLIP_END) {
		return "after";
	}
	return input.from >= LABEL_FLIP_START ? "before" : "inside";
}

/** Cumulative row tops (rem), plus the total as the last entry. */
export function computeRowOffsets(heightsRem: readonly number[]): number[] {
	const offsets: number[] = [0];
	let accumulated = 0;
	for (const height of heightsRem) {
		accumulated += height;
		offsets.push(accumulated);
	}
	return offsets;
}

export interface RowWindow {
	/** First rendered row (inclusive) and the row after the last (exclusive). */
	readonly start: number;
	readonly end: number;
}

/** Rows intersecting [scrollTop, scrollTop + height) (all in rem), widened by `overscan` rows per side. */
export function computeRowWindow(offsets: readonly number[], scrollTopRem: number, viewportRem: number, overscan: number): RowWindow {
	const rowCount = Math.max(offsets.length - 1, 0);
	const firstVisible = Math.max(
		offsets.findIndex((top: number, index: number): boolean => (offsets.at(index + 1) ?? top) > scrollTopRem),
		0,
	);
	const bottom = scrollTopRem + viewportRem;
	let lastVisible = firstVisible;
	while (lastVisible < rowCount && (offsets.at(lastVisible) ?? bottom) < bottom) {
		lastVisible += 1;
	}
	return { start: Math.max(firstVisible - overscan, 0), end: Math.min(lastVisible + overscan, rowCount) };
}

/**
 * The tree width the container can spare: the timeline always keeps
 * `minTimelineWidth` (+1px for the splitter); the tree's own minWidth yields
 * when the container cannot honour both.
 */
export function clampTreeToContainer(width: number, containerWidth: number, minWidth: number, minTimelineWidth: number): number {
	if (containerWidth <= 0) {
		return width;
	}
	const ceiling = containerWidth - minTimelineWidth - 1;
	const floor = Math.min(minWidth, Math.max(ceiling, 0));
	return Math.max(Math.min(width, ceiling), Math.min(floor, containerWidth - 1));
}

/** Where the viewport opens: an explicit instant, the anchor, or now when the anchor period contains it. */
export function resolveCenterTarget(initialCenter: "now" | "anchor" | number, anchorMs: number, nowMs: number, activeRange: GanttDateRange): number {
	if (initialCenter === "anchor") {
		return anchorMs;
	}
	if (initialCenter !== "now") {
		return initialCenter;
	}
	return nowMs >= activeRange.start.getTime() && nowMs < activeRange.end.getTime() ? nowMs : anchorMs;
}

/** A track fraction (0..1) of an instant against a range. */
export function fractionOfRange(ms: number, rangeStartMs: number, rangeEndMs: number): number {
	const span = rangeEndMs - rangeStartMs;
	return span <= 0 ? 0 : clampNumber((ms - rangeStartMs) / span, 0, 1);
}
