// @vitest-environment node
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	addZonedDays,
	buildEventIndex,
	chunkWeeks,
	createPriorityEventOrder,
	dayOffsets,
	defaultEventOrder,
	flattenResources,
	getDayKey,
	getDayTotalMinutes,
	getRangeKey,
	getViewDateRange,
	getVisibleDays,
	gridPosition,
	isBarOccurrence,
	leafResources,
	minutesToInstant,
	packTimedSegments,
	packWeekRowLanes,
	rangeColumnSpan,
	rangesIntersect,
	resolveOffDay,
	segmentOccurrence,
	snapMinutes,
	spansMultipleDays,
	stepDate,
	zonedMinutesOfDay,
	zonedStartOfDay,
	type ViewRangeOptions,
} from "./event-calendar-lib";
import type { CalendarEvent, EventCalendarOccurrence, EventCalendarResource, EventCalendarSegment } from "./event-calendar-types";

const UTC = "UTC";
const NEW_YORK = "America/New_York";
const OPTIONS: ViewRangeOptions = { timeZone: UTC, weekStartsOn: 1, dayCount: 3, agendaDayCount: 14, fixedWeeks: true };

/** The instant as a UTC ISO string (TZDate#toISOString prints its own offset). */
function utc(date: Date | undefined): string | undefined {
	return date === undefined ? undefined : new Date(date.getTime()).toISOString();
}

function occurrence(id: string, start: string, end: string, allDay = false): EventCalendarOccurrence {
	const event: CalendarEvent = { id, title: id, start: new Date(start), end: new Date(end), allDay };
	return { key: `${id}::${event.start.toISOString()}`, eventId: id, event, start: event.start, end: event.end, allDay, isRecurring: false };
}

function timedSegment(id: string, startMin: number, endMin: number): EventCalendarSegment {
	return {
		occurrence: occurrence(id, "2026-03-16T00:00:00Z", "2026-03-16T01:00:00Z"),
		day: new Date("2026-03-16T00:00:00Z"),
		isStart: true,
		isEnd: true,
		continuesBefore: false,
		continuesAfter: false,
		startMin,
		endMin,
	};
}

describe("view ranges and stepping", () => {
	it("derives a fixed 6-week month grid starting on the configured weekday", (): void => {
		const { activeRange, visibleRange } = getViewDateRange("month", new Date("2026-03-15T10:00:00Z"), OPTIONS);
		expect(utc(activeRange.start)).toBe("2026-03-01T00:00:00.000Z");
		expect(utc(activeRange.end)).toBe("2026-04-01T00:00:00.000Z");
		expect(utc(visibleRange.start)).toBe("2026-02-23T00:00:00.000Z");
		expect(getVisibleDays(visibleRange, UTC)).toHaveLength(42);
	});

	it("trims the month grid to its weeks when fixedWeeks is off", (): void => {
		const { visibleRange } = getViewDateRange("month", new Date("2021-02-10T00:00:00Z"), { ...OPTIONS, fixedWeeks: false });
		expect(getVisibleDays(visibleRange, UTC)).toHaveLength(28);
	});

	it("derives week, day, N-days, agenda and resource ranges", (): void => {
		const date = new Date("2026-03-15T10:00:00Z");
		expect(getRangeKey(getViewDateRange("week", date, OPTIONS).visibleRange)).toBe(`${String(Date.UTC(2026, 2, 9))}-${String(Date.UTC(2026, 2, 16))}`);
		expect(utc(getViewDateRange("day", date, OPTIONS).visibleRange.end)).toBe("2026-03-16T00:00:00.000Z");
		expect(utc(getViewDateRange("resource", date, OPTIONS).visibleRange.start)).toBe("2026-03-15T00:00:00.000Z");
		expect(utc(getViewDateRange("days", date, OPTIONS).visibleRange.end)).toBe("2026-03-18T00:00:00.000Z");
		expect(utc(getViewDateRange("agenda", date, OPTIONS).visibleRange.end)).toBe("2026-03-29T00:00:00.000Z");
	});

	it("resolves ranges in the display zone, not the host zone", (): void => {
		// 02:00 UTC on 16 March is still 15 March in New York.
		const { visibleRange } = getViewDateRange("day", new Date("2026-03-16T02:00:00Z"), { ...OPTIONS, timeZone: NEW_YORK });
		expect(utc(visibleRange.start)).toBe("2026-03-15T04:00:00.000Z");
	});

	it("steps every view and keeps month-end stepping invertible", (): void => {
		const step = { timeZone: UTC, dayCount: 3, agendaDayCount: 14 };
		const january31 = new Date("2026-01-31T12:00:00Z");
		const february = stepDate("month", january31, 1, step);
		expect(february.getUTCDate()).toBe(28);
		expect(stepDate("month", february, -1, step).getUTCDate()).toBe(31);
		expect(utc(stepDate("week", january31, -1, step))).toBe("2026-01-24T12:00:00.000Z");
		expect(utc(stepDate("day", january31, 1, step))).toBe("2026-02-01T12:00:00.000Z");
		expect(utc(stepDate("days", january31, 1, step))).toBe("2026-02-03T12:00:00.000Z");
		expect(utc(stepDate("agenda", january31, 1, step))).toBe("2026-02-14T12:00:00.000Z");
	});
});

