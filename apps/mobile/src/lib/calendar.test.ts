import { addCalendarMonths, calendarMonthOf, compareCalendarMonths, firstDayOf, monthWeeks, pickRangeDay, rangeDayRoleOf, type DateRangeDraft } from "./calendar";

describe("calendar months", () => {
	it("finds a date's month and steps across years", () => {
		expect(calendarMonthOf("2026-10-12")).toStrictEqual({ year: 2026, month: 10 });
		expect(addCalendarMonths({ year: 2026, month: 11 }, 2)).toStrictEqual({ year: 2027, month: 1 });
		expect(addCalendarMonths({ year: 2026, month: 1 }, -1)).toStrictEqual({ year: 2025, month: 12 });
		expect(firstDayOf({ year: 2026, month: 2 })).toBe("2026-02-01");
	});

	it("orders months", () => {
		expect(compareCalendarMonths({ year: 2026, month: 3 }, { year: 2026, month: 5 })).toBeLessThan(0);
		expect(compareCalendarMonths({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(0);
		expect(compareCalendarMonths({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBe(0);
	});
});

describe("monthWeeks", () => {
	it("lays the month out in Monday-first weeks, blank before the 1st and after the last day", () => {
		// 1 Oct 2026 is a Thursday; 31 Oct a Saturday.
		const weeks = monthWeeks({ year: 2026, month: 10 });
		const [first] = weeks;
		const last = weeks.at(-1);

		expect(weeks).toHaveLength(5);
		expect(first).toStrictEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
		expect(last).toStrictEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
	});

	it("needs no blanks for a month that starts on a Monday and ends on a Sunday", () => {
		// February 2027: Monday 1st to Sunday 28th.
		const weeks = monthWeeks({ year: 2027, month: 2 });

		expect(weeks).toHaveLength(4);
		expect(weeks.flat().every((day): boolean => day !== null)).toBe(true);
	});
});

describe("pickRangeDay", () => {
	const EMPTY: DateRangeDraft = { from: null, to: null };

	it("starts with the first tap and ends with the next", () => {
		const started = pickRangeDay(EMPTY, "2026-10-03");

		expect(started).toStrictEqual({ from: "2026-10-03", to: null });
		expect(pickRangeDay(started, "2026-10-09")).toStrictEqual({ from: "2026-10-03", to: "2026-10-09" });
	});

	it("makes a one-day range from two taps on the same day", () => {
		expect(pickRangeDay({ from: "2026-10-03", to: null }, "2026-10-03")).toStrictEqual({ from: "2026-10-03", to: "2026-10-03" });
	});

	it("starts again from a day before the start, or after a complete range", () => {
		expect(pickRangeDay({ from: "2026-10-03", to: null }, "2026-10-01")).toStrictEqual({ from: "2026-10-01", to: null });
		expect(pickRangeDay({ from: "2026-10-03", to: "2026-10-09" }, "2026-10-20")).toStrictEqual({ from: "2026-10-20", to: null });
	});
});

describe("rangeDayRoleOf", () => {
	it("marks the ends and the days between them", () => {
		const draft: DateRangeDraft = { from: "2026-10-03", to: "2026-10-09" };

		expect(rangeDayRoleOf(draft, "2026-10-03")).toBe("start");
		expect(rangeDayRoleOf(draft, "2026-10-05")).toBe("inside");
		expect(rangeDayRoleOf(draft, "2026-10-09")).toBe("end");
		expect(rangeDayRoleOf(draft, "2026-10-10")).toBe("none");
	});

	it("marks a lone start, or a one-day range, as single", () => {
		expect(rangeDayRoleOf({ from: "2026-10-03", to: null }, "2026-10-03")).toBe("single");
		expect(rangeDayRoleOf({ from: "2026-10-03", to: "2026-10-03" }, "2026-10-03")).toBe("single");
		expect(rangeDayRoleOf({ from: null, to: null }, "2026-10-03")).toBe("none");
	});
});
