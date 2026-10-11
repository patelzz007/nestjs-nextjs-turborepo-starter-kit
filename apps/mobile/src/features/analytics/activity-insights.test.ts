import { DAY_PART_HOURS, DayPartSchema, dayPartOf, weekdayOf, type DayPart } from "./activity-insights";

const MINUTES_PER_HOUR = 60;

describe("dayPartOf", () => {
	it("puts a time in the part of the day whose hours hold it", () => {
		expect(dayPartOf(8 * MINUTES_PER_HOUR)).toBe("morning");
		expect(dayPartOf(11 * MINUTES_PER_HOUR)).toBe("midday");
		expect(dayPartOf(16 * MINUTES_PER_HOUR + 59)).toBe("afternoon");
		expect(dayPartOf(19 * MINUTES_PER_HOUR)).toBe("evening");
	});

	it("counts the small hours as morning and late night as evening", () => {
		expect(dayPartOf(2 * MINUTES_PER_HOUR)).toBe("morning");
		expect(dayPartOf(23 * MINUTES_PER_HOUR)).toBe("evening");
	});

	it("has parts that follow on from each other without a gap", () => {
		const parts = DayPartSchema.options;
		parts.slice(1).forEach((part: DayPart, index: number): void => {
			const before = parts.at(index) ?? part;
			expect(DAY_PART_HOURS[part].fromHour).toBe(DAY_PART_HOURS[before].toHour);
		});
	});
});

describe("weekdayOf", () => {
	it("names the UTC weekday, the week starting on Monday", () => {
		expect(weekdayOf(Date.UTC(2026, 9, 12))).toBe("monday");
		expect(weekdayOf(Date.UTC(2026, 9, 17, 23, 59))).toBe("saturday");
		expect(weekdayOf(Date.UTC(2026, 9, 18))).toBe("sunday");
	});
});
