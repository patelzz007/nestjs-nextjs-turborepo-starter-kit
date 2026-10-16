import { describe, expect, it } from "vitest";

import {
	buildTimeGrid,
	firstEnabledTime,
	floorIndex,
	gridSize,
	hasEnabled,
	isTimeEnabled,
	lastEnabledTime,
	nearestEnabled,
	spanInWindow,
	stepEnabled,
	stepValues,
	timeAt,
	unitFilter,
	walkEnabled,
	withUnit,
	type TimeGrid,
} from "./time-grid";
import type { TimePickerTime } from "./time-values";

function at(hour: number, minute = 0, second = 0): TimePickerTime {
	return { hour, minute, second };
}

const QUARTER_HOURS: TimeGrid = buildTimeGrid({ granularity: "minute", minuteStep: 15 });
const OFFICE_HOURS: TimeGrid = buildTimeGrid({ granularity: "minute", minuteStep: 30, min: "09:00", max: "17:00" });
const NIGHT_SHIFT: TimeGrid = buildTimeGrid({ granularity: "hour", min: "22:00", max: "02:00" });

describe("stepValues", () => {
	it("lists step-aligned values below the limit, treating a bad step as 1", () => {
		expect(stepValues(15, 60)).toStrictEqual([0, 15, 30, 45]);
		expect(stepValues(undefined, 3)).toStrictEqual([0, 1, 2]);
		expect(stepValues(0, 3)).toStrictEqual([0, 1, 2]);
		expect(stepValues(Number.POSITIVE_INFINITY, 60)).toStrictEqual([0]);
	});
});

describe("buildTimeGrid", () => {
	it("keeps only the columns the granularity needs, and parses the bounds", () => {
		const grid = buildTimeGrid({ granularity: "hour", hourStep: 6, min: "06:00" });
		expect(grid.hours).toStrictEqual([0, 6, 12, 18]);
		expect(grid.minutes).toStrictEqual([0]);
		expect(grid.seconds).toStrictEqual([0]);
		expect(grid.min).toBe(21_600);
		expect(grid.max).toBeNull();
		expect(gridSize(QUARTER_HOURS)).toBe(96);
	});
});

describe("grid indexing", () => {
	it("walks times by index, second fastest, and floors a time to the grid", () => {
		expect(timeAt(QUARTER_HOURS, 5)).toStrictEqual(at(1, 15));
		expect(floorIndex(QUARTER_HOURS, 3_600 + 20 * 60)).toBe(5);
	});
});

describe("windows", () => {
	it("supports open, closed and overnight windows", () => {
		expect(spanInWindow(QUARTER_HOURS, 0, 0)).toBe(true);
		expect(isTimeEnabled(OFFICE_HOURS, at(8, 30))).toBe(false);
		expect(isTimeEnabled(OFFICE_HOURS, at(17))).toBe(true);
		expect(isTimeEnabled(NIGHT_SHIFT, at(23))).toBe(true);
		expect(isTimeEnabled(NIGHT_SHIFT, at(1))).toBe(true);
		expect(isTimeEnabled(NIGHT_SHIFT, at(12))).toBe(false);
	});

	it("honours the per-time predicate with the value format", () => {
		const lunchless = buildTimeGrid({ granularity: "minute", minuteStep: 30, isTimeDisabled: (value: string): boolean => value === "12:00" });
		expect(isTimeEnabled(lunchless, at(12))).toBe(false);
		expect(isTimeEnabled(lunchless, at(12, 30))).toBe(true);
	});

	it("tells whether any enabled time matches a filter", () => {
		expect(hasEnabled(OFFICE_HOURS, { hour: 8 })).toBe(false);
		expect(hasEnabled(OFFICE_HOURS, { hour: 17, minute: 30 })).toBe(false);
		expect(hasEnabled(OFFICE_HOURS, { period: "pm" })).toBe(true);
		expect(hasEnabled(NIGHT_SHIFT, { period: "am" })).toBe(true);
	});
});

describe("searches", () => {
	it("finds the nearest enabled time, ties going earlier", () => {
		expect(nearestEnabled(QUARTER_HOURS, at(9, 7))).toStrictEqual(at(9));
		expect(nearestEnabled(QUARTER_HOURS, at(9, 8))).toStrictEqual(at(9, 15));
		expect(nearestEnabled(OFFICE_HOURS, at(6))).toStrictEqual(at(9));
		expect(nearestEnabled(OFFICE_HOURS, at(9), { period: "pm" })).toStrictEqual(at(12));
	});

	it("walks and steps, wrapping round the day", () => {
		expect(walkEnabled(OFFICE_HOURS, 0, 1, false)).toStrictEqual(at(9));
		expect(walkEnabled(OFFICE_HOURS, gridSize(OFFICE_HOURS) - 1, 1, false)).toBeNull();
		expect(stepEnabled(OFFICE_HOURS, at(17), 1)).toStrictEqual(at(9));
		expect(stepEnabled(OFFICE_HOURS, at(9), -1)).toStrictEqual(at(17));
		expect(stepEnabled(QUARTER_HOURS, at(9, 10), -1)).toStrictEqual(at(9));
	});

	it("starts the day at the minimum, so a night shift starts at 22:00", () => {
		expect(firstEnabledTime(QUARTER_HOURS)).toStrictEqual(at(0));
		expect(firstEnabledTime(NIGHT_SHIFT)).toStrictEqual(at(22));
		expect(lastEnabledTime(OFFICE_HOURS)).toStrictEqual(at(17));
	});
});

describe("unit helpers", () => {
	it("replaces one unit and filters on one unit", () => {
		expect(withUnit(at(1, 2, 3), "minute", 30)).toStrictEqual(at(1, 30, 3));
		expect(withUnit(at(1, 2, 3), "hour", 9)).toStrictEqual(at(9, 2, 3));
		expect(withUnit(at(1, 2, 3), "second", 0)).toStrictEqual(at(1, 2, 0));
		expect(unitFilter("hour", 4)).toStrictEqual({ hour: 4 });
		expect(unitFilter("minute", 4)).toStrictEqual({ minute: 4 });
		expect(unitFilter("second", 4)).toStrictEqual({ second: 4 });
	});
});
