// @vitest-environment node
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { EventCalendarRecurrenceError, expandRecurrence, formatRRuleString, MAX_OCCURRENCES, parseRRuleString, resolveRecurrenceRule } from "../event-calendar-recurrence";
import type { CalendarEvent, EventCalendarDateRange, EventCalendarOccurrence, EventCalendarRecurrenceRule } from "../event-calendar-types";

const UTC = { timeZone: "UTC" };

function range(start: string, end: string): EventCalendarDateRange {
	return { start: new Date(start), end: new Date(end) };
}

function starts(occurrences: readonly EventCalendarOccurrence[]): string[] {
	return occurrences.map((occurrence: EventCalendarOccurrence): string => occurrence.start.toISOString());
}

function series(recurrence: CalendarEvent["recurrence"], start = "2026-03-02T09:00:00Z", end = "2026-03-02T10:00:00Z"): CalendarEvent {
	return { id: "s", title: "Series", start: new Date(start), end: new Date(end), ...(recurrence === undefined ? {} : { recurrence }) };
}

describe("parseRRuleString", () => {
	it("parses every supported part, with or without the RRULE: prefix", (): void => {
		expect(parseRRuleString("RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=5;BYDAY=MO,-1FR;WKST=SU;BYMONTHDAY=1,-1;BYMONTH=3")).toEqual({
			freq: "weekly",
			interval: 2,
			count: 5,
			byWeekday: ["MO", { day: "FR", ordinal: -1 }],
			weekStart: "SU",
			byMonthDay: [1, -1],
			byMonth: [3],
		});
		expect(parseRRuleString("freq=daily").freq).toBe("daily");
	});

	it("reads UNTIL as UTC with Z and as display-zone wall time without it", (): void => {
		expect(parseRRuleString("FREQ=DAILY;UNTIL=20260310T120000Z").until?.toISOString()).toBe("2026-03-10T12:00:00.000Z");
		// Date-only = the end of that day in New York (EDT, UTC-4).
		expect(parseRRuleString("FREQ=DAILY;UNTIL=20260310", "America/New_York").until?.toISOString()).toBe("2026-03-11T03:59:59.000Z");
	});

	it("rejects unsupported or malformed parts", (): void => {
		expect((): void => {
			parseRRuleString("FREQ=HOURLY");
		}).toThrow(EventCalendarRecurrenceError);
		expect((): void => {
			parseRRuleString("FREQ=DAILY;BYSETPOS=1");
		}).toThrow("Unsupported recurrence part: BYSETPOS");
		expect((): void => {
			parseRRuleString("INTERVAL=2");
		}).toThrow("missing FREQ");
		expect((): void => {
			parseRRuleString("FREQ=WEEKLY;BYDAY=XX");
		}).toThrow("BYDAY=XX");
		expect((): void => {
			parseRRuleString("FREQ=MONTHLY;BYMONTHDAY=abc");
		}).toThrow("BYMONTHDAY=abc");
		expect((): void => {
			parseRRuleString("FREQ=DAILY;UNTIL=tomorrow");
		}).toThrow("UNTIL=tomorrow");
	});

	it("round-trips through formatRRuleString", (): void => {
		const line = "FREQ=MONTHLY;INTERVAL=3;COUNT=4;UNTIL=20261231T235959Z;BYDAY=2TU;BYMONTHDAY=15;BYMONTH=6;WKST=MO";
		expect(formatRRuleString(parseRRuleString(line))).toBe(line);
	});

	it("resolveRecurrenceRule passes structured rules through", (): void => {
		const rule: EventCalendarRecurrenceRule = { freq: "daily" };
		expect(resolveRecurrenceRule(rule)).toBe(rule);
	});
});

