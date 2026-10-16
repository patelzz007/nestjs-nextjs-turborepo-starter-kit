// @vitest-environment node
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	buildDependencyPath,
	buildEventIndex,
	clampNumber,
	compareToPlan,
	defaultEventOrder,
	eventsOverlap,
	findResource,
	flattenResources,
	getBaselineVariance,
	getDayKey,
	getDayTotalMinutes,
	getGanttDateRange,
	getLaneKey,
	getRangeKey,
	occurrenceIntersects,
	packTimedSegments,
	rangesIntersect,
	reorderResources,
	resolveEventBaseline,
	resolveOffDay,
	snapMinutes,
	spansMultipleDays,
	stepGanttDate,
	SYSTEM_GANTT_CLOCK,
	toZoned,
	zonedStartOfDay,
	MS_PER_MINUTE,
	type GanttFlatResource,
	type ViewRangeOptions,
	type WeekStartsOn,
	type GanttOccurrenceRange,
} from "../gantt-lib";
import type { GanttEvent, GanttOccurrence, GanttResource, GanttSegment } from "../gantt-types";

const UTC = "UTC";
const MONDAY: WeekStartsOn = 1;
const NEW_YORK = "America/New_York";

function at(year: number, monthIndex: number, day: number, hour = 0, minute = 0): Date {
	return new Date(Date.UTC(year, monthIndex, day, hour, minute));
}

function occurrence(id: string, start: Date, end: Date, recurrenceIndex?: number): GanttOccurrence {
	const event: GanttEvent = { id, title: id, start, end };
	return { key: `${id}::${start.toISOString()}`, eventId: id, event, start, end, allDay: false, isRecurring: recurrenceIndex !== undefined, recurrenceIndex };
}

function segment(id: string, startMin: number, endMin: number): GanttSegment {
	const base = at(2026, 0, 1);
	const start = new Date(base.getTime() + startMin * MS_PER_MINUTE);
	const end = new Date(base.getTime() + endMin * MS_PER_MINUTE);
	return { occurrence: occurrence(id, start, end), day: base, isStart: true, isEnd: true, continuesBefore: false, continuesAfter: false, startMin, endMin };
}

/** UTC ISO of any instant (a TZDate's own toISOString carries its zone offset). */
function iso(date: Date): string {
	return new Date(date.getTime()).toISOString();
}

describe("zoned day helpers", (): void => {
	it("keys days and finds midnights in the display zone", (): void => {
		expect(getDayKey(at(2026, 0, 1, 3), NEW_YORK)).toBe("2025-12-31");
		expect(iso(zonedStartOfDay(at(2026, 0, 1, 3), NEW_YORK))).toBe(iso(at(2025, 11, 31, 5)));
		expect(toZoned(at(2026, 0, 1), NEW_YORK).getHours()).toBe(19);
	});

	it("measures DST transition days honestly", (): void => {
		expect(getDayTotalMinutes(zonedStartOfDay(at(2026, 2, 8, 12), NEW_YORK), NEW_YORK)).toBe(1380);
		expect(getDayTotalMinutes(zonedStartOfDay(at(2026, 10, 1, 12), NEW_YORK), NEW_YORK)).toBe(1500);
		expect(getDayTotalMinutes(at(2026, 0, 5), UTC)).toBe(1440);
	});

	it("snaps minutes to a step", (): void => {
		expect(snapMinutes(37, 15)).toBe(30);
		expect(snapMinutes(38, 15)).toBe(45);
	});

	it("clamps numbers", (): void => {
		expect(clampNumber(5, 0, 3)).toBe(3);
		expect(clampNumber(-1, 0, 3)).toBe(0);
	});

	it("reads the system clock", (): void => {
		expect(Math.abs(SYSTEM_GANTT_CLOCK.nowEpochMs() - Date.now())).toBeLessThan(1000);
	});
});

