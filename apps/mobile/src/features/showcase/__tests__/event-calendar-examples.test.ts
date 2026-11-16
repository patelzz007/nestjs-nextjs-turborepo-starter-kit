import { atHour, SAMPLE_CLOCK, SAMPLE_NOW, SAMPLE_WEEKDAY, sampleDay } from "../examples/event-calendar/event-calendar-sample";

describe("the EventCalendar examples' sample", () => {
	it("counts hours, fractions included, from the sample Sunday on this device", () => {
		expect(atHour(0, 0)).toEqual(new Date(2026, 5, 14));
		expect(atHour(SAMPLE_WEEKDAY, 10.5)).toEqual(new Date(2026, 5, 17, 10, 30));
		expect(sampleDay(1)).toEqual(new Date(2026, 5, 15));
	});

	it("runs on a fixed clock at 09:30 on the sample Wednesday", () => {
		expect(SAMPLE_NOW.getDay()).toBe(3);
		expect(SAMPLE_CLOCK.nowEpochMs()).toBe(new Date(2026, 5, 17, 9, 30).getTime());
	});
});
