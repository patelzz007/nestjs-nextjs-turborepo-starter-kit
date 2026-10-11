import { MAX_ANALYTICS_RANGE_DAYS } from "@workspace/shared";

import {
	ACTIVITY_RANGE_OPTIONS,
	ActivityRangeChoiceSchema,
	activityRangeOf,
	activityRangeOfDays,
	activityToday,
	choiceOf,
	customRangeIssueOf,
	DEFAULT_ACTIVITY_RANGE_PRESET,
	DEFAULT_ACTIVITY_SELECTION,
	earliestActivityDate,
	selectedActivityDays,
	selectedActivityRange,
	type ActivityRangeChoice,
	type ActivitySelection,
} from "./activity-range";

const TODAY = "2026-10-12";

describe("activityToday", () => {
	it("is the calendar day in UTC, the zone a customer's activity is bucketed in", () => {
		expect(activityToday(Date.UTC(2026, 9, 12, 23, 59))).toBe("2026-10-12");
		expect(activityToday(Date.UTC(2026, 9, 13, 0, 0))).toBe("2026-10-13");
	});
});

describe("activityRangeOf", () => {
	it("covers whole days ending with today, bucketed by day up to a month", () => {
		const range = activityRangeOf("last7Days", TODAY);

		expect(range.from).toBe(Date.UTC(2026, 9, 6));
		expect(range.to).toBe(Date.UTC(2026, 9, 13));
		expect(range.timeZone).toBe("UTC");
		expect(range.interval).toBe("day");
	});

	it("measures every change against the equally long period right before", () => {
		const range = activityRangeOf("last30Days", TODAY);

		expect(range.from).toBe(Date.UTC(2026, 8, 13));
		expect(range.previousTo).toBe(range.from);
		expect(range.previousFrom).toBe(Date.UTC(2026, 7, 14));
		expect(range.interval).toBe("day");
	});

	it("buckets 90 days by week", () => {
		const range = activityRangeOf("last90Days", TODAY);

		expect(range.from).toBe(Date.UTC(2026, 6, 15));
		expect(range.interval).toBe("week");
	});
});

describe("ACTIVITY_RANGE_OPTIONS", () => {
	it("offers every preset and custom dates once, in order, each with its full name for screen readers", () => {
		expect(ACTIVITY_RANGE_OPTIONS.map((option): ActivityRangeChoice => option.value)).toStrictEqual(ActivityRangeChoiceSchema.options);
		expect(ACTIVITY_RANGE_OPTIONS.map((option): string | undefined => option.accessibilityLabel)).toStrictEqual([
			"Last 7 days",
			"Last 30 days",
			"Last 90 days",
			"Custom dates",
		]);
	});

	it("starts on the last 30 days, the API's and the web's default", () => {
		expect(DEFAULT_ACTIVITY_RANGE_PRESET).toBe("last30Days");
	});
});

describe("activityRangeOfDays", () => {
	it("covers the first to the last day picked, both included", () => {
		const range = activityRangeOfDays("2026-09-01", "2026-09-15");

		expect(range.from).toBe(Date.UTC(2026, 8, 1));
		expect(range.to).toBe(Date.UTC(2026, 8, 16));
		expect(range.previousFrom).toBe(Date.UTC(2026, 7, 17));
		expect(range.interval).toBe("day");
	});

	it("covers a single day", () => {
		const range = activityRangeOfDays("2026-09-01", "2026-09-01");

		expect(range.to - range.from).toBe(Date.UTC(2026, 8, 2) - Date.UTC(2026, 8, 1));
	});

	it("buckets longer ranges by week, then by month, as the API does", () => {
		expect(activityRangeOfDays("2026-04-01", "2026-09-30").interval).toBe("week");
		expect(activityRangeOfDays("2025-10-13", "2026-10-12").interval).toBe("month");
	});
});

describe("selections", () => {
	const CUSTOM: ActivitySelection = { kind: "custom", fromDate: "2026-09-01", toDate: "2026-09-15" };

	it("start on the default preset", () => {
		expect(DEFAULT_ACTIVITY_SELECTION).toStrictEqual({ kind: "preset", preset: "last30Days" });
		expect(choiceOf(DEFAULT_ACTIVITY_SELECTION)).toBe("last30Days");
		expect(choiceOf(CUSTOM)).toBe("custom");
	});

	it("cover a preset's days or the days picked", () => {
		expect(selectedActivityRange(DEFAULT_ACTIVITY_SELECTION, TODAY)).toStrictEqual(activityRangeOf("last30Days", TODAY));
		expect(selectedActivityRange(CUSTOM, TODAY)).toStrictEqual(activityRangeOfDays("2026-09-01", "2026-09-15"));
		expect(selectedActivityDays(DEFAULT_ACTIVITY_SELECTION, TODAY)).toStrictEqual({ from: "2026-09-13", to: TODAY });
		expect(selectedActivityDays(CUSTOM, TODAY)).toStrictEqual({ from: "2026-09-01", to: "2026-09-15" });
	});
});

describe("customRangeIssueOf", () => {
	it("accepts a range in order, by today, within the history and the API's limit", () => {
		expect(customRangeIssueOf("2026-09-01", "2026-09-15", TODAY)).toBeNull();
		expect(customRangeIssueOf(TODAY, TODAY, TODAY)).toBeNull();
	});

	it("refuses a reversed, too long, future or too early range", () => {
		expect(customRangeIssueOf("2026-09-15", "2026-09-01", TODAY)).toBe("reversed");
		expect(customRangeIssueOf("2025-01-01", "2026-10-01", TODAY)).toBe("tooLong");
		expect(MAX_ANALYTICS_RANGE_DAYS).toBe(366);
		expect(customRangeIssueOf("2026-10-10", "2026-10-13", TODAY)).toBe("future");
		expect(customRangeIssueOf("2024-01-01", "2024-01-31", TODAY)).toBe("tooEarly");
		expect(customRangeIssueOf(earliestActivityDate(TODAY), earliestActivityDate(TODAY), TODAY)).toBeNull();
	});
});
