import { greetingOf, partOfDayOf, type PartOfDay } from "../greeting";

/** A moment on the phone's clock, on an arbitrary day. */
function at(hours: number, minutes: number): Date {
	return new Date(2026, 10, 16, hours, minutes);
}

describe("partOfDayOf", () => {
	it.each<[string, Date, PartOfDay]>([
		["midnight", at(0, 0), "night"],
		["the last minute of night", at(4, 59), "night"],
		["the start of morning", at(5, 0), "morning"],
		["the last minute of morning", at(11, 59), "morning"],
		["noon", at(12, 0), "afternoon"],
		["the last minute of afternoon", at(16, 59), "afternoon"],
		["the start of evening", at(17, 0), "evening"],
		["the last minute of evening", at(20, 59), "evening"],
		["the start of night", at(21, 0), "night"],
		["the last minute of the day", at(23, 59), "night"],
	])("calls %s %s", (_moment: string, now: Date, part: PartOfDay) => {
		expect(partOfDayOf(now)).toBe(part);
	});
});

describe("greetingOf", () => {
	it.each<[Date, string]>([
		[at(8, 30), "Good morning, Alex Morgan"],
		[at(14, 0), "Good afternoon, Alex Morgan"],
		[at(19, 15), "Good evening, Alex Morgan"],
		[at(23, 0), "Good night, Alex Morgan"],
	])("greets the person signed in by name for the time of day", (now: Date, greeting: string) => {
		expect(greetingOf("Alex Morgan", now)).toBe(greeting);
	});
});
