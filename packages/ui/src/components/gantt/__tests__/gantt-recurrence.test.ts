// @vitest-environment node
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { expandRecurrence, formatRRuleString, GanttRecurrenceError, isInstanceVisible, MAX_OCCURRENCES, parseRRuleString, resolveRecurrenceRule } from "../gantt-recurrence";
import { MS_PER_DAY } from "../gantt-lib";
import type { GanttEvent, GanttOccurrence, GanttRecurrenceRule } from "../gantt-types";

const UTC = "UTC";

function at(year: number, monthIndex: number, day: number, hour = 0): Date {
	return new Date(Date.UTC(year, monthIndex, day, hour));
}

function starts(occurrences: readonly GanttOccurrence[]): string[] {
	return occurrences.map((occurrence: GanttOccurrence): string => occurrence.start.toISOString());
}

const DAILY: GanttEvent = { id: "d", title: "Standup", start: at(2026, 0, 1, 9), end: at(2026, 0, 1, 10), recurrence: "RRULE:FREQ=DAILY;COUNT=3" };

describe("parseRRuleString", (): void => {
	it("parses the supported subset with or without the prefix", (): void => {
		expect(parseRRuleString("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,2TU;WKST=MO;COUNT=5")).toEqual({
			freq: "weekly",
			interval: 2,
			byWeekday: ["MO", { day: "TU", ordinal: 2 }],
			weekStart: "MO",
			count: 5,
		});
		expect(parseRRuleString("RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15;BYMONTH=3").byMonthDay).toEqual([1, 15]);
	});

	it("clamps INTERVAL and COUNT to at least 1", (): void => {
		expect(parseRRuleString("FREQ=DAILY;INTERVAL=0;COUNT=x")).toEqual({ freq: "daily", interval: 1, count: 1 });
	});

	it("resolves UNTIL in UTC, or in the display zone when floating", (): void => {
		expect(parseRRuleString("FREQ=DAILY;UNTIL=20260105T120000Z").until?.toISOString()).toBe("2026-01-05T12:00:00.000Z");
		expect(parseRRuleString("FREQ=DAILY;UNTIL=20260105", "Asia/Singapore").until?.toISOString()).toBe("2026-01-05T15:59:59.000Z");
	});

	it("throws a typed error for unsupported or malformed parts", (): void => {
		expect((): void => {
			parseRRuleString("FREQ=HOURLY");
		}).toThrow(GanttRecurrenceError);
		expect((): void => {
			parseRRuleString("COUNT=2");
		}).toThrow("missing FREQ");
		expect((): void => {
			parseRRuleString("FREQ=DAILY;BYDAY=XX");
		}).toThrow("BYDAY=XX");
		expect((): void => {
			parseRRuleString("FREQ=DAILY;UNTIL=nope");
		}).toThrow("UNTIL=nope");
		expect((): void => {
			parseRRuleString("FREQ=DAILY;BYSETPOS=1");
		}).toThrow("BYSETPOS");
		expect((): void => {
			parseRRuleString("FREQ=DAILY;WKST=XX");
		}).toThrow("WKST=XX");
	});
});

describe("formatRRuleString", (): void => {
	it("round-trips a structured rule", (): void => {
		const line = formatRRuleString({
			freq: "weekly",
			interval: 2,
			count: 4,
			until: at(2026, 1, 3, 4),
			byWeekday: ["MO", { day: "FR", ordinal: -1 }],
			byMonthDay: [2],
			byMonth: [6],
			weekStart: "SU",
		});
		expect(line).toBe("FREQ=WEEKLY;INTERVAL=2;COUNT=4;UNTIL=20260203T040000Z;BYDAY=MO,-1FR;BYMONTHDAY=2;BYMONTH=6;WKST=SU");
		expect(formatRRuleString(parseRRuleString(line))).toBe(line);
	});

	it("omits a default interval", (): void => {
		expect(formatRRuleString({ freq: "daily", interval: 1 })).toBe("FREQ=DAILY");
	});
});

describe("resolveRecurrenceRule", (): void => {
	it("passes structured rules through and parses strings", (): void => {
		const rule: GanttRecurrenceRule = { freq: "yearly" };
		expect(resolveRecurrenceRule(rule)).toBe(rule);
		expect(resolveRecurrenceRule("FREQ=YEARLY").freq).toBe("yearly");
	});
});

describe("isInstanceVisible", (): void => {
	const range = { start: at(2026, 0, 1), end: at(2026, 0, 2) };
	it("is half-open, with milestones closed at the start", (): void => {
		expect(isInstanceVisible(at(2026, 0, 1).getTime(), at(2026, 0, 1).getTime(), range)).toBe(true);
		expect(isInstanceVisible(at(2026, 0, 2).getTime(), at(2026, 0, 2).getTime(), range)).toBe(false);
		expect(isInstanceVisible(at(2025, 11, 31).getTime(), at(2026, 0, 1).getTime(), range)).toBe(false);
	});
});

