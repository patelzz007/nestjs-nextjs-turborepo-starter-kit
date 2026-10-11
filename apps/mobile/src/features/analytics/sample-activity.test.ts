import { DAY_MS } from "@workspace/shared";

import { DAY_PART_HOURS, dayPartOf, weekdayOf } from "./activity-insights";
import { daysOf, sampleDay, spentOf, sumOf, visitsOf, type SampleDay, type SampleVisit } from "./sample-activity";

const FROM = Date.UTC(2026, 6, 1);
const TO = Date.UTC(2026, 9, 1);
const MINUTES_PER_HOUR = 60;

describe("sampleDay", () => {
	it("is the same day every time it is asked for", () => {
		expect(sampleDay(FROM)).toStrictEqual(sampleDay(FROM));
	});

	it("lists a day's visits in time order, inside the shopping hours", () => {
		daysOf(FROM, TO).forEach((day: SampleDay): void => {
			const minutes = day.visits.map((visit: SampleVisit): number => visit.minuteOfDay);
			expect(minutes).toStrictEqual([...minutes].sort((left: number, right: number): number => left - right));
			day.visits.forEach((visit: SampleVisit): void => {
				expect(visit.minuteOfDay).toBeGreaterThanOrEqual(DAY_PART_HOURS.morning.fromHour * MINUTES_PER_HOUR);
				expect(visit.minuteOfDay).toBeLessThan(DAY_PART_HOURS.evening.toHour * MINUTES_PER_HOUR);
			});
		});
	});

	it("only redeems rewards that were claimed, and counts both", () => {
		daysOf(FROM, TO).forEach((day: SampleDay): void => {
			expect(day.visits.every((visit: SampleVisit): boolean => !visit.redeemed || visit.claimed)).toBe(true);
			expect(day.claims).toBe(day.visits.filter((visit: SampleVisit): boolean => visit.claimed).length);
			expect(day.redemptions).toBe(day.visits.filter((visit: SampleVisit): boolean => visit.redeemed).length);
		});
	});

	it("is out more at weekends, and lunches out on weekdays", () => {
		const visits = visitsOf(daysOf(FROM, TO));
		const weekend = visits.filter((visit): boolean => ["saturday", "sunday"].includes(weekdayOf(visit.dayStartMs)));
		const weekdays = visits.filter((visit): boolean => !["saturday", "sunday"].includes(weekdayOf(visit.dayStartMs)));
		const WEEKEND_DAYS = 2;
		const WORKING_DAYS = 5;

		expect(weekend.length / WEEKEND_DAYS).toBeGreaterThan(weekdays.length / WORKING_DAYS);
		const middays = weekdays.filter((visit): boolean => dayPartOf(visit.minuteOfDay) === "midday").length;
		expect(middays / weekdays.length).toBeGreaterThan(0.3);
	});
});

describe("daysOf", () => {
	it("is every day of the range, one a day", () => {
		const days = daysOf(FROM, FROM + 3 * DAY_MS);

		expect(days.map((day: SampleDay): number => day.startMs)).toStrictEqual([FROM, FROM + DAY_MS, FROM + 2 * DAY_MS]);
		expect(daysOf(FROM, FROM)).toStrictEqual([]);
	});
});

describe("spentOf and visitsOf", () => {
	it("adds up a day's bills and dates every visit", () => {
		const days = daysOf(FROM, TO);
		const visits = visitsOf(days);

		expect(sumOf(days, spentOf)).toBe(sumOf(visits, (visit: SampleVisit): number => visit.billMinor));
		expect(visits.every((visit): boolean => visit.dayStartMs % DAY_MS === 0)).toBe(true);
	});
});