describe("expandRecurrence", () => {
	it("yields one occurrence for a plain event, including a zero-length milestone at the range start", (): void => {
		const plain = series(undefined);
		expect(starts(expandRecurrence(plain, range("2026-03-01T00:00:00Z", "2026-03-08T00:00:00Z"), UTC))).toEqual(["2026-03-02T09:00:00.000Z"]);
		expect(expandRecurrence(plain, range("2026-03-03T00:00:00Z", "2026-03-04T00:00:00Z"), UTC)).toEqual([]);
		const milestone = series(undefined, "2026-03-01T00:00:00Z", "2026-03-01T00:00:00Z");
		expect(expandRecurrence(milestone, range("2026-03-01T00:00:00Z", "2026-03-02T00:00:00Z"), UTC)).toHaveLength(1);
	});

	it("expands a daily COUNT series with stable keys and indices", (): void => {
		const occurrences = expandRecurrence(series("FREQ=DAILY;COUNT=3"), range("2026-03-01T00:00:00Z", "2026-04-01T00:00:00Z"), UTC);
		expect(starts(occurrences)).toEqual(["2026-03-02T09:00:00.000Z", "2026-03-03T09:00:00.000Z", "2026-03-04T09:00:00.000Z"]);
		expect(occurrences.map((occurrence: EventCalendarOccurrence): number | undefined => occurrence.recurrenceIndex)).toEqual([0, 1, 2]);
		expect(occurrences[LIST_SLOT_INDEX.first]?.key).toBe("s::2026-03-02T09:00:00.000Z");
		expect(occurrences.every((occurrence: EventCalendarOccurrence): boolean => occurrence.isRecurring)).toBe(true);
	});

	it("expands weekly BYDAY within the DTSTART week onward", (): void => {
		// 2 March 2026 is a Monday.
		const occurrences = expandRecurrence(series("FREQ=WEEKLY;BYDAY=MO,WE"), range("2026-03-01T00:00:00Z", "2026-03-15T00:00:00Z"), UTC);
		expect(starts(occurrences)).toEqual(["2026-03-02T09:00:00.000Z", "2026-03-04T09:00:00.000Z", "2026-03-09T09:00:00.000Z", "2026-03-11T09:00:00.000Z"]);
	});

	it("honours INTERVAL and keeps the COUNT ordinal when fast-forwarding to a late window", (): void => {
		const occurrences = expandRecurrence(series("FREQ=WEEKLY;INTERVAL=2"), range("2026-06-01T00:00:00Z", "2026-06-30T00:00:00Z"), UTC);
		expect(starts(occurrences)).toEqual(["2026-06-08T09:00:00.000Z", "2026-06-22T09:00:00.000Z"]);
		expect(occurrences[LIST_SLOT_INDEX.first]?.recurrenceIndex).toBe(7);
	});

	it("resolves monthly ordinal weekdays (second Tuesday, last Friday)", (): void => {
		const occurrences = expandRecurrence(series("FREQ=MONTHLY;BYDAY=2TU,-1FR"), range("2026-03-01T00:00:00Z", "2026-05-01T00:00:00Z"), UTC);
		expect(starts(occurrences)).toEqual(["2026-03-10T09:00:00.000Z", "2026-03-27T09:00:00.000Z", "2026-04-14T09:00:00.000Z", "2026-04-24T09:00:00.000Z"]);
	});

	it("resolves negative BYMONTHDAY to the month end", (): void => {
		const occurrences = expandRecurrence(series("FREQ=MONTHLY;BYMONTHDAY=-1"), range("2026-03-01T00:00:00Z", "2026-05-01T00:00:00Z"), UTC);
		expect(starts(occurrences)).toEqual(["2026-03-31T09:00:00.000Z", "2026-04-30T09:00:00.000Z"]);
	});

	it("resolves yearly BYMONTH + BYDAY (US Thanksgiving)", (): void => {
		const occurrences = expandRecurrence(series("FREQ=YEARLY;BYMONTH=11;BYDAY=4TH"), range("2026-01-01T00:00:00Z", "2028-01-01T00:00:00Z"), UTC);
		expect(starts(occurrences)).toEqual(["2026-11-26T09:00:00.000Z", "2027-11-25T09:00:00.000Z"]);
	});

	it("applies daily LIMIT filters (FREQ=DAILY;BYDAY=MO is Mondays only)", (): void => {
		const occurrences = expandRecurrence(series("FREQ=DAILY;BYDAY=MO"), range("2026-03-01T00:00:00Z", "2026-03-20T00:00:00Z"), UTC);
		expect(starts(occurrences)).toEqual(["2026-03-02T09:00:00.000Z", "2026-03-09T09:00:00.000Z", "2026-03-16T09:00:00.000Z"]);
	});

	it("stops at UNTIL (inclusive)", (): void => {
		const occurrences = expandRecurrence(series("FREQ=DAILY;UNTIL=20260304T090000Z"), range("2026-03-01T00:00:00Z", "2026-04-01T00:00:00Z"), UTC);
		expect(occurrences).toHaveLength(3);
	});

	it("removes exDates after COUNT numbering and adds rDates with the same duration", (): void => {
		const rule: EventCalendarRecurrenceRule = { freq: "daily", count: 3, exDates: [new Date("2026-03-03T09:00:00Z")], rDates: [new Date("2026-03-10T15:00:00Z")] };
		const occurrences = expandRecurrence(series(rule), range("2026-03-01T00:00:00Z", "2026-04-01T00:00:00Z"), UTC);
		expect(starts(occurrences)).toEqual(["2026-03-02T09:00:00.000Z", "2026-03-04T09:00:00.000Z", "2026-03-10T15:00:00.000Z"]);
		expect(occurrences.at(-1)?.end.toISOString()).toBe("2026-03-10T16:00:00.000Z");
		expect(occurrences.at(-1)?.recurrenceIndex).toBe(3);
	});

	it("keeps wall time across a DST change in the display zone", (): void => {
		// 9:00 New York before and after the 8 March 2026 spring-forward.
		const event = series("FREQ=DAILY;COUNT=3", "2026-03-07T14:00:00Z", "2026-03-07T15:00:00Z");
		const occurrences = expandRecurrence(event, range("2026-03-01T00:00:00Z", "2026-03-31T00:00:00Z"), { timeZone: "America/New_York" });
		expect(starts(occurrences)).toEqual(["2026-03-07T14:00:00.000Z", "2026-03-08T13:00:00.000Z", "2026-03-09T13:00:00.000Z"]);
	});

	it("keeps whole-day spans as wall days across DST", (): void => {
		const event: CalendarEvent = {
			id: "a",
			title: "All day",
			allDay: true,
			start: new Date("2026-03-07T05:00:00Z"),
			end: new Date("2026-03-09T04:00:00Z"),
			recurrence: { freq: "weekly", count: 2 },
		};
		const occurrences = expandRecurrence(event, range("2026-03-01T00:00:00Z", "2026-03-31T00:00:00Z"), { timeZone: "America/New_York" });
		expect(occurrences.map((occurrence: EventCalendarOccurrence): string => occurrence.end.toISOString())).toEqual(["2026-03-09T04:00:00.000Z", "2026-03-16T04:00:00.000Z"]);
	});

	it("caps an unbounded series at MAX_OCCURRENCES", (): void => {
		const occurrences = expandRecurrence(series("FREQ=DAILY", "2026-01-01T00:00:00Z", "2026-01-01T00:30:00Z"), range("2026-01-01T00:00:00Z", "2030-01-01T00:00:00Z"), UTC);
		expect(occurrences).toHaveLength(MAX_OCCURRENCES);
	});

	it("rejects a BYDAY ordinal on a weekly rule", (): void => {
		expect((): void => {
			expandRecurrence(series("FREQ=WEEKLY;BYDAY=1MO"), range("2026-03-01T00:00:00Z", "2026-04-01T00:00:00Z"), UTC);
		}).toThrow("BYDAY ordinal outside monthly/yearly");
	});
});