describe("expandRecurrence", (): void => {
	const january = { start: at(2026, 0, 1), end: at(2026, 1, 1) };

	it("yields a single occurrence for a plain event, and none outside the range", (): void => {
		const plain: GanttEvent = { id: "p", title: "Plain", start: at(2026, 0, 5), end: at(2026, 0, 6) };
		expect(expandRecurrence(plain, january, { timeZone: UTC })).toEqual([
			{ key: `p::${at(2026, 0, 5).toISOString()}`, eventId: "p", event: plain, start: plain.start, end: plain.end, allDay: false, isRecurring: false },
		]);
		expect(expandRecurrence(plain, { start: at(2026, 2, 1), end: at(2026, 3, 1) }, { timeZone: UTC })).toEqual([]);
	});

	it("honours COUNT with series-absolute indices", (): void => {
		const occurrences = expandRecurrence(DAILY, january, { timeZone: UTC });
		expect(starts(occurrences)).toEqual([at(2026, 0, 1, 9).toISOString(), at(2026, 0, 2, 9).toISOString(), at(2026, 0, 3, 9).toISOString()]);
		expect(occurrences.map((occurrence: GanttOccurrence): number | undefined => occurrence.recurrenceIndex)).toEqual([0, 1, 2]);
	});

	it("expands weekly BYDAY within each week and respects UNTIL", (): void => {
		const event: GanttEvent = {
			id: "w",
			title: "Gym",
			start: at(2026, 0, 5, 7),
			end: at(2026, 0, 5, 8),
			recurrence: { freq: "weekly", byWeekday: ["MO", "WE"], until: at(2026, 0, 14, 23) },
		};
		expect(starts(expandRecurrence(event, january, { timeZone: UTC }))).toEqual(
			[at(2026, 0, 5, 7), at(2026, 0, 7, 7), at(2026, 0, 12, 7), at(2026, 0, 14, 7)].map((date: Date): string => date.toISOString()),
		);
	});

	it("fast-forwards an old daily series so it still reaches a late window with the right index", (): void => {
		const old: GanttEvent = { id: "o", title: "Old", start: at(2020, 0, 1, 9), end: at(2020, 0, 1, 10), recurrence: { freq: "daily" } };
		const occurrences = expandRecurrence(old, { start: at(2026, 0, 1), end: at(2026, 0, 3) }, { timeZone: UTC });
		expect(starts(occurrences)).toEqual([at(2026, 0, 1, 9).toISOString(), at(2026, 0, 2, 9).toISOString()]);
		const dayIndex = (at(2026, 0, 1).getTime() - at(2020, 0, 1).getTime()) / MS_PER_DAY;
		expect(occurrences[LIST_SLOT_INDEX.first]?.recurrenceIndex).toBe(dayIndex);
	});

	it("caps one expansion at MAX_OCCURRENCES", (): void => {
		const endless: GanttEvent = { id: "e", title: "Endless", start: at(2026, 0, 1), end: at(2026, 0, 1, 1), recurrence: { freq: "daily", count: MAX_OCCURRENCES * 2 } };
		expect(expandRecurrence(endless, { start: at(2026, 0, 1), end: at(2036, 0, 1) }, { timeZone: UTC })).toHaveLength(MAX_OCCURRENCES);
	});

	it("drops exDates (still consuming COUNT) and appends rDates in order", (): void => {
		const event: GanttEvent = { ...DAILY, recurrence: { freq: "daily", count: 3, exDates: [at(2026, 0, 2, 9)], rDates: [at(2026, 0, 20, 9), at(2026, 0, 1, 9)] } };
		const occurrences = expandRecurrence(event, january, { timeZone: UTC });
		expect(starts(occurrences)).toEqual([at(2026, 0, 1, 9), at(2026, 0, 3, 9), at(2026, 0, 20, 9)].map((date: Date): string => date.toISOString()));
		expect(occurrences.at(-1)?.recurrenceIndex).toBe(3);
	});

	it("steps monthly by wall time (clamping a 31st)", (): void => {
		const event: GanttEvent = { id: "m", title: "Close", start: at(2026, 0, 31), end: at(2026, 0, 31, 1), recurrence: "FREQ=MONTHLY;COUNT=2" };
		expect(starts(expandRecurrence(event, { start: at(2026, 0, 1), end: at(2026, 3, 1) }, { timeZone: UTC }))).toEqual([
			at(2026, 0, 31).toISOString(),
			at(2026, 1, 28).toISOString(),
		]);
	});

	it("refuses unimplemented filters loudly", (): void => {
		const event: GanttEvent = { ...DAILY, recurrence: { freq: "monthly", byMonthDay: [1] } };
		expect((): void => {
			expandRecurrence(event, january, { timeZone: UTC });
		}).toThrow("BYMONTHDAY");
		expect((): void => {
			expandRecurrence({ ...DAILY, recurrence: { freq: "daily", byWeekday: ["MO"] } }, january, { timeZone: UTC });
		}).toThrow("BYDAY outside FREQ=WEEKLY");
		expect((): void => {
			expandRecurrence({ ...DAILY, recurrence: { freq: "weekly", byWeekday: [{ day: "MO", ordinal: 1 }] } }, january, { timeZone: UTC });
		}).toThrow("BYDAY ordinal");
		expect((): void => {
			expandRecurrence({ ...DAILY, recurrence: { freq: "yearly", byMonth: [2] } }, january, { timeZone: UTC });
		}).toThrow("BYMONTH");
	});
});
