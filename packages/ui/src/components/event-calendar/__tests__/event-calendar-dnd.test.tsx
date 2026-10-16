// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
	applyKeyboardIntent,
	calendarDayDelta,
	computeDayDraft,
	computeDayMove,
	computeDayResize,
	computeTimedDraft,
	computeTimedMove,
	computeTimedResize,
	isOccurrenceDraggable,
	pointerToMinutes,
	proposalToUpdate,
	resolveKeyboardIntent,
} from "../event-calendar-dnd";
import type { CalendarEvent, EventCalendarDateRange, EventCalendarDragState, EventCalendarOccurrence } from "../event-calendar-types";

const UTC = "UTC";
const NEW_YORK = "America/New_York";

function range(start: string, end: string): EventCalendarDateRange {
	return { start: new Date(start), end: new Date(end) };
}

function iso(value: EventCalendarDateRange): readonly [string, string] {
	return [value.start.toISOString(), value.end.toISOString()];
}

const MEETING = range("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
const ALL_DAY = range("2026-03-16T00:00:00Z", "2026-03-18T00:00:00Z");

describe("pointer maths", () => {
	it("maps a pointer y onto column minutes, clamped to the bounds", (): void => {
		const rect = { top: 100, height: 480 };
		expect(pointerToMinutes(rect, 100, 480, 960)).toBe(480);
		expect(pointerToMinutes(rect, 340, 480, 960)).toBe(720);
		expect(pointerToMinutes(rect, 10, 480, 960)).toBe(480);
		expect(pointerToMinutes(rect, 9999, 480, 960)).toBe(960);
	});

	it("counts calendar days in the display zone", (): void => {
		expect(calendarDayDelta(new Date("2026-03-16T23:00:00Z"), new Date("2026-03-17T01:00:00Z"), UTC)).toBe(1);
		expect(calendarDayDelta(new Date("2026-03-16T23:00:00Z"), new Date("2026-03-17T01:00:00Z"), NEW_YORK)).toBe(0);
	});
});

describe("moves", () => {
	it("moves a timed event by days and snapped minutes, keeping its duration", (): void => {
		expect(iso(computeTimedMove(MEETING, 1, 37, 15, UTC))).toEqual(["2026-03-17T09:30:00.000Z", "2026-03-17T10:30:00.000Z"]);
	});

	it("keeps wall time when a move crosses DST", (): void => {
		const nineAm = range("2026-03-07T14:00:00Z", "2026-03-07T15:00:00Z");
		expect(iso(computeTimedMove(nineAm, 2, 0, 15, NEW_YORK))).toEqual(["2026-03-09T13:00:00.000Z", "2026-03-09T14:00:00.000Z"]);
	});

	it("moves a day-granular range by whole days", (): void => {
		expect(iso(computeDayMove(ALL_DAY, -2, UTC))).toEqual(["2026-03-14T00:00:00.000Z", "2026-03-16T00:00:00.000Z"]);
	});
});

describe("resizes", () => {
	it("resizes a timed end and start, never below one snap step", (): void => {
		const day = new Date("2026-03-16T00:00:00Z");
		expect(iso(computeTimedResize(MEETING, "end", day, 11 * 60 + 7, 15, UTC))).toEqual(["2026-03-16T09:00:00.000Z", "2026-03-16T11:00:00.000Z"]);
		expect(iso(computeTimedResize(MEETING, "end", day, 8 * 60, 15, UTC))).toEqual(["2026-03-16T09:00:00.000Z", "2026-03-16T09:15:00.000Z"]);
		expect(iso(computeTimedResize(MEETING, "start", day, 8 * 60 + 30, 15, UTC))).toEqual(["2026-03-16T08:30:00.000Z", "2026-03-16T10:00:00.000Z"]);
		expect(iso(computeTimedResize(MEETING, "start", day, 11 * 60, 15, UTC))).toEqual(["2026-03-16T09:45:00.000Z", "2026-03-16T10:00:00.000Z"]);
	});

	it("resizes a day-granular range by days, never below one day", (): void => {
		expect(iso(computeDayResize(ALL_DAY, "end", 2, UTC))).toEqual(["2026-03-16T00:00:00.000Z", "2026-03-20T00:00:00.000Z"]);
		expect(iso(computeDayResize(ALL_DAY, "end", -5, UTC))).toEqual(["2026-03-16T00:00:00.000Z", "2026-03-17T00:00:00.000Z"]);
		expect(iso(computeDayResize(ALL_DAY, "start", 4, UTC))).toEqual(["2026-03-17T00:00:00.000Z", "2026-03-18T00:00:00.000Z"]);
	});
});

describe("drag-create drafts", () => {
	const day = new Date("2026-03-16T00:00:00Z");
	const bounds = { startMin: 0, endMin: 24 * 60 };

	it("draws a snapped timed rectangle in either direction", (): void => {
		expect(iso(computeTimedDraft(day, 9 * 60 + 5, 10 * 60 + 20, 15, bounds, UTC))).toEqual(["2026-03-16T09:00:00.000Z", "2026-03-16T10:15:00.000Z"]);
		expect(iso(computeTimedDraft(day, 10 * 60, 9 * 60, 15, bounds, UTC))).toEqual(["2026-03-16T09:00:00.000Z", "2026-03-16T10:00:00.000Z"]);
	});

	it("keeps a minimum of one snap step and stays inside the bounds", (): void => {
		expect(iso(computeTimedDraft(day, 9 * 60, 9 * 60, 15, bounds, UTC))).toEqual(["2026-03-16T09:00:00.000Z", "2026-03-16T09:15:00.000Z"]);
		expect(iso(computeTimedDraft(day, 23 * 60 + 50, 24 * 60, 15, bounds, UTC))).toEqual(["2026-03-16T23:45:00.000Z", "2026-03-17T00:00:00.000Z"]);
	});

	it("spans whole days for an all-day draft", (): void => {
		expect(iso(computeDayDraft(new Date("2026-03-18T05:00:00Z"), new Date("2026-03-16T00:00:00Z"), UTC))).toEqual(["2026-03-16T00:00:00.000Z", "2026-03-19T00:00:00.000Z"]);
	});
});

describe("keyboard moves", () => {
	it("needs Alt and maps arrows per granularity", (): void => {
		expect(resolveKeyboardIntent("ArrowRight", { altKey: false, shiftKey: false }, "minute", 15)).toBeNull();
		expect(resolveKeyboardIntent("Enter", { altKey: true, shiftKey: false }, "minute", 15)).toBeNull();
		expect(resolveKeyboardIntent("ArrowDown", { altKey: true, shiftKey: false }, "minute", 15)).toEqual({ kind: "move", dayDelta: 0, minuteDelta: 15 });
		expect(resolveKeyboardIntent("ArrowUp", { altKey: true, shiftKey: false }, "day", 15)).toEqual({ kind: "move", dayDelta: -7, minuteDelta: -0 });
		expect(resolveKeyboardIntent("ArrowLeft", { altKey: true, shiftKey: true }, "day", 15)).toEqual({ kind: "resize-end", dayDelta: -1, minuteDelta: 0 });
	});

	it("applies an intent to a timed or day-granular range", (): void => {
		expect(iso(applyKeyboardIntent(MEETING, { kind: "move", dayDelta: 0, minuteDelta: 15 }, "minute", 15, UTC))).toEqual([
			"2026-03-16T09:15:00.000Z",
			"2026-03-16T10:15:00.000Z",
		]);
		expect(iso(applyKeyboardIntent(ALL_DAY, { kind: "move", dayDelta: 7, minuteDelta: 0 }, "day", 15, UTC))).toEqual(["2026-03-23T00:00:00.000Z", "2026-03-25T00:00:00.000Z"]);
		expect(iso(applyKeyboardIntent(MEETING, { kind: "resize-end", dayDelta: 0, minuteDelta: -15 }, "minute", 15, UTC))).toEqual([
			"2026-03-16T09:00:00.000Z",
			"2026-03-16T09:45:00.000Z",
		]);
		expect(iso(applyKeyboardIntent(MEETING, { kind: "resize-end", dayDelta: 0, minuteDelta: -90 }, "minute", 15, UTC))).toEqual([
			"2026-03-16T09:00:00.000Z",
			"2026-03-16T09:15:00.000Z",
		]);
		expect(iso(applyKeyboardIntent(ALL_DAY, { kind: "resize-end", dayDelta: 1, minuteDelta: 0 }, "day", 15, UTC))).toEqual([
			"2026-03-16T00:00:00.000Z",
			"2026-03-19T00:00:00.000Z",
		]);
	});
});

describe("proposals and permissions", () => {
	const event: CalendarEvent = { id: "e", title: "E", start: MEETING.start, end: MEETING.end, resourceId: "room-a" };
	const occurrence: EventCalendarOccurrence = { key: "e::k", eventId: "e", event, start: event.start, end: event.end, allDay: false, isRecurring: false };

	it("turns a drag state into an update with the matching source", (): void => {
		const drag: EventCalendarDragState = {
			kind: "resize-end",
			occurrence,
			proposedStart: MEETING.start,
			proposedEnd: new Date("2026-03-16T11:00:00Z"),
			proposedAllDay: false,
			proposedDayGranular: false,
			proposedResourceId: "room-b",
			valid: true,
		};
		expect(proposalToUpdate(drag)).toMatchObject({ source: "resize-end", resourceId: "room-b", end: drag.proposedEnd });
		expect(proposalToUpdate({ ...drag, kind: "move" }).source).toBe("drag");
	});

	it("respects interactions, readOnly and per-event flags", (): void => {
		expect(isOccurrenceDraggable(occurrence, true, "move")).toBe(true);
		expect(isOccurrenceDraggable(occurrence, false, "move")).toBe(false);
		expect(isOccurrenceDraggable({ ...occurrence, event: { ...event, readOnly: true } }, true, "resize")).toBe(false);
		expect(isOccurrenceDraggable({ ...occurrence, event: { ...event, draggable: false } }, true, "move")).toBe(false);
		expect(isOccurrenceDraggable({ ...occurrence, event: { ...event, draggable: false } }, true, "resize")).toBe(true);
	});
});
