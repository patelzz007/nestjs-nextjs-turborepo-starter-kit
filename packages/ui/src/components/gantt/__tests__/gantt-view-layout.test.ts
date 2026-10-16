// @vitest-environment node
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../../../lib/labels/en";
import { buildEventIndex, MS_PER_DAY } from "../gantt-lib";
import type { GanttEvent, GanttResource, GanttSegment } from "../gantt-types";
import {
	applyDraftLane,
	buildDependencyEdges,
	buildDescendantIds,
	buildRowBars,
	buildTimelineAxis,
	buildTimelineRows,
	clampTreeToContainer,
	collectDependencySources,
	computeGroupBoundaries,
	computeRowOffsets,
	computeRowWindow,
	computeSubtreeProgress,
	computeUnitFractions,
	fractionOfRange,
	hasUniformUnits,
	laneBlockRem,
	laneTopRem,
	lowestFreeLane,
	resolveCenterTarget,
	resolveHintStop,
	resolveLabelPlacement,
	type RowBarsInput,
	type TimelineAxisInput,
	type TimelineUnit,
} from "../gantt-view-layout";

const UTC = "UTC";
const EN = UI_KIT_LABELS_EN.gantt;

function at(year: number, monthIndex: number, day: number, hour = 0): Date {
	return new Date(Date.UTC(year, monthIndex, day, hour));
}

const TREE: readonly GanttResource[] = [
	{
		id: "g",
		title: "Group",
		baselineStart: at(2026, 2, 9),
		baselineEnd: at(2026, 2, 12),
		children: [
			{ id: "a", title: "A" },
			{ id: "b", title: "B" },
		],
	},
	{ id: "c", title: "C" },
];

const EVENTS: readonly GanttEvent[] = [
	{ id: "e1", title: "One", start: at(2026, 2, 9), end: at(2026, 2, 11), resourceId: "a", progress: 100, baselineStart: at(2026, 2, 9), baselineEnd: at(2026, 2, 10) },
	{ id: "e2", title: "Two", start: at(2026, 2, 10), end: at(2026, 2, 12), resourceId: "a", dependencies: ["e1"] },
	{ id: "e3", title: "Three", start: at(2026, 2, 11), end: at(2026, 2, 13), resourceId: "b", progress: 0, dependencies: ["e1", "missing"] },
];

const WEEK = { start: at(2026, 2, 8), end: at(2026, 2, 15) };

function axisInput(extra: Partial<TimelineAxisInput>): TimelineAxisInput {
	return { scale: "week", interval: 60, range: WEEK, timeZone: UTC, weekStartsOn: 0, formats: EN.formats, labels: EN, offDays: undefined, todayKey: "2026-03-10", ...extra };
}

function barsInput(extra: Partial<RowBarsInput> = {}): RowBarsInput {
	const rows = buildTimelineRows(TREE, new Set());
	const descendantIds = buildDescendantIds(TREE);
	return {
		rows,
		occurrences: buildEventIndex(EVENTS, WEEK, { timeZone: UTC }).occurrences,
		events: EVENTS,
		range: WEEK,
		geometry: { laneHeightRem: 1.25, laneGapRem: 0.25, rowPaddingRem: 0.5, minRowRem: 2.5 },
		scheduleMode: "multiple",
		summaryBars: true,
		baselineBars: true,
		descendantIds,
		subtreeProgress: computeSubtreeProgress(rows, EVENTS, descendantIds),
		previousLanes: new Map(),
		eventsLabel: EN.events,
		...extra,
	};
}

