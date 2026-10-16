import { describe, expect, it } from "vitest";

import {
	buildYearList,
	DEFAULT_DAY_DATE_FORMAT,
	FALLBACK_DAY_DATE_FORMATS,
	formatDateValue,
	getMonthPosition,
	isPeriodInRange,
	isYearInPeriodRange,
	parseDateSelectorInput,
	periodKey,
	periodName,
	resolveDayDateFormats,
	type DateSelectorPeriodNames,
	type ParseDateSelectorInputOptions,
} from "../value";

const NAMES: DateSelectorPeriodNames = {
	monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	quarters: ["Q1", "Q2", "Q3", "Q4"],
	halfYears: ["H1", "H2"],
};

const REFERENCE_DATE = new Date(2026, 9, 16);

describe("periodName", () => {
	it("returns the name at the index, or an empty string past the end", (): void => {
		expect(periodName(NAMES.quarters, 2)).toBe("Q3");
		expect(periodName(NAMES.quarters, 9)).toBe("");
	});
});

describe("periodKey / isPeriodInRange / isYearInPeriodRange", () => {
	it("orders points by year, then by period index", (): void => {
		expect(periodKey({ year: 2025, value: 11 })).toBeLessThan(periodKey({ year: 2026, value: 0 }));
	});

	it("treats both ends as inside the range and needs both ends", (): void => {
		const start = { year: 2025, value: 10 };
		const end = { year: 2026, value: 1 };
		expect(isPeriodInRange({ year: 2025, value: 10 }, start, end)).toBe(true);
		expect(isPeriodInRange({ year: 2026, value: 0 }, start, end)).toBe(true);
		expect(isPeriodInRange({ year: 2026, value: 2 }, start, end)).toBe(false);
		expect(isPeriodInRange({ year: 2026, value: 0 }, start, undefined)).toBe(false);
	});

	it("checks years against the years of the range", (): void => {
		const start = { year: 2020, value: 0 };
		const end = { year: 2022, value: 0 };
		expect(isYearInPeriodRange(2021, start, end)).toBe(true);
		expect(isYearInPeriodRange(2023, start, end)).toBe(false);
		expect(isYearInPeriodRange(2021, undefined, end)).toBe(false);
	});
});

describe("buildYearList", () => {
	it("lists minYear through maxYear when both are set", (): void => {
		expect(buildYearList({ currentYear: 2026, yearRange: 3, minYear: 2020, maxYear: 2023 })).toStrictEqual([2020, 2021, 2022, 2023]);
	});

	it("otherwise centres yearRange years on the current year", (): void => {
		expect(buildYearList({ currentYear: 2026, yearRange: 5 })).toStrictEqual([2024, 2025, 2026, 2027, 2028]);
	});

	it("returns no years for an inverted window", (): void => {
		expect(buildYearList({ currentYear: 2026, yearRange: 5, minYear: 2026, maxYear: 2020 })).toStrictEqual([]);
	});
});

describe("getMonthPosition", () => {
	it("places a month against today's month", (): void => {
		expect(getMonthPosition(new Date(2026, 9, 1), REFERENCE_DATE)).toBe("current");
		expect(getMonthPosition(new Date(2026, 11, 1), REFERENCE_DATE)).toBe("future");
		expect(getMonthPosition(new Date(2025, 0, 1), REFERENCE_DATE)).toBe("past");
		expect(getMonthPosition(undefined, REFERENCE_DATE)).toBe("current");
	});
});

