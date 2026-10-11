// The date ranges the Analytics screen offers, and the period each one covers.
// The same presets, custom-range rules and days as the web's "My Activity"
// dashboard (packages/client lib/analytics/analytics-range.ts, which the
// mobile app may not import): whole calendar days ending on the chosen last
// day, in UTC — the zone the API cuts a customer's buckets in — with the
// bucket width the API derives from the length (day up to 31 days, week up
// to 183, then month).

import {
	addLocalDays,
	ANALYTICS_RANGE_TOO_LONG_MESSAGE,
	defaultAnalyticsInterval,
	EpochMsSchema,
	inclusiveLocalDayCount,
	localDateInTimeZone,
	MAX_ANALYTICS_RANGE_DAYS,
	previousAnalyticsRange,
	startOfLocalDateInTimeZone,
	UTC_TIME_ZONE,
	type AnalyticsReportRange,
	type LocalDate,
	type ToDiscoUnion,
} from "@workspace/shared";
import { z } from "zod";

import type { SegmentedOption } from "../../components/segmented-control";

/** What the range control offers: the presets, named as on the web, and a custom start and end. */
export const ActivityRangeChoiceSchema = z.enum(["last7Days", "last30Days", "last90Days", "custom"]);

export type ActivityRangeChoice = z.output<typeof ActivityRangeChoiceSchema>;

/** The presets: every choice computed from "today". */
export const ActivityRangePresetSchema = ActivityRangeChoiceSchema.exclude(["custom"]);

export type ActivityRangePreset = z.output<typeof ActivityRangePresetSchema>;

/** Matches the API's and the web's default (the last 30 days). */
export const DEFAULT_ACTIVITY_RANGE_PRESET: ActivityRangePreset = "last30Days";

/** Days each preset covers, today included. */
export const ACTIVITY_RANGE_DAYS: Readonly<Record<ActivityRangePreset, number>> = {
	last7Days: 7,
	last30Days: 30,
	last90Days: 90,
};

/** The range control's segments: shorthand on screen, the full name for screen readers. */
export const ACTIVITY_RANGE_OPTIONS: readonly SegmentedOption<ActivityRangeChoice>[] = [
	{ value: "last7Days", label: "7D", accessibilityLabel: "Last 7 days" },
	{ value: "last30Days", label: "30D", accessibilityLabel: "Last 30 days" },
	{ value: "last90Days", label: "90D", accessibilityLabel: "Last 90 days" },
	{ value: "custom", label: "Custom", accessibilityLabel: "Custom dates" },
];

/** How far back a custom range may start: two years of history. */
export const ACTIVITY_HISTORY_DAYS = 730;

/** The range on screen: a preset, or the first and last day picked (both included). */
export type ActivitySelection = ToDiscoUnion<
	{
		preset: { readonly preset: ActivityRangePreset };
		custom: { readonly fromDate: LocalDate; readonly toDate: LocalDate };
	},
	"kind"
>;

export const DEFAULT_ACTIVITY_SELECTION: ActivitySelection = { kind: "preset", preset: DEFAULT_ACTIVITY_RANGE_PRESET };

/** The control's segment for a selection. */
export function choiceOf(selection: ActivitySelection): ActivityRangeChoice {
	return selection.kind === "preset" ? selection.preset : "custom";
}

/** The zone a customer's activity is bucketed in. */
export const ACTIVITY_TIME_ZONE = UTC_TIME_ZONE;

/** "Today" in the activity's zone. */
export function activityToday(nowMs: number): LocalDate {
	return localDateInTimeZone(nowMs, ACTIVITY_TIME_ZONE);
}

/** The earliest day a custom range may start on. */
export function earliestActivityDate(today: LocalDate): LocalDate {
	return addLocalDays(today, -ACTIVITY_HISTORY_DAYS);
}

/**
 * The period from the start of `fromDate` to the end of `toDate` (exclusive),
 * its bucket width, and the equally long period before it that every change
 * is measured against.
 */
export function activityRangeOfDays(fromDate: LocalDate, toDate: LocalDate): AnalyticsReportRange {
	const from = startOfLocalDateInTimeZone(fromDate, ACTIVITY_TIME_ZONE);
	const to = startOfLocalDateInTimeZone(addLocalDays(toDate, 1), ACTIVITY_TIME_ZONE);
	const previous = previousAnalyticsRange({ fromMs: from, toMs: to });
	return {
		from: EpochMsSchema.parse(from),
		to: EpochMsSchema.parse(to),
		timeZone: ACTIVITY_TIME_ZONE,
		interval: defaultAnalyticsInterval(from, to),
		previousFrom: EpochMsSchema.parse(previous.fromMs),
		previousTo: EpochMsSchema.parse(previous.toMs),
	};
}

/** The period a preset covers on `today`: its last N days, today included. */
export function activityRangeOf(preset: ActivityRangePreset, today: LocalDate): AnalyticsReportRange {
	return activityRangeOfDays(addLocalDays(today, 1 - ACTIVITY_RANGE_DAYS[preset]), today);
}

/** The period a selection covers on `today`. */
export function selectedActivityRange(selection: ActivitySelection, today: LocalDate): AnalyticsReportRange {
	return selection.kind === "preset" ? activityRangeOf(selection.preset, today) : activityRangeOfDays(selection.fromDate, selection.toDate);
}

/** The first and last day a selection covers on `today`: where the date picker opens. */
export function selectedActivityDays(selection: ActivitySelection, today: LocalDate): { readonly from: LocalDate; readonly to: LocalDate } {
	if (selection.kind === "custom") {
		return { from: selection.fromDate, to: selection.toDate };
	}
	return { from: addLocalDays(today, 1 - ACTIVITY_RANGE_DAYS[selection.preset]), to: today };
}

/** Why a custom range cannot be applied. */
export const CustomRangeIssueSchema = z.enum(["reversed", "tooLong", "future", "tooEarly"]);

export type CustomRangeIssue = z.output<typeof CustomRangeIssueSchema>;

/** The web's words for the issues it shares (the too-long one is the API's own), and the picker's bounds. */
export const CUSTOM_RANGE_ISSUE_MESSAGES: Readonly<Record<CustomRangeIssue, string>> = {
	reversed: "The end date must be on or after the start date",
	tooLong: ANALYTICS_RANGE_TOO_LONG_MESSAGE,
	future: "The end date can't be after today",
	tooEarly: `The start date can't be more than ${String(ACTIVITY_HISTORY_DAYS)} days ago`,
};

/**
 * Checks a custom first and last day: in order, at most
 * MAX_ANALYTICS_RANGE_DAYS days (the API's limit, run again on the server
 * once the screen reads it), ending by today and starting within the history
 * offered. `null` when the range can be applied.
 */
export function customRangeIssueOf(fromDate: LocalDate, toDate: LocalDate, today: LocalDate): CustomRangeIssue | null {
	const days = inclusiveLocalDayCount(fromDate, toDate);
	if (days < 1) {
		return "reversed";
	}
	if (days > MAX_ANALYTICS_RANGE_DAYS) {
		return "tooLong";
	}
	if (toDate > today) {
		return "future";
	}
	return fromDate < earliestActivityDate(today) ? "tooEarly" : null;
}