describe("buildTimelineAxis", (): void => {
	it("builds week units with today and weekend marks, grouped by week", (): void => {
		const axis = buildTimelineAxis(axisInput({}));
		expect(axis.units.map((unit: TimelineUnit): string => unit.label)).toEqual(["Sun 8", "Mon 9", "Tue 10", "Wed 11", "Thu 12", "Fri 13", "Sat 14"]);
		expect(axis.units.filter((unit: TimelineUnit): boolean => unit.isToday).map((unit: TimelineUnit): string => unit.key)).toEqual(["2026-03-10"]);
		expect(axis.units.filter((unit: TimelineUnit): boolean => unit.isOff)).toHaveLength(2);
		expect(axis.groups).toEqual([{ key: "w-2026-03-08", label: "W11 Mar 8 – 14", span: 7 }]);
		expect(axis.unitWidthRem).toBe(10);
	});

	it("builds day units per interval, with a fine label format", (): void => {
		const axis = buildTimelineAxis(axisInput({ scale: "day", interval: 90, range: { start: at(2026, 2, 10), end: at(2026, 2, 11) } }));
		expect(axis.units).toHaveLength(16);
		expect(axis.units[LIST_SLOT_INDEX.second]?.label).toBe("1:30");
		expect(axis.groups[LIST_SLOT_INDEX.first]?.label).toBe("Tuesday, March 10, 2026");
		expect(axis.unitWidthRem).toBe(7.5);
	});

	it("builds quarter weeks grouped by month and year months grouped by quarter", (): void => {
		const quarter = buildTimelineAxis(axisInput({ scale: "quarter", range: { start: at(2025, 11, 28), end: at(2026, 3, 5) } }));
		expect(quarter.units[LIST_SLOT_INDEX.first]?.label).toBe("Dec 28");
		expect(quarter.groups.map((group: { readonly label: string }): string => group.label)).toEqual(["December", "January", "February", "March"]);
		const year = buildTimelineAxis(axisInput({ scale: "year", range: { start: at(2026, 0, 1), end: at(2027, 0, 1) }, unitWidths: { year: 3 } }));
		expect(year.units).toHaveLength(12);
		expect(year.groups).toHaveLength(4);
		expect(year.unitWidthRem).toBe(3);
		expect(year.units.find((unit: TimelineUnit): boolean => unit.isToday)?.label).toBe("Mar");
		expect(hasUniformUnits(year.units)).toBe(false);
	});

	it("computes fractions, group boundaries and the hint stop", (): void => {
		const axis = buildTimelineAxis(axisInput({ scale: "month", range: { start: at(2026, 2, 1), end: at(2026, 3, 1) } }));
		const fractions = computeUnitFractions(axis.units);
		expect(fractions).toHaveLength(31);
		expect(computeGroupBoundaries(axis.groups, axis.units).length).toBe(axis.groups.length - 1);
		expect(resolveHintStop(fractions, 0.01)?.index).toBe(0);
		expect(resolveHintStop(fractions, 2)?.index).toBe(30);
		expect(resolveHintStop([], 0.5)).toBeNull();
		expect(computeUnitFractions([])).toEqual([]);
	});
});

describe("tree rows", (): void => {
	it("walks depth-first and skips collapsed children", (): void => {
		expect(
			buildTimelineRows(TREE, new Set()).map((row: { readonly resource: GanttResource; readonly depth: number }): string => `${row.resource.id}@${String(row.depth)}`),
		).toEqual(["g@0", "a@1", "b@1", "c@0"]);
		expect(buildTimelineRows(TREE, new Set(["g"])).map((row: { readonly resource: GanttResource }): string => row.resource.id)).toEqual(["g", "c"]);
	});

	it("rolls up duration-weighted progress per group", (): void => {
		const rows = buildTimelineRows(TREE, new Set());
		expect(computeSubtreeProgress(rows, EVENTS, buildDescendantIds(TREE)).get("g")).toBe(33);
	});
});

describe("buildRowBars", (): void => {
	it("packs lanes, sizes rows and rides baselines on their bar's lane", (): void => {
		const { bars, lanes } = buildRowBars(barsInput());
		const a = bars.get("a");
		expect(a?.laneCount).toBe(2);
		expect(a?.segments.map((segment: GanttSegment): number | undefined => segment.column)).toEqual([0, 1]);
		expect(a?.heightRem).toBe(Math.max(2.5, laneBlockRem(2, 1.25, 0.25) + 1));
		expect(a?.baselines[LIST_SLOT_INDEX.first]?.lane).toBe(0);
		expect(a?.baselines[LIST_SLOT_INDEX.first]?.variance).toBe("late");
		expect(a?.extent?.label).toBe("2 events");
		expect(lanes.size).toBe(EVENTS.length);
	});

	it("summarises a group's subtree and its own planned band", (): void => {
		const { bars } = buildRowBars(barsInput());
		const group = bars.get("g");
		expect(group?.summary).toEqual({ from: 1 / 7, to: 5 / 7, progress: 33 });
		expect(group?.rowBaseline?.variance).toBe("late");
		expect(group?.extent?.label).toBe("Group");
		expect(bars.get("c")?.extent).toBeNull();
	});

	it("honours summaryBars / baselineBars off and single mode", (): void => {
		const { bars } = buildRowBars(barsInput({ summaryBars: false, baselineBars: false, scheduleMode: "single" }));
		expect(bars.get("g")?.summary).toBeNull();
		expect(bars.get("a")?.baselines).toEqual([]);
		expect(bars.get("a")?.laneCount).toBe(1);
	});

	it("reserves a lane for a drag-create draft without moving the row's band", (): void => {
		const { bars } = buildRowBars(barsInput());
		const drafted = applyDraftLane(bars, { resourceId: "c", startMs: at(2026, 2, 9).getTime(), endMs: at(2026, 2, 10).getTime() }, { laneHeightRem: 1.25, laneGapRem: 0.25 });
		expect(drafted.get("c")?.draftLane).toBe(0);
		expect(drafted.get("a")).toBe(bars.get("a"));
		const stacked = applyDraftLane(bars, { resourceId: "a", startMs: at(2026, 2, 10).getTime(), endMs: at(2026, 2, 11).getTime() }, { laneHeightRem: 1.25, laneGapRem: 0.25 });
		expect(stacked.get("a")?.draftLane).toBe(2);
		expect(stacked.get("a")?.laneOffsetRem).toBe(bars.get("a")?.laneOffsetRem);
		expect(applyDraftLane(bars, null, { laneHeightRem: 1, laneGapRem: 0 })).toBe(bars);
		expect(applyDraftLane(bars, { resourceId: "zz", startMs: 0, endMs: 1 }, { laneHeightRem: 1, laneGapRem: 0 })).toBe(bars);
	});
});