describe("formatDateValue", () => {
	it("formats a day, and a day range, with the day format", (): void => {
		expect(formatDateValue({ period: "day", operator: "is", startDate: new Date(2026, 2, 14) }, NAMES)).toBe("03/14/2026");
		expect(formatDateValue({ period: "day", operator: "between", startDate: new Date(2026, 2, 14), endDate: new Date(2026, 2, 20) }, NAMES, "yyyy-MM-dd")).toBe(
			"2026-03-14 - 2026-03-20",
		);
	});

	it("formats months, quarters and half-years by name, single or ranged", (): void => {
		expect(formatDateValue({ period: "month", operator: "is", year: 2026, month: 2 }, NAMES)).toBe("Mar 2026");
		expect(formatDateValue({ period: "quarter", operator: "before", year: 2025, quarter: 3 }, NAMES)).toBe("Q4 2025");
		expect(formatDateValue({ period: "half-year", operator: "after", year: 2024, halfYear: 1 }, NAMES)).toBe("H2 2024");
		expect(formatDateValue({ period: "month", operator: "between", rangeStart: { year: 2025, value: 10 }, rangeEnd: { year: 2026, value: 1 } }, NAMES)).toBe(
			"Nov 2025 - Feb 2026",
		);
	});

	it("formats years, single or ranged", (): void => {
		expect(formatDateValue({ period: "year", operator: "is", year: 2024 }, NAMES)).toBe("2024");
		expect(formatDateValue({ period: "year", operator: "between", rangeStart: { year: 2020, value: 0 }, rangeEnd: { year: 2022, value: 0 } }, NAMES)).toBe("2020 - 2022");
	});

	it("is empty when nothing is selected", (): void => {
		expect(formatDateValue({ period: "day", operator: "is" }, NAMES)).toBe("");
		expect(formatDateValue({ period: "month", operator: "is", year: 2026 }, NAMES)).toBe("");
		expect(formatDateValue({ period: "year", operator: "is" }, NAMES)).toBe("");
	});
});

describe("resolveDayDateFormats", () => {
	it("puts the display format first, then the fallbacks, without duplicates", (): void => {
		expect(resolveDayDateFormats(DEFAULT_DAY_DATE_FORMAT, undefined)).toStrictEqual([DEFAULT_DAY_DATE_FORMAT, ...FALLBACK_DAY_DATE_FORMATS]);
		expect(resolveDayDateFormats("yyyy-MM-dd", undefined).filter((format: string): boolean => format === "yyyy-MM-dd")).toHaveLength(1);
	});

	it("uses the caller's formats instead of the fallbacks", (): void => {
		expect(resolveDayDateFormats("dd.MM.yyyy", ["d.M.yyyy"])).toStrictEqual(["dd.MM.yyyy", "d.M.yyyy"]);
	});
});

describe("parseDateSelectorInput", () => {
	const options: ParseDateSelectorInputOptions = { operator: "before", dateFormats: [DEFAULT_DAY_DATE_FORMAT, "yyyy-MM-dd"], referenceDate: REFERENCE_DATE };

	it("parses a four-digit year", (): void => {
		expect(parseDateSelectorInput(" 2025 ", options)).toStrictEqual({ period: "year", operator: "before", year: 2025 });
	});

	it("parses a quarter, with or without its year", (): void => {
		expect(parseDateSelectorInput("q1 2024", options)).toStrictEqual({ period: "quarter", operator: "before", year: 2024, quarter: 0 });
		expect(parseDateSelectorInput("Q3", options)).toStrictEqual({ period: "quarter", operator: "before", year: 2026, quarter: 2 });
	});

	it("parses a day in any of the formats", (): void => {
		expect(parseDateSelectorInput("03/14/2026", options)).toStrictEqual({ period: "day", operator: "before", startDate: new Date(2026, 2, 14) });
		expect(parseDateSelectorInput("2026-03-14", options)).toStrictEqual({ period: "day", operator: "before", startDate: new Date(2026, 2, 14) });
	});

	it("rejects empty text, unknown text and years outside the parse window", (): void => {
		expect(parseDateSelectorInput("   ", options)).toBeNull();
		expect(parseDateSelectorInput("soon", options)).toBeNull();
		expect(parseDateSelectorInput("1800", options)).toBeNull();
		expect(parseDateSelectorInput("03/14/2", options)).toBeNull();
	});
});