describe("getGanttDateRange / stepGanttDate", (): void => {
	const options: ViewRangeOptions = { timeZone: UTC, weekStartsOn: MONDAY };
	const anchor = at(2026, 1, 11, 15);

	it("computes each scale's visible and active range", (): void => {
		expect(getRangeKey(getGanttDateRange("day", anchor, options).visibleRange)).toBe(getRangeKey({ start: at(2026, 1, 11), end: at(2026, 1, 12) }));
		expect(getRangeKey(getGanttDateRange("week", anchor, options).visibleRange)).toBe(getRangeKey({ start: at(2026, 1, 9), end: at(2026, 1, 16) }));
		expect(getRangeKey(getGanttDateRange("month", anchor, options).visibleRange)).toBe(getRangeKey({ start: at(2026, 1, 1), end: at(2026, 2, 1) }));
		expect(getRangeKey(getGanttDateRange("year", anchor, options).visibleRange)).toBe(getRangeKey({ start: at(2026, 0, 1), end: at(2027, 0, 1) }));
		const quarter = getGanttDateRange("quarter", anchor, options);
		expect(getRangeKey(quarter.activeRange)).toBe(getRangeKey({ start: at(2026, 0, 1), end: at(2026, 3, 1) }));
		// week-aligned visible range around the quarter
		expect(getRangeKey(quarter.visibleRange)).toBe(getRangeKey({ start: at(2025, 11, 29), end: at(2026, 3, 6) }));
	});

	it("steps one period in either direction", (): void => {
		expect(iso(stepGanttDate("day", anchor, 1, options))).toBe(iso(at(2026, 1, 12, 15)));
		expect(iso(stepGanttDate("week", anchor, -1, options))).toBe(iso(at(2026, 1, 4, 15)));
		expect(iso(stepGanttDate("month", anchor, 1, options))).toBe(iso(at(2026, 2, 11, 15)));
		expect(iso(stepGanttDate("quarter", anchor, 1, options))).toBe(iso(at(2026, 4, 11, 15)));
		expect(iso(stepGanttDate("year", anchor, -1, options))).toBe(iso(at(2025, 1, 11, 15)));
	});
});

describe("range predicates", (): void => {
	const range = { start: at(2026, 0, 1), end: at(2026, 0, 2) };
	it("treats ranges as half-open and admits a milestone on the start", (): void => {
		expect(rangesIntersect(range, { start: at(2026, 0, 2), end: at(2026, 0, 3) })).toBe(false);
		expect(eventsOverlap(range, { start: at(2026, 0, 1, 23), end: at(2026, 0, 3) })).toBe(true);
		expect(occurrenceIntersects({ start: range.start, end: range.start }, range)).toBe(true);
		expect(spansMultipleDays(range)).toBe(false);
		expect(spansMultipleDays({ start: range.start, end: at(2026, 0, 2, 1) })).toBe(true);
	});
});

describe("baselines", (): void => {
	it("validates the planned window", (): void => {
		expect(resolveEventBaseline({ baselineStart: at(2026, 0, 1), baselineEnd: at(2026, 0, 3) })).toEqual({ start: at(2026, 0, 1), end: at(2026, 0, 3), milestone: false });
		expect(resolveEventBaseline({ baselineStart: at(2026, 0, 1), baselineEnd: at(2026, 0, 1) })?.milestone).toBe(true);
		expect(resolveEventBaseline({ baselineStart: at(2026, 0, 3), baselineEnd: at(2026, 0, 1) })).toBeNull();
		expect(resolveEventBaseline({ baselineStart: at(2026, 0, 1) })).toBeNull();
		expect(resolveEventBaseline({ baselineStart: at(2026, 0, 1), baselineEnd: at(2026, 0, 3), recurrence: "FREQ=DAILY" })).toBeNull();
	});

	it("compares the actual end with the plan", (): void => {
		const event: GanttEvent = { id: "a", title: "A", start: at(2026, 0, 1), end: at(2026, 0, 4), baselineStart: at(2026, 0, 1), baselineEnd: at(2026, 0, 3) };
		expect(getBaselineVariance(event)).toBe("late");
		expect(getBaselineVariance({ ...event, end: at(2026, 0, 2) })).toBe("early");
		expect(getBaselineVariance({ ...event, end: at(2026, 0, 3) })).toBe("on-time");
		expect(getBaselineVariance({ ...event, baselineEnd: undefined })).toBeNull();
		expect(compareToPlan(1, 2)).toBe("early");
	});
});

