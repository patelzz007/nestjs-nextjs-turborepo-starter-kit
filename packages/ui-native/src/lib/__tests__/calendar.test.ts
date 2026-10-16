import {
	addCalendarMonths,
	CALENDAR_MONTH_NUMBERS,
	calendarDayMsOf,
	calendarMonthOf,
	calendarYearsBetween,
	clampCalendarMonth,
	compareCalendarMonths,
	firstDayOf,
	isCalendarMonthWithin,
	monthWeeks,
	pickRangeDay,
	rangeDayRoleOf,
	toggleCalendarDay,
	type CalendarMonth,
	type DateRangeDraft,
} from "../calendar";

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

describe("months and years to jump to", () => {
	const first: CalendarMonth = { year: 2024, month: 3 };
	const last: CalendarMonth = { year: 2026, month: 10 };

	it("lists the twelve months, January first", () => {
		expect(CALENDAR_MONTH_NUMBERS).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	});

	it("knows a month inside the range, its ends included", () => {
		expect(isCalendarMonthWithin({ year: 2024, month: 3 }, first, last)).toBe(true);
		expect(isCalendarMonthWithin({ year: 2025, month: 1 }, first, last)).toBe(true);
		expect(isCalendarMonthWithin({ year: 2026, month: 10 }, first, last)).toBe(true);
		expect(isCalendarMonthWithin({ year: 2024, month: 2 }, first, last)).toBe(false);
		expect(isCalendarMonthWithin({ year: 2026, month: 11 }, first, last)).toBe(false);
	});

	it("moves a month outside the range to its nearest end, and leaves one inside it", () => {
		expect(clampCalendarMonth({ year: 2024, month: 1 }, first, last)).toStrictEqual(first);
		expect(clampCalendarMonth({ year: 2026, month: 12 }, first, last)).toStrictEqual(last);
		expect(clampCalendarMonth({ year: 2025, month: 6 }, first, last)).toStrictEqual({ year: 2025, month: 6 });
	});

	it("lists every year of the range, earliest first", () => {
		expect(calendarYearsBetween(first, last)).toStrictEqual([2024, 2025, 2026]);
		expect(calendarYearsBetween(last, last)).toStrictEqual([2026]);
	});

	it("lists no years for a range that ends before it starts", () => {
		expect(calendarYearsBetween(last, first)).toStrictEqual([]);
	});
});

describe("calendarDayMsOf", () => {
	it("is the day's UTC midnight", () => {
		expect(calendarDayMsOf("2026-09-04")).toBe(Date.UTC(2026, 8, 4));
	});
});

describe("toggleCalendarDay", () => {
	it("adds a day in date order, whatever order the days are tapped in", () => {
		const afterFirst = toggleCalendarDay([], "2026-10-03", null);
		const afterSecond = toggleCalendarDay(afterFirst, "2026-09-14", null);
		expect(toggleCalendarDay(afterSecond, "2026-09-04", null)).toStrictEqual(["2026-09-04", "2026-09-14", "2026-10-03"]);
	});

	it("removes a day that is already picked", () => {
		expect(toggleCalendarDay(["2026-09-04", "2026-09-14"], "2026-09-04", null)).toStrictEqual(["2026-09-14"]);
	});

	it("adds nothing once the most days are picked, but still removes one", () => {
		const full = ["2026-09-04", "2026-09-14"];
		expect(toggleCalendarDay(full, "2026-10-03", 2)).toStrictEqual(full);
		expect(toggleCalendarDay(full, "2026-09-14", 2)).toStrictEqual(["2026-09-04"]);
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
