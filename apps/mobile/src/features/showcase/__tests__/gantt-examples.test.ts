import { addWorkdays, countWorkdays, nextWorkday, OFF_DAYS } from "../examples/gantt/gantt-8";
import { SAMPLE_CLOCK, SAMPLE_NOW, sampleBar, sampleDay } from "../examples/gantt/gantt-sample";

// The sample week: Sunday 14 June 2026; Friday the 19th is the holiday; the 20th and 21st are the weekend.
const WEDNESDAY = sampleDay(3);
const FRIDAY = sampleDay(5);
const SATURDAY = sampleDay(6);
const MONDAY = sampleDay(8);
const TUESDAY = sampleDay(9);

describe("the Gantt examples' sample", () => {
	it("counts days from the sample Sunday, on a fixed clock", () => {
		expect(sampleDay(0).getDay()).toBe(0);
		expect(sampleDay(0).getDate()).toBe(14);
		expect(SAMPLE_CLOCK.nowEpochMs()).toBe(SAMPLE_NOW.getTime());
		expect(sampleBar("api", "API", 1, 2, "teal", 50)).toEqual({
			id: "bar-api",
			title: "API",
			start: sampleDay(1),
			end: sampleDay(3),
			allDay: true,
			color: "teal",
			resourceId: "api",
			progress: 50,
		});
	});
});

describe("working days", () => {
	it("skips weekends and the holiday when counting", () => {
		expect(countWorkdays(WEDNESDAY, sampleDay(10), OFF_DAYS)).toBe(4);
		expect(countWorkdays(FRIDAY, MONDAY, OFF_DAYS)).toBe(0);
	});

	it("finds the next working day and adds working days from it", () => {
		expect(nextWorkday(SATURDAY, OFF_DAYS)).toEqual(MONDAY);
		expect(nextWorkday(FRIDAY, OFF_DAYS)).toEqual(MONDAY);
		expect(nextWorkday(WEDNESDAY, OFF_DAYS)).toEqual(WEDNESDAY);
		expect(addWorkdays(MONDAY, 1, OFF_DAYS)).toEqual(TUESDAY);
		expect(addWorkdays(WEDNESDAY, 4, OFF_DAYS)).toEqual(sampleDay(10));
	});
});