describe("zoned day helpers", () => {
	it("keys, midnights and minutes follow the display zone", (): void => {
		const instant = new Date("2026-03-16T02:30:00Z");
		expect(getDayKey(instant, UTC)).toBe("2026-03-16");
		expect(getDayKey(instant, NEW_YORK)).toBe("2026-03-15");
		expect(utc(zonedStartOfDay(instant, NEW_YORK))).toBe("2026-03-15T04:00:00.000Z");
		expect(zonedMinutesOfDay(instant, NEW_YORK)).toBe(22 * 60 + 30);
		expect(utc(addZonedDays(instant, 1, UTC))).toBe("2026-03-17T00:00:00.000Z");
		expect(utc(minutesToInstant(instant, 90, UTC))).toBe("2026-03-16T01:30:00.000Z");
	});

	it("measures DST transition days honestly", (): void => {
		expect(getDayTotalMinutes(new Date("2026-03-08T12:00:00Z"), NEW_YORK)).toBe(23 * 60);
		expect(getDayTotalMinutes(new Date("2026-11-01T12:00:00Z"), NEW_YORK)).toBe(25 * 60);
		expect(getDayTotalMinutes(new Date("2026-03-16T12:00:00Z"), UTC)).toBe(24 * 60);
	});

	it("snaps minutes and chunks weeks", (): void => {
		expect(snapMinutes(37, 15)).toBe(30);
		expect(snapMinutes(38, 15)).toBe(45);
		expect(
			chunkWeeks(getVisibleDays({ start: new Date("2026-03-02T00:00:00Z"), end: new Date("2026-03-16T00:00:00Z") }, UTC)).map((week: Date[]): number => week.length),
		).toEqual([7, 7]);
	});
});