describe("dependencies", (): void => {
	it("anchors arrows to visible bars and skips unknown ids", (): void => {
		const input = barsInput();
		const { bars } = buildRowBars(input);
		const { edges, totalRem } = buildDependencyEdges({ rows: input.rows, bars, range: WEEK, trackRemWidth: 70, geometry: input.geometry });
		expect(edges.map((edge: { readonly key: string }): string => edge.key)).toEqual(["e1->e2", "e1->e3"]);
		expect(edges[LIST_SLOT_INDEX.first]?.fromX).toBe(30);
		expect(totalRem).toBeGreaterThan(0);
		expect(buildDependencyEdges({ rows: input.rows, bars, range: { start: WEEK.start, end: WEEK.start }, trackRemWidth: 70, geometry: input.geometry }).edges).toEqual([]);
		expect([...collectDependencySources(EVENTS)]).toEqual(["e1", "missing"]);
	});
});

describe("geometry helpers", (): void => {
	it("computes lane pitch, free lanes and fractions", (): void => {
		expect(laneTopRem(0.5, 2, 1, 0.25)).toBe(3);
		const { bars } = buildRowBars(barsInput());
		expect(lowestFreeLane(bars.get("a")?.segments ?? [], at(2026, 2, 10).getTime(), at(2026, 2, 10, 1).getTime())).toBe(2);
		expect(fractionOfRange(at(2026, 2, 11, 12).getTime(), WEEK.start.getTime(), WEEK.end.getTime())).toBe(0.5);
		expect(fractionOfRange(1, 5, 5)).toBe(0);
	});

	it("places labels inside, after or before the bar", (): void => {
		const base = { isMilestone: false, from: 0.1, to: 0.3, barRemWidth: 20, autoLabelMinRem: 7 };
		expect(resolveLabelPlacement({ ...base, mode: "inside" })).toBe("inside");
		expect(resolveLabelPlacement({ ...base, mode: "auto", barRemWidth: 3 })).toBe("after");
		expect(resolveLabelPlacement({ ...base, mode: "outside", to: 0.95 })).toBe("before");
		expect(resolveLabelPlacement({ ...base, mode: "outside", from: 0, to: 1 })).toBe("inside");
		expect(resolveLabelPlacement({ ...base, mode: "inside", isMilestone: true })).toBe("after");
	});

	it("windows rows around the viewport", (): void => {
		const offsets = computeRowOffsets([2, 2, 2, 2, 2]);
		expect(offsets).toEqual([0, 2, 4, 6, 8, 10]);
		expect(computeRowWindow(offsets, 3, 2, 0)).toEqual({ start: 1, end: 3 });
		expect(computeRowWindow(offsets, 3, 2, 1)).toEqual({ start: 0, end: 4 });
		expect(computeRowWindow(computeRowOffsets([]), 0, 10, 2)).toEqual({ start: 0, end: 0 });
	});

	it("keeps the timeline its minimum width", (): void => {
		expect(clampTreeToContainer(300, 0, 180, 200)).toBe(300);
		expect(clampTreeToContainer(300, 1000, 180, 200)).toBe(300);
		expect(clampTreeToContainer(300, 400, 180, 200)).toBe(199);
		expect(clampTreeToContainer(300, 300, 180, 200)).toBe(99);
	});

	it("resolves the initial centre", (): void => {
		const active = { start: at(2026, 2, 8), end: at(2026, 2, 15) };
		const now = at(2026, 2, 10).getTime();
		expect(resolveCenterTarget("now", 1, now, active)).toBe(now);
		expect(resolveCenterTarget("now", 1, now + 30 * MS_PER_DAY, active)).toBe(1);
		expect(resolveCenterTarget("anchor", 1, now, active)).toBe(1);
		expect(resolveCenterTarget(42, 1, now, active)).toBe(42);
	});
});
