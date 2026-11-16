import {
	clearedDateSelectorValue,
	type DateSelectorValue,
	formatDateSelectorValue,
	formatSelectorDay,
	isPeriodInRange,
	nextPeriodRange,
	parseDateSelectorInput,
	type ParseDateSelectorInputOptions,
	pickedPeriodIndex,
	withPeriodPoint,
	yearsBetween,
} from "../date-selector";

const NAMES = {
	monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	quarters: ["Q1", "Q2", "Q3", "Q4"],
	halfYears: ["H1", "H2"],
};
const OPTIONS: ParseDateSelectorInputOptions = { operator: "is", dayFormats: ["dd/MM/yyyy"], today: "2026-11-15" };

describe("formatDateSelectorValue", () => {
	it("writes each period, a range, and nothing when nothing is picked", () => {
		expect(formatDateSelectorValue({ period: "day", operator: "is", startDate: "2026-03-14" }, NAMES)).toBe("14/03/2026");
		expect(formatDateSelectorValue({ period: "day", operator: "between", startDate: "2026-03-14", endDate: "2026-03-20" }, NAMES, "MM/dd/yyyy")).toBe(
			"03/14/2026 – 03/20/2026",
		);
		expect(formatDateSelectorValue({ period: "month", operator: "is", year: 2026, month: 10 }, NAMES)).toBe("Nov 2026");
		expect(formatDateSelectorValue({ period: "quarter", operator: "between", rangeStart: { year: 2026, value: 0 }, rangeEnd: { year: 2026, value: 2 } }, NAMES)).toBe(
			"Q1 2026 – Q3 2026",
		);
		expect(formatDateSelectorValue({ period: "half-year", operator: "is", year: 2025, halfYear: 1 }, NAMES)).toBe("H2 2025");
		expect(formatDateSelectorValue({ period: "year", operator: "before", year: 2024 }, NAMES)).toBe("2024");
		expect(formatDateSelectorValue({ period: "year", operator: "between", rangeStart: { year: 2020, value: 0 }, rangeEnd: { year: 2022, value: 0 } }, NAMES)).toBe(
			"2020 – 2022",
		);
		expect(formatDateSelectorValue({ period: "month", operator: "is" }, NAMES)).toBe("");
		expect(formatSelectorDay("2026-03-04", "dd.MM.yyyy")).toBe("04.03.2026");
		expect(formatSelectorDay("2026-03-04", "yyyy-MM-dd")).toBe("2026-03-04");
	});
});

describe("parseDateSelectorInput", () => {
	it("reads a year, a quarter (this year's when bare) and a day in the given format", () => {
		expect(parseDateSelectorInput("2025", OPTIONS)).toStrictEqual({ period: "year", operator: "is", year: 2025 });
		expect(parseDateSelectorInput("q2", OPTIONS)).toStrictEqual({ period: "quarter", operator: "is", year: 2026, quarter: 1 });
		expect(parseDateSelectorInput("Q1 2025", OPTIONS)).toStrictEqual({ period: "quarter", operator: "is", year: 2025, quarter: 0 });
		expect(parseDateSelectorInput("5/3/2026", OPTIONS)).toStrictEqual({ period: "day", operator: "is", startDate: "2026-03-05" });
	});

	it("turns down empty text, impossible days and far-off years", () => {
		expect(parseDateSelectorInput("  ", OPTIONS)).toBeNull();
		expect(parseDateSelectorInput("31/02/2026", OPTIONS)).toBeNull();
		expect(parseDateSelectorInput("1800", OPTIONS)).toBeNull();
		expect(parseDateSelectorInput("soon", OPTIONS)).toBeNull();
	});
});

describe("periods", () => {
	it("picks a point, builds a range in order, and clears", () => {
		const month: DateSelectorValue = { period: "month", operator: "is" };
		expect(withPeriodPoint(month, { year: 2026, value: 4 })).toStrictEqual({ period: "month", operator: "is", year: 2026, month: 4 });
		expect(pickedPeriodIndex({ period: "quarter", operator: "is", year: 2026, quarter: 2 })).toBe(2);
		expect(pickedPeriodIndex({ period: "year", operator: "is" })).toBeUndefined();
		const started = nextPeriodRange({ period: "quarter", operator: "between" }, { year: 2026, value: 2 });
		const ended = nextPeriodRange(started, { year: 2026, value: 0 });
		expect(ended.rangeStart).toStrictEqual({ year: 2026, value: 0 });
		expect(ended.rangeEnd).toStrictEqual({ year: 2026, value: 2 });
		expect(isPeriodInRange({ year: 2026, value: 1 }, ended.rangeStart, ended.rangeEnd)).toBe(true);
		expect(isPeriodInRange({ year: 2026, value: 1 }, ended.rangeStart, undefined)).toBe(false);
		expect(nextPeriodRange(ended, { year: 2027, value: 3 }).rangeEnd).toBeUndefined();
		expect(clearedDateSelectorValue(ended)).toStrictEqual({ period: "quarter", operator: "between" });
		expect(yearsBetween(2024, 2026)).toStrictEqual([2024, 2025, 2026]);
	});
});
