import { DEFAULT_EVENT_CALENDAR_LABELS, dragSlotMinutes, eventToneClass, minuteToY, PHONE_CALENDAR_VIEWS, timeGridHours, yToMinute } from "../event-calendar";

const GRID = { startHour: 8, endHour: 20, hourHeight: 48 };

describe("the time grid's geometry", () => {
	it("places a minute of the day, clamped to the grid", () => {
		expect(minuteToY(8 * 60, GRID)).toBe(0);
		expect(minuteToY(9 * 60 + 30, GRID)).toBe(72);
		expect(minuteToY(6 * 60, GRID)).toBe(0);
		expect(minuteToY(22 * 60, GRID)).toBe(12 * 48);
	});

	it("reads the minute at a point, snapped down and clamped", () => {
		expect(yToMinute(72, GRID, 30)).toBe(9 * 60 + 30);
		expect(yToMinute(80, GRID, 30)).toBe(9 * 60 + 30);
		expect(yToMinute(-10, GRID, 15)).toBe(8 * 60);
		expect(yToMinute(10_000, GRID, 15)).toBe(20 * 60);
	});

	it("covers every slot a drag touches, in either direction, at least one snap long", () => {
		// 48 is 9:00; 110 is 10:17, inside the 10:00–10:30 slot.
		expect(dragSlotMinutes(48, 110, GRID, 30)).toEqual({ startMin: 9 * 60, endMin: 10 * 60 + 30 });
		expect(dragSlotMinutes(110, 48, GRID, 30)).toEqual({ startMin: 9 * 60, endMin: 10 * 60 + 30 });
		expect(dragSlotMinutes(48, 48, GRID, 30)).toEqual({ startMin: 9 * 60, endMin: 9 * 60 + 30 });
		expect(dragSlotMinutes(570, 600, GRID, 30).endMin).toBe(20 * 60);
	});

	it("lists the grid's hours", () => {
		expect(timeGridHours({ startHour: 9, endHour: 12, hourHeight: 48 })).toEqual([9, 10, 11]);
	});
});

describe("event tones", () => {
	it("fills an event by its tone, the primary colour by default", () => {
		expect(eventToneClass("teal")).toBe("bg-tone-teal");
		expect(eventToneClass("neutral")).toBe("bg-muted-foreground");
		expect(eventToneClass(undefined)).toBe("bg-primary");
	});
});

describe("the calendar's English copy", () => {
	it("pluralises and fills in its messages", () => {
		const { labels, viewNames } = DEFAULT_EVENT_CALENDAR_LABELS;
		expect(labels.events(1)).toBe("1 event");
		expect(labels.events(2)).toBe("2 events");
		expect(labels.more(3)).toBe("+3 more");
		expect(labels.moreCompact(3)).toBe("+3");
		expect(labels.week(12)).toBe("W12");
		expect(labels.timeFrom("9 AM")).toBe("From 9 AM");
		expect(labels.timeUntil("5 PM")).toBe("Until 5 PM");
		expect(labels.eventDetails("Standup")).toBe("Standup details");
		expect(labels.timeRange("9 AM", "10 AM")).toBe("9 AM – 10 AM");
		expect(labels.eventLabel("Standup", "9 AM")).toBe("Standup, 9 AM");
		expect(labels.eventAriaLabel("Trip", "Mon", null)).toBe("Trip, Mon");
		expect(labels.eventAriaLabel("Trip", "Mon", "continues")).toBe("Trip, Mon, continues");
		expect(labels.eventMoved("Standup", "10 AM")).toBe("Standup moved to 10 AM");
		expect(viewNames.days(1)).toBe("1 day");
		expect(viewNames.days(3)).toBe("3 days");
		expect(PHONE_CALENDAR_VIEWS).not.toContain("days");
	});
});
