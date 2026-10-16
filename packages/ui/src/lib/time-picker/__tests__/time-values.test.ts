import { describe, expect, it } from "vitest";

import {
	formatTimeValue,
	normalizeTyped,
	padSegment,
	parseTimeInput,
	parseTimeValue,
	periodOf,
	sameTime,
	toSeconds,
	toTwelveHour,
	type TimePickerPeriodLabels,
} from "./time-values";

const ENGLISH_PERIODS: TimePickerPeriodLabels = { am: "AM", pm: "PM" };
const KOREAN_PERIODS: TimePickerPeriodLabels = { am: "오전", pm: "오후" };

describe("parseTimeValue", () => {
	it("reads HH:mm and HH:mm:ss, dropping a fraction of a second", () => {
		expect(parseTimeValue("09:30")).toStrictEqual({ hour: 9, minute: 30, second: 0 });
		expect(parseTimeValue("9:05:07")).toStrictEqual({ hour: 9, minute: 5, second: 7 });
		expect(parseTimeValue(" 23:59:59.999 ")).toStrictEqual({ hour: 23, minute: 59, second: 59 });
	});

	it("reads anything else as no value", () => {
		expect(parseTimeValue("")).toBeNull();
		expect(parseTimeValue(null)).toBeNull();
		expect(parseTimeValue(undefined)).toBeNull();
		expect(parseTimeValue("24:00")).toBeNull();
		expect(parseTimeValue("12:60")).toBeNull();
		expect(parseTimeValue("12:30:60")).toBeNull();
		expect(parseTimeValue("noon")).toBeNull();
		expect(parseTimeValue("9:5")).toBeNull();
	});
});

describe("formatTimeValue", () => {
	it("writes two-digit segments, with seconds only at second granularity", () => {
		const time = { hour: 7, minute: 5, second: 9 };
		expect(formatTimeValue(time)).toBe("07:05");
		expect(formatTimeValue(time, "hour")).toBe("07:05");
		expect(formatTimeValue(time, "second")).toBe("07:05:09");
	});
});

describe("time helpers", () => {
	it("pads, counts seconds, names the period and converts to a 12-hour clock", () => {
		expect(padSegment(3)).toBe("03");
		expect(toSeconds({ hour: 1, minute: 1, second: 1 })).toBe(3661);
		expect(periodOf(11)).toBe("am");
		expect(periodOf(12)).toBe("pm");
		expect(toTwelveHour(0)).toBe(12);
		expect(toTwelveHour(13)).toBe(1);
		expect(toTwelveHour(12)).toBe(12);
	});

	it("compares times by value, and two empties as equal", () => {
		expect(sameTime({ hour: 1, minute: 0, second: 0 }, { hour: 1, minute: 0, second: 0 })).toBe(true);
		expect(sameTime({ hour: 1, minute: 0, second: 0 }, null)).toBe(false);
		expect(sameTime(null, null)).toBe(true);
	});

	it("folds full-width, Arabic-Indic and Persian digits and no-break spaces", () => {
		expect(normalizeTyped("１４：３０")).toBe("14:30");
		expect(normalizeTyped("١٤:٣٠")).toBe("14:30");
		expect(normalizeTyped("۰۹:۱۵")).toBe("09:15");
		expect(normalizeTyped("2:30 PM")).toBe("2:30 pm");
	});
});

describe("parseTimeInput", () => {
	it("reads separators and packed digits", () => {
		expect(parseTimeInput("9")).toStrictEqual({ hour: 9, minute: 0, second: 0 });
		expect(parseTimeInput("930")).toStrictEqual({ hour: 9, minute: 30, second: 0 });
		expect(parseTimeInput("0930")).toStrictEqual({ hour: 9, minute: 30, second: 0 });
		expect(parseTimeInput("093015")).toStrictEqual({ hour: 9, minute: 30, second: 15 });
		expect(parseTimeInput("14.30")).toStrictEqual({ hour: 14, minute: 30, second: 0 });
		expect(parseTimeInput("14h30")).toStrictEqual({ hour: 14, minute: 30, second: 0 });
	});

	it("reads a typed period suffix", () => {
		expect(parseTimeInput("2:30 pm")).toStrictEqual({ hour: 14, minute: 30, second: 0 });
		expect(parseTimeInput("2p")).toStrictEqual({ hour: 14, minute: 0, second: 0 });
		expect(parseTimeInput("12 a.m.")).toStrictEqual({ hour: 0, minute: 0, second: 0 });
		expect(parseTimeInput("12pm")).toStrictEqual({ hour: 12, minute: 0, second: 0 });
	});

	it("reads localized period words on either side", () => {
		expect(parseTimeInput("PM 2:30", { labels: ENGLISH_PERIODS })).toStrictEqual({ hour: 14, minute: 30, second: 0 });
		expect(parseTimeInput("오후 2:30", { labels: KOREAN_PERIODS })).toStrictEqual({ hour: 14, minute: 30, second: 0 });
		expect(parseTimeInput("2:30 오전", { labels: KOREAN_PERIODS })).toStrictEqual({ hour: 2, minute: 30, second: 0 });
	});

	it("gives a 12-hour time without a period the default one", () => {
		expect(parseTimeInput("2:30", { hourCycle: 12 })).toStrictEqual({ hour: 2, minute: 30, second: 0 });
		expect(parseTimeInput("2:30", { hourCycle: 12, period: "pm" })).toStrictEqual({ hour: 14, minute: 30, second: 0 });
		expect(parseTimeInput("14:30", { hourCycle: 12, period: "am" })).toStrictEqual({ hour: 14, minute: 30, second: 0 });
	});

	it("rejects text that is not a time", () => {
		expect(parseTimeInput("")).toBeNull();
		expect(parseTimeInput("lunch")).toBeNull();
		expect(parseTimeInput("25:00")).toBeNull();
		expect(parseTimeInput("9:5")).toBeNull();
		expect(parseTimeInput("9:60")).toBeNull();
		expect(parseTimeInput("1234567")).toBeNull();
		expect(parseTimeInput("1:02:03:04")).toBeNull();
		expect(parseTimeInput("13 pm")).toBeNull();
	});
});