describe("buildDependencyPath", (): void => {
	const options = { clearance: 1, laneStep: 2, arrowSize: 0.5 };
	it("takes the Z route when the target has room ahead", (): void => {
		expect(buildDependencyPath({ x: 0, y: 0 }, { x: 10, y: 4 }, options)).toEqual({ line: "M 0 0 H 1 V 4 H 9.5", arrow: "M 10 4 L 9.5 3.7 L 9.5 4.3 Z" });
	});
	it("loops back when the target sits behind the exit", (): void => {
		expect(buildDependencyPath({ x: 5, y: 0 }, { x: 2, y: 4 }, options).line).toBe("M 5 0 H 6 V 2 H 1 V 4 H 1.5");
		expect(buildDependencyPath({ x: 5, y: 4 }, { x: 2, y: 0 }, options).line).toBe("M 5 4 H 6 V 2 H 1 V 0 H 1.5");
	});
});

describe("packTimedSegments", (): void => {
	it("stacks overlapping schedules into lanes and widens free spans", (): void => {
		const packed = packTimedSegments([segment("a", 0, 120), segment("b", 60, 180), segment("c", 200, 260)]);
		expect(packed.map((item: GanttSegment): number | undefined => item.column)).toEqual([0, 1, 0]);
		expect(packed.map((item: GanttSegment): number | undefined => item.columnCount)).toEqual([2, 2, 2]);
		expect(packed[LIST_SLOT_INDEX.third]?.columnSpan).toBe(2);
	});

	it("never mutates its input", (): void => {
		const input = [segment("a", 0, 60)];
		packTimedSegments(input);
		expect(input[LIST_SLOT_INDEX.first]?.column).toBeUndefined();
	});

	it("collapses everything onto one track in single mode", (): void => {
		expect(packTimedSegments([segment("a", 0, 120), segment("b", 60, 180)], { mode: "single" }).map((item: GanttSegment): number | undefined => item.column)).toEqual([0, 0]);
		expect(packTimedSegments([])).toEqual([]);
	});

	it("keeps untouched schedules on their remembered lane", (): void => {
		const b = segment("b", 0, 120);
		const preferredLanes = new Map([[getLaneKey(b.occurrence), { lane: 1, startMs: b.occurrence.start.getTime(), endMs: b.occurrence.end.getTime() }]]);
		const packed = packTimedSegments([segment("a", 0, 120), b], { preferredLanes });
		expect(packed.map((item: GanttSegment): number | undefined => item.column)).toEqual([0, 1]);
	});

	it("pads tiny schedules to the packing footprint", (): void => {
		expect(packTimedSegments([segment("a", 0, 5), segment("b", 10, 15)]).map((item: GanttSegment): number | undefined => item.column)).toEqual([0, 1]);
	});

	it("keys lanes by event id and series position", (): void => {
		expect(getLaneKey({ eventId: "x" })).toBe("x::0");
		expect(getLaneKey({ eventId: "x", recurrenceIndex: 3 })).toBe("x::3");
	});
});

