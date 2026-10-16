// @vitest-environment node
import { describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../../../lib/labels/en";
import { localeOptions, makeDefaultGanttFunctions, mergeGanttI18n } from "../gantt-i18n";

const EN = UI_KIT_LABELS_EN.gantt;

function at(year: number, monthIndex: number, day: number, hour = 0, minute = 0): Date {
	return new Date(year, monthIndex, day, hour, minute);
}

describe("mergeGanttI18n", (): void => {
	it("splits the labels family into labels + formats with bound functions", (): void => {
		const config = mergeGanttI18n(EN);
		expect(config.labels.today).toBe("Today");
		expect(config.formats.dayTitle).toBe(EN.formats.dayTitle);
		expect(
			config.functions.formatTitle("month", {
				date: at(2026, 2, 4),
				activeRange: { start: at(2026, 2, 1), end: at(2026, 3, 1) },
				visibleRange: { start: at(2026, 2, 1), end: at(2026, 3, 1) },
			}),
		).toBe("March 2026");
	});

	it("overrides individual keys, nested scales and formats, and rebinds the defaults", (): void => {
		const config = mergeGanttI18n(EN, { labels: { today: "Heute", continues: "weiter", scales: { day: "Tag" } }, formats: { monthTitle: "MM/yyyy" } });
		expect(config.labels.today).toBe("Heute");
		expect(config.labels.scales).toEqual({ ...EN.scales, day: "Tag" });
		expect(
			config.functions.formatTitle("month", {
				date: at(2026, 2, 4),
				activeRange: { start: at(2026, 2, 1), end: at(2026, 3, 1) },
				visibleRange: { start: at(2026, 2, 1), end: at(2026, 3, 1) },
			}),
		).toBe("03/2026");
		expect(config.functions.formatEventAriaLabel({ title: "A", timeLabel: "B", continues: true })).toBe("A, B, weiter");
	});

	it("lets explicit function overrides win", (): void => {
		const formatDayRange = (): string => "custom";
		expect(mergeGanttI18n(EN, { functions: { formatDayRange } }).functions.formatDayRange).toBe(formatDayRange);
	});
});

describe("default formatters", (): void => {
	const { functions } = mergeGanttI18n(EN);

	it("titles each scale", (): void => {
		const visibleRange = { start: at(2026, 0, 1), end: at(2027, 0, 1) };
		expect(functions.formatTitle("day", { date: at(2026, 2, 4), activeRange: visibleRange, visibleRange })).toBe("Wednesday, March 4, 2026");
		expect(functions.formatTitle("quarter", { date: at(2026, 2, 4), activeRange: visibleRange, visibleRange })).toBe("Q1 2026");
		expect(functions.formatTitle("year", { date: at(2026, 2, 4), activeRange: visibleRange, visibleRange })).toBe("2026");
		expect(functions.formatTitle("week", { date: at(2026, 2, 4), activeRange: { start: at(2026, 2, 1), end: at(2026, 2, 8) }, visibleRange })).toBe("March 1 – 7, 2026");
		expect(functions.formatTitle("week", { date: at(2026, 2, 4), activeRange: { start: at(2026, 2, 29), end: at(2026, 3, 5) }, visibleRange })).toBe("Mar 29 – Apr 4, 2026");
		expect(functions.formatTitle("week", { date: at(2026, 2, 4), activeRange: { start: at(2026, 11, 28), end: at(2027, 0, 4) }, visibleRange })).toBe(
			"Dec 28, 2026 – Jan 3, 2027",
		);
	});

	it("labels event times as date ranges, timed ranges and milestones", (): void => {
		expect(functions.formatEventTime(at(2026, 2, 4), at(2026, 2, 6), true)).toBe("Mar 4 – Mar 5, 2026");
		expect(functions.formatEventTime(at(2026, 2, 4), at(2026, 2, 5), true)).toBe("Mar 4, 2026");
		expect(functions.formatEventTime(at(2026, 11, 31), at(2027, 0, 2), true)).toBe("Dec 31, 2026 – Jan 1, 2027");
		expect(functions.formatEventTime(at(2026, 2, 4, 9), at(2026, 2, 4, 10, 30), false)).toBe("9:00 AM – 10:30 AM");
		expect(functions.formatEventTime(at(2026, 2, 4, 9), at(2026, 2, 5, 10), false)).toBe("Mar 4, 9:00 AM – Mar 5, 10:00 AM");
		expect(functions.formatEventTime(at(2026, 2, 4, 9), at(2026, 2, 4, 9), false)).toBe("Mar 4, 9:00 AM");
		expect(functions.formatEventTime(at(2026, 2, 4), at(2026, 2, 4), true)).toBe("Mar 4, 2026");
	});

	it("formats day ranges and aria labels", (): void => {
		expect(functions.formatDayRange({ start: at(2026, 2, 1), end: at(2026, 2, 8) })).toBe("Mar 1 – Mar 7");
		expect(functions.formatEventAriaLabel({ title: "A", timeLabel: "T", milestoneLabel: "milestone", rowTitle: "Row", progressLabel: "", continues: false })).toBe(
			"A, T, milestone, Row",
		);
	});

	it("binds to whatever labels it is given", (): void => {
		const custom = makeDefaultGanttFunctions({ labels: { ...EN, rangeSeparator: " to " }, formats: EN.formats });
		expect(custom.formatDayRange({ start: at(2026, 2, 1), end: at(2026, 2, 8) })).toBe("Mar 1 to Mar 7");
	});

	it("omits an absent locale for date-fns", (): void => {
		expect(localeOptions(undefined)).toEqual({});
	});
});
