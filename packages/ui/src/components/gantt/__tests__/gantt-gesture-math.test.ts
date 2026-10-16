// @vitest-environment node
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	axisMinutesAt,
	clampToNeighbours,
	computeBarGestureRange,
	computeCreateGestureRange,
	computeKeyboardStep,
	maxResizeStartMs,
	minResizeEndMs,
	movedEnd,
	overlapsNeighbours,
	resolveKeyboardIntent,
	resolveOverlapPolicy,
	resolveSnapMinutes,
	snapAxisMinutes,
	type GanttAxisGeometry,
	type GanttGestureRange,
} from "../gantt-gesture-math";
import { MINUTES_PER_DAY } from "../gantt-lib";
import type { GanttEvent, GanttOccurrence, GanttOverlapPolicy } from "../gantt-types";

const UTC = "UTC";
const ALLOW: GanttOverlapPolicy = "allow";
const NEW_YORK = "America/New_York";
const SNAP_15 = 15;
const AXIS_WIDTH_PX = 700;

function at(year: number, monthIndex: number, day: number, hour = 0, minute = 0): Date {
	return new Date(Date.UTC(year, monthIndex, day, hour, minute));
}

/** A one-week day-grid axis, 100px per day, from Sun 2026-03-08. */
const WEEK_AXIS: GanttAxisGeometry = {
	left: 0,
	right: AXIS_WIDTH_PX,
	rangeStartMs: at(2026, 2, 8).getTime(),
	rangeEndMs: at(2026, 2, 15).getTime(),
	snapMin: MINUTES_PER_DAY,
	isRtl: false,
};
const HOUR_AXIS: GanttAxisGeometry = { left: 0, right: 2400, rangeStartMs: at(2026, 2, 8).getTime(), rangeEndMs: at(2026, 2, 9).getTime(), snapMin: SNAP_15, isRtl: false };

function occurrenceOf(start: Date, end: Date, allDay = true): GanttOccurrence {
	const event: GanttEvent = { id: "e", title: "E", start, end, allDay, resourceId: "r" };
	return { key: "e", eventId: "e", event, start, end, allDay, isRecurring: false };
}

function iso(range: GanttGestureRange | null): readonly string[] | null {
	return range === null ? null : [range.start.toISOString(), range.end.toISOString()];
}

describe("axis mapping and snapping", (): void => {
	it("maps pointer x to minutes, clamped and mirrored in RTL", (): void => {
		expect(axisMinutesAt(WEEK_AXIS, 100)).toBe(MINUTES_PER_DAY);
		expect(axisMinutesAt(WEEK_AXIS, -50)).toBe(0);
		expect(axisMinutesAt({ ...WEEK_AXIS, isRtl: true }, 600)).toBe(MINUTES_PER_DAY);
		expect(axisMinutesAt({ ...WEEK_AXIS, right: 0 }, 10)).toBe(0);
	});

	it("snaps to the step, or to zoned midnights on day grids", (): void => {
		expect(snapAxisMinutes(HOUR_AXIS, 37, UTC)).toBe(30);
		expect(snapAxisMinutes(WEEK_AXIS, MINUTES_PER_DAY * 1.4, UTC)).toBe(MINUTES_PER_DAY);
		expect(snapAxisMinutes(WEEK_AXIS, MINUTES_PER_DAY * 1.6, UTC)).toBe(MINUTES_PER_DAY * 2);
	});

	it("resolves the snap per scale", (): void => {
		expect(resolveSnapMinutes("day", SNAP_15)).toBe(SNAP_15);
		expect(resolveSnapMinutes("month", SNAP_15)).toBe(MINUTES_PER_DAY);
	});
});

