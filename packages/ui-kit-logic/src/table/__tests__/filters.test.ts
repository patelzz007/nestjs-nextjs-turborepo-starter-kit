import { describe, expect, it } from "vitest";

import { dataTableDateValueToEpochMs, dataTableDayBounds, isDataTableDateRange, isWithinDataTableDateRange } from "../filters";

const NOV_19_NOON_UTC = Date.UTC(2026, 10, 19, 12);
const ONE_DAY_MS = 86_400_000;

describe("isDataTableDateRange", () => {
	it("tells a range from a chosen option, a list of options and no value", () => {
		expect(isDataTableDateRange({ from: "2026-11-01", to: null })).toBe(true);
		expect(isDataTableDateRange("done")).toBe(false);
		expect(isDataTableDateRange(["done", "open"])).toBe(false);
		expect(isDataTableDateRange(null)).toBe(false);
		expect(isDataTableDateRange(undefined)).toBe(false);
	});
});

describe("dataTableDateValueToEpochMs", () => {
	it("reads epoch milliseconds, a Date and an ISO string", () => {
		expect(dataTableDateValueToEpochMs(NOV_19_NOON_UTC)).toBe(NOV_19_NOON_UTC);
		expect(dataTableDateValueToEpochMs(new Date(NOV_19_NOON_UTC))).toBe(NOV_19_NOON_UTC);
		expect(dataTableDateValueToEpochMs("2026-11-19T12:00:00.000Z")).toBe(NOV_19_NOON_UTC);
	});

	it("returns null for text that is not a date, and for an invalid Date", () => {
		expect(dataTableDateValueToEpochMs("next Tuesday-ish")).toBeNull();
		expect(dataTableDateValueToEpochMs(new Date(Number.NaN))).toBeNull();
	});
});

describe("dataTableDayBounds", () => {
	it("gives a UTC day's first instant and the next day's", () => {
		const bounds = dataTableDayBounds("2026-11-19", "utc");
		expect(bounds).toEqual({ startMs: Date.UTC(2026, 10, 19), endMs: Date.UTC(2026, 10, 20) });
	});

	it("gives a local day's first instant and the next day's", () => {
		const bounds = dataTableDayBounds("2026-11-19", "local");
		expect(bounds).toEqual({ startMs: new Date(2026, 10, 19).getTime(), endMs: new Date(2026, 10, 20).getTime() });
	});

	it("rolls over the end of a month and of a year", () => {
		expect(dataTableDayBounds("2026-12-31", "utc")?.endMs).toBe(Date.UTC(2027, 0, 1));
	});

	it("returns null for text that is not a day", () => {
		expect(dataTableDayBounds("19/11/2026", "utc")).toBeNull();
		expect(dataTableDayBounds("", "local")).toBeNull();
	});
});

describe("isWithinDataTableDateRange", () => {
	it("includes both end days in full", () => {
		const range = { from: "2026-11-19", to: "2026-11-20" };
		expect(isWithinDataTableDateRange(Date.UTC(2026, 10, 19), range, "utc")).toBe(true);
		expect(isWithinDataTableDateRange(Date.UTC(2026, 10, 20, 23, 59, 59, 999), range, "utc")).toBe(true);
		expect(isWithinDataTableDateRange(Date.UTC(2026, 10, 19) - 1, range, "utc")).toBe(false);
		expect(isWithinDataTableDateRange(Date.UTC(2026, 10, 21), range, "utc")).toBe(false);
	});

	it("treats a null end as open", () => {
		expect(isWithinDataTableDateRange(NOV_19_NOON_UTC + ONE_DAY_MS * 400, { from: "2026-11-19", to: null }, "utc")).toBe(true);
		expect(isWithinDataTableDateRange(NOV_19_NOON_UTC - ONE_DAY_MS, { from: "2026-11-19", to: null }, "utc")).toBe(false);
		expect(isWithinDataTableDateRange(NOV_19_NOON_UTC - ONE_DAY_MS * 400, { from: null, to: "2026-11-19" }, "utc")).toBe(true);
		expect(isWithinDataTableDateRange(NOV_19_NOON_UTC + ONE_DAY_MS, { from: null, to: "2026-11-19" }, "utc")).toBe(false);
	});

	it("passes everything through a range that is open at both ends, a cell with no date included", () => {
		expect(isWithinDataTableDateRange(null, { from: null, to: null })).toBe(true);
		expect(isWithinDataTableDateRange("not a date", { from: null, to: null })).toBe(true);
		// A bound that is not a day is open too.
		expect(isWithinDataTableDateRange(NOV_19_NOON_UTC, { from: "soon", to: null })).toBe(true);
	});

	it("refuses a cell with no date, or text that is not one, once the range has a bound", () => {
		expect(isWithinDataTableDateRange(null, { from: "2026-11-19", to: null }, "utc")).toBe(false);
		expect(isWithinDataTableDateRange("not a date", { from: "2026-11-19", to: null }, "utc")).toBe(false);
	});

	it("reads the reader's own calendar by default", () => {
		const localNoon = new Date(2026, 10, 19, 12).getTime();
		expect(isWithinDataTableDateRange(localNoon, { from: "2026-11-19", to: "2026-11-19" })).toBe(true);
		expect(isWithinDataTableDateRange(new Date(2026, 10, 20, 0, 0, 0, 0), { from: "2026-11-19", to: "2026-11-19" })).toBe(false);
	});

	it("accepts a Date and an ISO string", () => {
		const range = { from: "2026-11-19", to: "2026-11-19" };
		expect(isWithinDataTableDateRange(new Date(NOV_19_NOON_UTC), range, "utc")).toBe(true);
		expect(isWithinDataTableDateRange("2026-11-19T12:00:00.000Z", range, "utc")).toBe(true);
	});
});
