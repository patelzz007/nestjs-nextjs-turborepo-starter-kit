// @vitest-environment node
import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../../lib/labels/en";
import { getViewName, makeDefaultFunctions, mergeEventCalendarI18n } from "./event-calendar-i18n";

const LABELS = UI_KIT_LABELS_EN.eventCalendar;

function zoned(iso: string): TZDate {
	return new TZDate(new Date(iso).getTime(), "UTC");
}

describe("event calendar copy", () => {
	it("formats single-pattern and smart range titles", (): void => {
		const { formatTitle } = makeDefaultFunctions(LABELS);
		const sameMonth = { start: zoned("2026-03-09T00:00:00Z"), end: zoned("2026-03-16T00:00:00Z") };
		const crossMonth = { start: zoned("2026-03-30T00:00:00Z"), end: zoned("2026-04-06T00:00:00Z") };
		const crossYear = { start: zoned("2026-12-28T00:00:00Z"), end: zoned("2027-01-04T00:00:00Z") };
		const date = zoned("2026-03-15T10:00:00Z");
		expect(formatTitle("month", { date, activeRange: sameMonth, visibleRange: sameMonth })).toBe("March 2026");
		expect(formatTitle("day", { date, activeRange: sameMonth, visibleRange: sameMonth })).toBe("Sunday, March 15, 2026");
		expect(formatTitle("resource", { date, activeRange: sameMonth, visibleRange: sameMonth })).toBe("Sunday, March 15, 2026");
		expect(formatTitle("week", { date, activeRange: sameMonth, visibleRange: sameMonth })).toBe("March 9 – 15, 2026");
		expect(formatTitle("days", { date, activeRange: crossMonth, visibleRange: crossMonth })).toBe("Mar 30 – Apr 5, 2026");
		expect(formatTitle("agenda", { date, activeRange: crossYear, visibleRange: crossYear })).toBe("Dec 28, 2026 – Jan 3, 2027");
	});

	it("formats event times: all-day, same-day and multi-day", (): void => {
		const { formatEventTime, formatDayRange } = makeDefaultFunctions(LABELS);
		expect(formatEventTime(zoned("2026-03-16T09:00:00Z"), zoned("2026-03-16T10:30:00Z"), false)).toBe("9:00 AM – 10:30 AM");
		expect(formatEventTime(zoned("2026-03-16T14:00:00Z"), zoned("2026-03-17T00:00:00Z"), false)).toBe("2:00 PM – 12:00 AM");
		expect(formatEventTime(zoned("2026-03-16T14:00:00Z"), zoned("2026-03-17T09:00:00Z"), false)).toBe("Mar 16, 2:00 PM – Mar 17, 9:00 AM");
		expect(formatEventTime(zoned("2026-03-16T00:00:00Z"), zoned("2026-03-17T00:00:00Z"), true)).toBe("All day");
		expect(formatDayRange({ start: zoned("2026-03-16T00:00:00Z"), end: zoned("2026-03-19T00:00:00Z") })).toBe("Mar 16 – Mar 18");
	});

	it("composes chip labels from the label family", (): void => {
		const functions = makeDefaultFunctions(LABELS);
		expect(functions.formatEventLabel("Standup", "9:00 AM")).toBe("Standup, 9:00 AM");
		expect(functions.formatEventAriaLabel("Offsite", "All day", true)).toBe("Offsite, All day, continues");
		expect(functions.formatEventAriaLabel("Offsite", "All day", false)).toBe("Offsite, All day");
	});

	it("merges overrides per section and re-binds the default formatters", (): void => {
		const merged = mergeEventCalendarI18n(LABELS, { labels: { allDay: "Todo el día" }, formats: { monthTitle: "yyyy/MM" } });
		expect(merged.labels.allDay).toBe("Todo el día");
		expect(merged.labels.today).toBe("Today");
		expect(merged.functions.formatEventTime(zoned("2026-03-16T00:00:00Z"), zoned("2026-03-17T00:00:00Z"), true)).toBe("Todo el día");
		const range = { start: zoned("2026-03-01T00:00:00Z"), end: zoned("2026-04-01T00:00:00Z") };
		expect(merged.functions.formatTitle("month", { date: zoned("2026-03-15T00:00:00Z"), activeRange: range, visibleRange: range })).toBe("2026/03");
	});

	it("lets explicit function overrides win and returns the base untouched without overrides", (): void => {
		const merged = mergeEventCalendarI18n(LABELS, { functions: { formatEventLabel: (title: string): string => `[${title}]` } });
		expect(merged.functions.formatEventLabel("A", "B")).toBe("[A]");
		expect(mergeEventCalendarI18n(LABELS).labels).toBe(LABELS.labels);
	});

	it("names views, the N-days view by its count", (): void => {
		expect(getViewName(LABELS.viewNames, "days", 4)).toBe("4 days");
		expect(getViewName(LABELS.viewNames, "days", 1)).toBe("1 day");
		expect(getViewName(LABELS.viewNames, "agenda", 4)).toBe("Agenda");
	});
});