describe("bar gestures", (): void => {
	const twoDays = occurrenceOf(at(2026, 2, 9), at(2026, 2, 11));
	const base = { axis: WEEK_AXIS, occurrence: twoDays, grabOffsetMin: 0, timeZone: UTC, overlap: ALLOW, neighbours: [] };

	it("moves by the pointer delta and keeps the calendar span", (): void => {
		expect(iso(computeBarGestureRange({ ...base, kind: "move", pointerX: 300 }))).toEqual([at(2026, 2, 11).toISOString(), at(2026, 2, 13).toISOString()]);
	});

	it("resizes each edge but never below one snap unit", (): void => {
		expect(iso(computeBarGestureRange({ ...base, kind: "resize-end", pointerX: 500 }))).toEqual([at(2026, 2, 9).toISOString(), at(2026, 2, 13).toISOString()]);
		expect(iso(computeBarGestureRange({ ...base, kind: "resize-end", pointerX: 0 }))).toEqual([at(2026, 2, 9).toISOString(), at(2026, 2, 10).toISOString()]);
		expect(iso(computeBarGestureRange({ ...base, kind: "resize-start", pointerX: 700 }))).toEqual([at(2026, 2, 10).toISOString(), at(2026, 2, 11).toISOString()]);
	});

	it("clamps a move against a neighbour under the clamp policy", (): void => {
		const neighbours = [{ start: at(2026, 2, 12).getTime(), end: at(2026, 2, 13).getTime() }];
		expect(iso(computeBarGestureRange({ ...base, kind: "move", pointerX: 400, overlap: "clamp", neighbours }))).toEqual([
			at(2026, 2, 10).toISOString(),
			at(2026, 2, 12).toISOString(),
		]);
	});

	it("keeps a DST-crossing day-aligned move midnight to midnight", (): void => {
		const start = new Date(Date.UTC(2026, 2, 7, 5));
		const moved = movedEnd({ start, end: new Date(Date.UTC(2026, 2, 9, 4)), allDay: true }, start, MINUTES_PER_DAY, NEW_YORK);
		expect(moved.toISOString()).toBe(new Date(Date.UTC(2026, 2, 9, 4)).toISOString());
		const instant = at(2026, 2, 9, 3);
		expect(movedEnd({ start: instant, end: instant, allDay: false }, at(2026, 2, 10), MINUTES_PER_DAY, UTC).toISOString()).toBe(at(2026, 2, 10).toISOString());
		expect(movedEnd({ start: at(2026, 2, 9, 3), end: at(2026, 2, 9, 5), allDay: false }, at(2026, 2, 10, 1), SNAP_15, UTC).toISOString()).toBe(
			at(2026, 2, 10, 3).toISOString(),
		);
	});

	it("bounds resizes in minutes on sub-day grids", (): void => {
		const range = { start: at(2026, 2, 8, 9), end: at(2026, 2, 8, 10) };
		expect(maxResizeStartMs(range, SNAP_15, UTC)).toBe(at(2026, 2, 8, 9, 45).getTime());
		expect(minResizeEndMs(range, SNAP_15, UTC)).toBe(at(2026, 2, 8, 9, 15).getTime());
	});
});

describe("neighbour policies", (): void => {
	const current = { start: at(2026, 2, 9), end: at(2026, 2, 10) };
	const neighbours = [
		{ start: at(2026, 2, 7).getTime(), end: at(2026, 2, 8).getTime() },
		{ start: at(2026, 2, 11).getTime(), end: at(2026, 2, 12).getTime() },
	];
	it("stops resizes at the nearest edge", (): void => {
		expect(iso(clampToNeighbours("resize-start", { start: at(2026, 2, 6), end: current.end }, current, neighbours))).toEqual([
			at(2026, 2, 8).toISOString(),
			current.end.toISOString(),
		]);
		expect(iso(clampToNeighbours("resize-end", { start: current.start, end: at(2026, 2, 14) }, current, neighbours))).toEqual([
			current.start.toISOString(),
			at(2026, 2, 11).toISOString(),
		]);
		expect(clampToNeighbours("move", current, current, [])).toBe(current);
	});

	it("parks a move against the earlier edge when the window is too narrow", (): void => {
		const wide = { start: at(2026, 2, 8), end: at(2026, 2, 11) };
		const tight = [
			{ start: at(2026, 2, 6).getTime(), end: at(2026, 2, 8).getTime() },
			{ start: at(2026, 2, 11).getTime(), end: at(2026, 2, 12).getTime() },
		];
		expect(iso(clampToNeighbours("move", { start: at(2026, 2, 10), end: at(2026, 2, 13) }, wide, tight))?.[LIST_SLOT_INDEX.first]).toBe(at(2026, 2, 8).toISOString());
	});

	it("detects overlaps and forces reject on single tracks", (): void => {
		expect(overlapsNeighbours({ start: at(2026, 2, 11, 12), end: at(2026, 2, 13) }, neighbours)).toBe(true);
		expect(overlapsNeighbours(current, neighbours)).toBe(false);
		expect(resolveOverlapPolicy(true, "allow")).toBe("reject");
		expect(resolveOverlapPolicy(false, "clamp")).toBe("clamp");
	});
});

