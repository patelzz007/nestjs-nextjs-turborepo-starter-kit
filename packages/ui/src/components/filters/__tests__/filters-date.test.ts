// @vitest-environment node
import { describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../../../lib/labels/en";
import { applyFilterRelative, formatFilterDate, isFilterTime, parseFilterDate, resolveFilterDate, toFilterDateValue } from "../filters-date";
import type { FilterDateValue } from "../filters-types";

/** Wednesday 14 August 2024, noon. */
const NOW = new Date(2024, 7, 14, 12, 0);
const LABELS = UI_KIT_LABELS_EN.filters;

function day(value: FilterDateValue | null): string {
	const resolved = value === null ? null : resolveFilterDate(value, NOW);
	return resolved === null ? "" : `${String(resolved.getFullYear())}-${String(resolved.getMonth() + 1)}-${String(resolved.getDate())}`;
}

describe("filters-date", () => {
	it("resolves relative offsets from the start of today", (): void => {
		expect(applyFilterRelative({ unit: "day", offset: 1 }, NOW).getDate()).toBe(15);
		expect(applyFilterRelative({ unit: "week", offset: -1 }, NOW).getDate()).toBe(7);
		expect(applyFilterRelative({ unit: "month", offset: 1 }, NOW).getMonth()).toBe(8);
		expect(applyFilterRelative({ unit: "year", offset: 1 }, NOW).getFullYear()).toBe(2025);
	});

	it("resolves absolute days and rejects bad ones", (): void => {
		expect(day({ date: "2024-01-02" })).toBe("2024-1-2");
		expect(resolveFilterDate({ date: "2024-13-40" }, NOW)).toBeNull();
		expect(resolveFilterDate(undefined, NOW)).toBeNull();
		expect(toFilterDateValue(NOW, "09:30")).toEqual({ date: "2024-08-14", time: "09:30" });
		expect(toFilterDateValue(NOW)).toEqual({ date: "2024-08-14" });
	});

	it.each<[string, string]>([
		["today", "2024-8-14"],
		["Tomorrow", "2024-8-15"],
		["yesterday", "2024-8-13"],
		["next week", "2024-8-21"],
		["in 3 days", "2024-8-17"],
		["2 weeks ago", "2024-7-31"],
		["friday", "2024-8-16"],
		["wednesday", "2024-8-21"],
		["last monday", "2024-8-12"],
		["2024-02-29", "2024-2-29"],
		["Aug 20", "2024-8-20"],
	])("parses %s", (input: string, expected: string): void => {
		expect(day(parseFilterDate(input, NOW))).toBe(expected);
	});

	it("keeps relative phrasing relative and rejects nonsense", (): void => {
		expect(parseFilterDate("in 3 days", NOW)).toEqual({ relative: { unit: "day", offset: 3 } });
		expect(parseFilterDate("someday", NOW)).toBeNull();
		expect(parseFilterDate("  ", NOW)).toBeNull();
	});

	it("formats through the labels, relative values as words", (): void => {
		expect(formatFilterDate({ relative: { unit: "day", offset: 0 } }, LABELS, NOW)).toBe("today");
		expect(formatFilterDate({ relative: { unit: "week", offset: 2 } }, LABELS, NOW)).toBe("in 2 weeks");
		expect(formatFilterDate({ relative: { unit: "month", offset: -1 } }, LABELS, NOW)).toBe("1 month ago");
		expect(formatFilterDate({ date: "2024-08-14", time: "10:00" }, LABELS, NOW)).toBe("Aug 14, 2024 10:00");
		expect(formatFilterDate(undefined, LABELS, NOW)).toBe("");
		expect(formatFilterDate({ relative: { unit: "day", offset: 0 } }, { relativeDate: (): string => "aujourd'hui" }, NOW)).toBe("aujourd'hui");
	});

	it("validates a time of day", (): void => {
		expect(isFilterTime("23:59")).toBe(true);
		expect(isFilterTime("24:00")).toBe(false);
	});
});