describe("buildEventIndex", (): void => {
	const range = { start: at(2026, 0, 1), end: at(2026, 0, 8) };
	it("expands, replaces RECURRENCE-ID overrides and sorts", (): void => {
		const series: GanttEvent = { id: "s", title: "S", start: at(2026, 0, 1, 9), end: at(2026, 0, 1, 10), recurrence: { freq: "daily", count: 3 } };
		const override: GanttEvent = { id: "o", title: "O", start: at(2026, 0, 2, 14), end: at(2026, 0, 2, 15), recurringEventId: "s", originalStart: at(2026, 0, 2, 9) };
		const index = buildEventIndex([override, series], range, { timeZone: UTC });
		expect(index.occurrences.map((item: GanttOccurrence): string => item.key)).toEqual([
			`s::${iso(at(2026, 0, 1, 9))}`,
			`o::${iso(at(2026, 0, 2, 14))}`,
			`s::${iso(at(2026, 0, 3, 9))}`,
		]);
	});

	it("uses a custom occurrence resolver when it answers", (): void => {
		const event: GanttEvent = { id: "c", title: "C", start: at(2026, 0, 1), end: at(2026, 0, 1, 1), recurrence: "FREQ=HOURLY" };
		const getOccurrences = (): readonly GanttOccurrenceRange[] => [
			{ start: at(2026, 0, 2), end: at(2026, 0, 2, 1) },
			{ start: at(2027, 0, 2), end: at(2027, 0, 2, 1) },
		];
		const index = buildEventIndex([event], range, { timeZone: UTC, getOccurrences });
		expect(index.occurrences).toHaveLength(1);
		expect(index.occurrences[LIST_SLOT_INDEX.first]?.isRecurring).toBe(true);
	});

	it("orders by start, then longer first, then key", (): void => {
		const long = occurrence("long", at(2026, 0, 1), at(2026, 0, 3));
		const short = occurrence("short", at(2026, 0, 1), at(2026, 0, 2));
		expect(defaultEventOrder(long, short)).toBeLessThan(0);
	});
});

describe("resource tree", (): void => {
	const tree: readonly GanttResource[] = [
		{ id: "a", title: "A", children: [{ id: "a1", title: "A1" }] },
		{ id: "b", title: "B" },
	];

	it("flattens and finds nodes", (): void => {
		expect(flattenResources(tree).map((row: GanttFlatResource): string => `${row.resource.id}:${String(row.depth)}`)).toEqual(["a:0", "a1:1", "b:0"]);
		expect(findResource(tree, "a1")?.title).toBe("A1");
		expect(findResource(tree, "zz")).toBeNull();
	});

	it("moves a node without mutating the tree", (): void => {
		const moved = reorderResources(tree, "b", "a", 0);
		expect(moved?.map((node: GanttResource): string => node.id)).toEqual(["a"]);
		expect(moved?.[LIST_SLOT_INDEX.first]?.children?.map((node: GanttResource): string => node.id)).toEqual(["b", "a1"]);
		expect(tree).toHaveLength(2);
		expect(reorderResources(tree, "a1", null, 99)?.map((node: GanttResource): string => node.id)).toEqual(["a", "b", "a1"]);
	});

	it("rejects impossible moves", (): void => {
		expect(reorderResources(tree, "zz", null, 0)).toBeNull();
		expect(reorderResources(tree, "a", "a1", 0)).toBeNull();
		expect(reorderResources(tree, "b", "nope", 0)).toBeNull();
	});
});

describe("resolveOffDay", (): void => {
	it("marks weekends, explicit dates and predicate days", (): void => {
		expect(resolveOffDay(at(2026, 0, 3), UTC, true)).toBe(true);
		expect(resolveOffDay(at(2026, 0, 5), UTC, true)).toBe(false);
		expect(resolveOffDay(at(2026, 0, 3), UTC, false)).toBe(false);
		expect(resolveOffDay(at(2026, 0, 5), UTC, { dates: [at(2026, 0, 5, 12)] })).toBe(true);
		expect(resolveOffDay(at(2026, 0, 6), UTC, { weekendDays: [], isOffDay: (): boolean => true })).toBe(true);
		expect(resolveOffDay(at(2026, 0, 3), UTC, { weekendDays: [] })).toBe(false);
	});
});