describe("drag-create", (): void => {
	it("spans anchor to pointer, at least one slot long", (): void => {
		expect(iso(computeCreateGestureRange({ axis: HOUR_AXIS, anchorX: 900, pointerX: 300, timeZone: UTC, slotDuration: 30 }))).toEqual([
			at(2026, 2, 8, 3).toISOString(),
			at(2026, 2, 8, 9).toISOString(),
		]);
		expect(iso(computeCreateGestureRange({ axis: HOUR_AXIS, anchorX: 900, pointerX: 900, timeZone: UTC, slotDuration: 30 }))).toEqual([
			at(2026, 2, 8, 9).toISOString(),
			at(2026, 2, 8, 9, 30).toISOString(),
		]);
	});
});

describe("keyboard contract", (): void => {
	it("maps arrows to move / resize-end / resize-start, mirrored in RTL", (): void => {
		expect(resolveKeyboardIntent({ key: "ArrowRight", shiftKey: false, altKey: false, isRtl: false })).toEqual({ kind: "move", direction: 1 });
		expect(resolveKeyboardIntent({ key: "ArrowLeft", shiftKey: true, altKey: false, isRtl: false })).toEqual({ kind: "resize-end", direction: -1 });
		expect(resolveKeyboardIntent({ key: "ArrowLeft", shiftKey: false, altKey: true, isRtl: true })).toEqual({ kind: "resize-start", direction: 1 });
		expect(resolveKeyboardIntent({ key: "Enter", shiftKey: false, altKey: false, isRtl: false })).toBeNull();
	});

	const day = { start: at(2026, 2, 9), end: at(2026, 2, 10), allDay: true };
	it("steps a bar by one unit and never collapses it", (): void => {
		expect(iso(computeKeyboardStep({ intent: { kind: "move", direction: -1 }, occurrence: day, snapMin: MINUTES_PER_DAY, timeZone: UTC }))).toEqual([
			at(2026, 2, 8).toISOString(),
			at(2026, 2, 9).toISOString(),
		]);
		expect(computeKeyboardStep({ intent: { kind: "resize-end", direction: -1 }, occurrence: day, snapMin: MINUTES_PER_DAY, timeZone: UTC })).toBeNull();
		expect(computeKeyboardStep({ intent: { kind: "resize-start", direction: 1 }, occurrence: day, snapMin: MINUTES_PER_DAY, timeZone: UTC })).toBeNull();
		expect(
			iso(computeKeyboardStep({ intent: { kind: "resize-start", direction: -1 }, occurrence: day, snapMin: MINUTES_PER_DAY, timeZone: UTC }))?.[LIST_SLOT_INDEX.first],
		).toBe(at(2026, 2, 8).toISOString());
		const timed = { start: at(2026, 2, 9, 9), end: at(2026, 2, 9, 10), allDay: false };
		expect(iso(computeKeyboardStep({ intent: { kind: "resize-end", direction: 1 }, occurrence: timed, snapMin: SNAP_15, timeZone: UTC }))?.[LIST_SLOT_INDEX.second]).toBe(
			at(2026, 2, 9, 10, 15).toISOString(),
		);
	});

	it("moves a milestone but refuses to resize it", (): void => {
		const instant = { start: at(2026, 2, 9), end: at(2026, 2, 9), allDay: false };
		expect(computeKeyboardStep({ intent: { kind: "resize-end", direction: 1 }, occurrence: instant, snapMin: MINUTES_PER_DAY, timeZone: UTC })).toBeNull();
		expect(iso(computeKeyboardStep({ intent: { kind: "move", direction: 1 }, occurrence: instant, snapMin: MINUTES_PER_DAY, timeZone: UTC }))).toEqual([
			at(2026, 2, 10).toISOString(),
			at(2026, 2, 10).toISOString(),
		]);
	});
});