describe("segmentation", () => {
	it("splits a multi-day event per day with an exclusive end", (): void => {
		const range = { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-04-01T00:00:00Z") };
		const segments = segmentOccurrence(occurrence("a", "2026-03-16T22:00:00Z", "2026-03-18T00:00:00Z"), range, UTC);
		expect(segments).toHaveLength(2);
		const [first, second] = segments;
		expect(first?.startMin).toBe(22 * 60);
		expect(first?.continuesAfter).toBe(true);
		expect(second?.endMin).toBe(24 * 60);
		expect(second?.isEnd).toBe(true);
	});

	it("emits one segment for a zero-length event and drops startMin for all-day ones", (): void => {
		const range = { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-04-01T00:00:00Z") };
		expect(segmentOccurrence(occurrence("m", "2026-03-16T09:00:00Z", "2026-03-16T09:00:00Z"), range, UTC)).toHaveLength(1);
		const [allDay] = segmentOccurrence(occurrence("d", "2026-03-16T00:00:00Z", "2026-03-17T00:00:00Z", true), range, UTC);
		expect(allDay?.startMin).toBeUndefined();
	});

	it("clamps to the range and skips events outside it", (): void => {
		const range = { start: new Date("2026-03-17T00:00:00Z"), end: new Date("2026-03-18T00:00:00Z") };
		const [clamped] = segmentOccurrence(occurrence("a", "2026-03-16T22:00:00Z", "2026-03-17T02:00:00Z"), range, UTC);
		expect(clamped?.continuesBefore).toBe(true);
		expect(segmentOccurrence(occurrence("b", "2026-03-10T00:00:00Z", "2026-03-11T00:00:00Z"), range, UTC)).toEqual([]);
	});

	it("classifies bars: all-day or longer than the starting day", (): void => {
		expect(spansMultipleDays({ start: new Date("2026-03-16T00:00:00Z"), end: new Date("2026-03-17T00:00:00Z") }, UTC)).toBe(false);
		expect(spansMultipleDays({ start: new Date("2026-03-16T00:00:00Z"), end: new Date("2026-03-17T00:01:00Z") }, UTC)).toBe(true);
		// A 00:00 → 00:00 shift on the 25-hour fall-back day is still one day.
		expect(spansMultipleDays({ start: new Date("2026-11-01T04:00:00Z"), end: new Date("2026-11-02T05:00:00Z") }, NEW_YORK)).toBe(false);
		expect(isBarOccurrence(occurrence("d", "2026-03-16T00:00:00Z", "2026-03-16T01:00:00Z", true), UTC)).toBe(true);
	});
});

describe("overlap packing", () => {
	it("puts overlapping blocks side by side and widens free neighbours", (): void => {
		const packed = packTimedSegments([timedSegment("a", 540, 600), timedSegment("b", 555, 630), timedSegment("c", 600, 660)]);
		const byId = new Map(packed.map((segment: EventCalendarSegment): [string, EventCalendarSegment] => [segment.occurrence.eventId, segment]));
		expect(byId.get("a")).toMatchObject({ column: 0, columnCount: 2, columnSpan: 1 });
		expect(byId.get("b")).toMatchObject({ column: 1, columnCount: 2 });
		expect(byId.get("c")).toMatchObject({ column: 0, columnCount: 2, columnSpan: 1 });
	});

	it("gives a lone block the full width and leaves the input untouched", (): void => {
		const input = [timedSegment("solo", 600, 660)];
		const [packed] = packTimedSegments(input);
		expect(packed).toMatchObject({ column: 0, columnCount: 1, columnSpan: 1 });
		expect(input[LIST_SLOT_INDEX.first]?.column).toBeUndefined();
	});

	it("enforces the minimum packing slot so tiny events never stack invisibly", (): void => {
		const packed = packTimedSegments([timedSegment("a", 600, 605), timedSegment("b", 610, 615)]);
		expect(packed.map((segment: EventCalendarSegment): number | undefined => segment.columnCount)).toEqual([2, 2]);
	});
});

describe("week-row lanes", () => {
	const range = { start: new Date("2026-03-16T00:00:00Z"), end: new Date("2026-03-23T00:00:00Z") };
	const rowStart = new Date("2026-03-16T00:00:00Z");

	it("merges consecutive-day segments into one bar and stacks overlaps into lanes", (): void => {
		const long = segmentOccurrence(occurrence("long", "2026-03-16T00:00:00Z", "2026-03-19T00:00:00Z", true), range, UTC);
		const short = segmentOccurrence(occurrence("short", "2026-03-17T00:00:00Z", "2026-03-18T00:00:00Z", true), range, UTC);
		const later = segmentOccurrence(occurrence("later", "2026-03-20T00:00:00Z", "2026-03-21T00:00:00Z", true), range, UTC);
		const bars = packWeekRowLanes([...long, ...short, ...later], 0, rowStart, UTC);
		const byId = new Map(bars.map((bar: EventCalendarSegment): [string, EventCalendarSegment] => [bar.occurrence.eventId, bar]));
		expect(byId.get("long")).toMatchObject({ colStart: 0, colSpan: 3, lane: 0, isStart: true, isEnd: true });
		expect(byId.get("short")).toMatchObject({ colStart: 1, colSpan: 1, lane: 1 });
		expect(byId.get("later")).toMatchObject({ colStart: 4, lane: 0 });
		expect(long[LIST_SLOT_INDEX.first]?.lane).toBeUndefined();
	});

	it("supports rows wider than a week", (): void => {
		const wide = { start: rowStart, end: new Date("2026-03-26T00:00:00Z") };
		const segments = segmentOccurrence(occurrence("w", "2026-03-23T00:00:00Z", "2026-03-25T00:00:00Z", true), wide, UTC);
		expect(packWeekRowLanes(segments, 0, rowStart, UTC, 10).at(0)).toMatchObject({ colStart: 7, colSpan: 2 });
	});

	it("maps day offsets onto visible columns and ranges onto row spans", (): void => {
		const weekdays = getVisibleDays(range, UTC).slice(0, 5);
		const offsets = dayOffsets(weekdays, rowStart, UTC);
		expect(offsets).toEqual([0, 1, 2, 3, 4]);
		expect(gridPosition(offsets, 3, 4)).toEqual({ column: 3, span: 2 });
		expect(gridPosition(offsets, 5, 2)).toBeNull();
		expect(rangeColumnSpan({ start: new Date("2026-03-14T00:00:00Z"), end: new Date("2026-03-18T00:00:00Z") }, rowStart, 7, UTC)).toEqual({ colStart: 0, colSpan: 2 });
		expect(rangeColumnSpan({ start: new Date("2026-03-25T00:00:00Z"), end: new Date("2026-03-26T00:00:00Z") }, rowStart, 7, UTC)).toBeNull();
	});
});

describe("buildEventIndex", () => {
	const visibleRange = { start: new Date("2026-03-16T00:00:00Z"), end: new Date("2026-03-23T00:00:00Z") };

	it("buckets timed and bar segments per day and builds laned week rows", (): void => {
		const events: CalendarEvent[] = [
			{ id: "t", title: "Timed", start: new Date("2026-03-16T09:00:00Z"), end: new Date("2026-03-16T10:00:00Z") },
			{ id: "b", title: "Bar", start: new Date("2026-03-17T00:00:00Z"), end: new Date("2026-03-19T00:00:00Z"), allDay: true },
			{ id: "out", title: "Outside", start: new Date("2026-04-01T09:00:00Z"), end: new Date("2026-04-01T10:00:00Z") },
		];
		const index = buildEventIndex(events, visibleRange, { timeZone: UTC, weekStartsOn: 1 });
		expect(index.occurrences.map((item: EventCalendarOccurrence): string => item.eventId)).toEqual(["t", "b"]);
		expect(index.byDay.get("2026-03-16")?.timed.at(0)?.columnCount).toBe(1);
		expect(index.byDay.get("2026-03-18")?.allDay).toHaveLength(1);
		expect(index.weekRows.at(0)?.bars.at(0)).toMatchObject({ colStart: 1, colSpan: 2 });
	});

	it("replaces a series instance with its RECURRENCE-ID override", (): void => {
		const events: CalendarEvent[] = [
			{ id: "s", title: "Series", start: new Date("2026-03-16T09:00:00Z"), end: new Date("2026-03-16T10:00:00Z"), recurrence: "FREQ=DAILY;COUNT=3" },
			{
				id: "o",
				title: "Moved",
				start: new Date("2026-03-17T15:00:00Z"),
				end: new Date("2026-03-17T16:00:00Z"),
				recurringEventId: "s",
				originalStart: new Date("2026-03-17T09:00:00Z"),
			},
		];
		const index = buildEventIndex(events, visibleRange, { timeZone: UTC, weekStartsOn: 1 });
		expect(index.occurrences.map((item: EventCalendarOccurrence): string => item.start.toISOString())).toEqual([
			"2026-03-16T09:00:00.000Z",
			"2026-03-17T15:00:00.000Z",
			"2026-03-18T09:00:00.000Z",
		]);
	});

	it("uses a custom getOccurrences engine and a custom order", (): void => {
		const events: CalendarEvent[] = [
			{ id: "low", title: "Low", start: new Date("2026-03-16T09:00:00Z"), end: new Date("2026-03-16T10:00:00Z"), priority: 0 },
			{ id: "high", title: "High", start: new Date("2026-03-16T11:00:00Z"), end: new Date("2026-03-16T12:00:00Z"), priority: 5 },
		];
		const index = buildEventIndex(events, visibleRange, {
			timeZone: UTC,
			weekStartsOn: 1,
			eventOrder: createPriorityEventOrder((event: CalendarEvent): number => event.priority ?? 0),
			getOccurrences: (event: CalendarEvent) =>
				event.id === "low"
					? [
							{ start: event.start, end: event.end },
							{ start: new Date("2026-03-17T09:00:00Z"), end: new Date("2026-03-17T10:00:00Z") },
						]
					: null,
		});
		expect(index.occurrences.map((item: EventCalendarOccurrence): string => item.eventId)).toEqual(["high", "low", "low"]);
		expect(index.occurrences.at(-1)?.recurrenceIndex).toBe(1);
		expect(defaultEventOrder(occurrence("a", "2026-03-16T09:00:00Z", "2026-03-16T11:00:00Z"), occurrence("b", "2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z"))).toBeLessThan(
			0,
		);
	});
});

describe("ranges, resources and off days", () => {
	it("tests half-open intersection", (): void => {
		const day = { start: new Date("2026-03-16T00:00:00Z"), end: new Date("2026-03-17T00:00:00Z") };
		expect(rangesIntersect(day, { start: new Date("2026-03-17T00:00:00Z"), end: new Date("2026-03-18T00:00:00Z") })).toBe(false);
		expect(rangesIntersect(day, { start: new Date("2026-03-16T23:00:00Z"), end: new Date("2026-03-18T00:00:00Z") })).toBe(true);
	});

	it("flattens the resource tree and keeps leaves as columns", (): void => {
		const tree: EventCalendarResource[] = [
			{
				id: "team",
				title: "Team",
				children: [
					{ id: "a", title: "A" },
					{ id: "b", title: "B" },
				],
			},
			{ id: "c", title: "C" },
		];
		expect(flattenResources(tree).map((row): string => `${row.resource.id}:${String(row.depth)}`)).toEqual(["team:0", "a:1", "b:1", "c:0"]);
		expect(leafResources(tree).map((resource: EventCalendarResource): string => resource.id)).toEqual(["a", "b", "c"]);
	});

	it("resolves off days from weekend days, explicit dates and a predicate", (): void => {
		const saturday = new Date("2026-03-21T12:00:00Z");
		const monday = new Date("2026-03-16T12:00:00Z");
		expect(resolveOffDay(saturday, UTC, true)).toBe(true);
		expect(resolveOffDay(monday, UTC, true)).toBe(false);
		expect(resolveOffDay(saturday, UTC, false)).toBe(false);
		expect(resolveOffDay(monday, UTC, { weekendDays: [1] })).toBe(true);
		expect(resolveOffDay(monday, UTC, { dates: [new Date("2026-03-16T00:00:00Z")] })).toBe(true);
		expect(resolveOffDay(monday, UTC, { isOffDay: (): boolean => true })).toBe(true);
		expect(resolveOffDay(saturday, UTC, true, [5])).toBe(false);
	});
});
