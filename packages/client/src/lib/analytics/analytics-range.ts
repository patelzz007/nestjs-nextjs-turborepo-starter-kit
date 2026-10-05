// ============================================
// lib/analytics/analytics-range.ts - date-range presets, custom ranges and the URL state of every analytics dashboard
// ============================================
// One grammar for the customer, merchant and admin dashboards (and the
// merchant / admin exports), shared by the server page (prefetch) and the
// client (query + export):
//
//   ?range=last30Days                       a preset (default — left out of the URL)
//   ?range=custom&from=2026-09-01&to=2026-09-30   inclusive calendar days
//   &interval=day|week|month                optional; absent = derived from the length
//
// Days are calendar days in the REPORT's time zone (the merchant's zone, UTC for
// admin and customer — the zone the API cuts buckets in), so a preset's range
// is whole buckets. A range is resolved against a fixed `nowMs` (the request
// time, passed from the server page) so the server prefetch and the client
// query compute the same `from` / `to` and share one query key.
//
// Framework-free and server-safe (no "use client").

import {
	addLocalDays,
	ANALYTICS_RANGE_TOO_LONG_MESSAGE,
	AnalyticsIntervalSchema,
	defaultAnalyticsInterval,
	inclusiveLocalDayCount,
	localDateInTimeZone,
	LocalDateSchema,
	MAX_ANALYTICS_RANGE_DAYS,
	startOfLocalDateInTimeZone,
	type AnalyticsInterval,
	type LocalDate,
} from "@workspace/shared";
import { z } from "zod";

import { defineUrlState, optionalUrlParam, urlParamWithDefault } from "../url-state/url-state";

/** The ranges a person picks from; `custom` takes explicit From / To days. */
export const AnalyticsRangePresetSchema = z.enum(["last7Days", "last30Days", "last90Days", "thisMonth", "lastMonth", "thisQuarter", "yearToDate", "last12Months", "custom"]);

export type AnalyticsRangePreset = z.output<typeof AnalyticsRangePresetSchema>;

/** A preset computed from "today" (every preset except `custom`). */
export type RelativeAnalyticsRangePreset = Exclude<AnalyticsRangePreset, "custom">;

/** Matches the API's default range (the last 30 days). */
export const DEFAULT_ANALYTICS_RANGE_PRESET: RelativeAnalyticsRangePreset = "last30Days";

/** The URL state of every analytics dashboard (see the file header). */
export const ANALYTICS_URL_STATE = defineUrlState({
	range: urlParamWithDefault(AnalyticsRangePresetSchema, DEFAULT_ANALYTICS_RANGE_PRESET),
	from: optionalUrlParam(LocalDateSchema),
	to: optionalUrlParam(LocalDateSchema),
	interval: optionalUrlParam(AnalyticsIntervalSchema),
});

export type AnalyticsUrlState = typeof ANALYTICS_URL_STATE.defaults;

/** A range of whole calendar days, both ends included. */
export interface LocalDateRange {
	readonly fromDate: LocalDate;
	readonly toDate: LocalDate;
}

const MONTHS_PER_QUARTER = 3;
/** "Last 12 months" = this month plus the eleven before it. */
const PRECEDING_MONTHS_IN_YEAR_PRESET = 11;
const LAST_7_DAYS_BACK = 6;
const LAST_30_DAYS_BACK = 29;
const LAST_90_DAYS_BACK = 89;
/** Characters of `YYYY-MM` at the start of a `YYYY-MM-DD` date. */
const YEAR_MONTH_LENGTH = 7;
const YEAR_LENGTH = 4;
const MONTH_START = 5;
/** Characters of `YYYY-MM-DD` at the start of `Date#toISOString()`. */
const ISO_DATE_LENGTH = 10;

/** `YYYY-MM-01` of the month `monthOffset` months from `date`'s month (negative = earlier). */
function firstOfMonth(date: LocalDate, monthOffset: number): LocalDate {
	const year = Number(date.slice(0, YEAR_LENGTH));
	const monthIndex = Number(date.slice(MONTH_START, YEAR_MONTH_LENGTH)) - 1 + monthOffset;
	return LocalDateSchema.parse(new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, ISO_DATE_LENGTH));
}

/** The inclusive days a relative preset covers, ending today (`today` in the report's zone). */
export function presetLocalDateRange(preset: RelativeAnalyticsRangePreset, today: LocalDate): LocalDateRange {
	switch (preset) {
		case "last7Days":
			return { fromDate: addLocalDays(today, -LAST_7_DAYS_BACK), toDate: today };
		case "last30Days":
			return { fromDate: addLocalDays(today, -LAST_30_DAYS_BACK), toDate: today };
		case "last90Days":
			return { fromDate: addLocalDays(today, -LAST_90_DAYS_BACK), toDate: today };
		case "thisMonth":
			return { fromDate: firstOfMonth(today, 0), toDate: today };
		case "lastMonth":
			return { fromDate: firstOfMonth(today, -1), toDate: addLocalDays(firstOfMonth(today, 0), -1) };
		case "thisQuarter": {
			const monthIndex = Number(today.slice(MONTH_START, YEAR_MONTH_LENGTH)) - 1;
			return { fromDate: firstOfMonth(today, -(monthIndex % MONTHS_PER_QUARTER)), toDate: today };
		}
		case "yearToDate":
			return { fromDate: `${today.slice(0, YEAR_LENGTH)}-01-01`, toDate: today };
		case "last12Months":
			return { fromDate: firstOfMonth(today, -PRECEDING_MONTHS_IN_YEAR_PRESET), toDate: today };
	}
}

/** Why a custom range cannot be applied. */
export type CustomRangeIssue = "incomplete" | "reversed" | "tooLong";

export type CustomRangeCheck = { readonly ok: true; readonly range: LocalDateRange } | { readonly ok: false; readonly issue: CustomRangeIssue };

/** Messages for each {@link CustomRangeIssue} — the too-long one is the API's own wording. */
export const CUSTOM_RANGE_ISSUE_MESSAGES: Readonly<Record<CustomRangeIssue, string>> = {
	incomplete: "Choose both a start and an end date",
	reversed: "The end date must be on or after the start date",
	tooLong: ANALYTICS_RANGE_TOO_LONG_MESSAGE,
};

/**
 * Checks a custom From / To pair (as typed, `YYYY-MM-DD`): both present, in
 * order, at most {@link MAX_ANALYTICS_RANGE_DAYS} days. The API runs the same
 * limit again — this is the person's early, specific feedback.
 */
export function checkCustomRange(fromDate: string | undefined, toDate: string | undefined): CustomRangeCheck {
	const from = LocalDateSchema.safeParse(fromDate);
	const to = LocalDateSchema.safeParse(toDate);
	if (!from.success || !to.success) {
		return { ok: false, issue: "incomplete" };
	}
	const days = inclusiveLocalDayCount(from.data, to.data);
	if (days < 1) {
		return { ok: false, issue: "reversed" };
	}
	if (days > MAX_ANALYTICS_RANGE_DAYS) {
		return { ok: false, issue: "tooLong" };
	}
	return { ok: true, range: { fromDate: from.data, toDate: to.data } };
}

/** The range a dashboard shows, every default applied. */
export interface ResolvedAnalyticsRange {
	/** The preset in effect — the default when a custom range in the URL is invalid. */
	readonly preset: AnalyticsRangePreset;
	readonly days: LocalDateRange;
	/** Inclusive start (local midnight of `days.fromDate`). */
	readonly fromMs: number;
	/** Exclusive end (local midnight after `days.toDate`). */
	readonly toMs: number;
	/** The interval in effect: the URL's, or the one the API derives from the length. */
	readonly interval: AnalyticsInterval;
	/** Today in the report's zone — the latest day a custom range may end on. */
	readonly today: LocalDate;
	readonly timeZone: string;
}

/** The query fields every dashboard and export takes for a resolved range. */
export interface AnalyticsRangeQuery {
	readonly from: number;
	readonly to: number;
	readonly interval: AnalyticsInterval;
}

/** Resolves the URL state against `nowMs` in the report's `timeZone`. */
export function resolveAnalyticsRange(state: AnalyticsUrlState, nowMs: number, timeZone: string): ResolvedAnalyticsRange {
	const today = LocalDateSchema.parse(localDateInTimeZone(nowMs, timeZone));
	const custom = state.range === "custom" ? checkCustomRange(state.from, state.to) : undefined;
	const preset: AnalyticsRangePreset = custom === undefined ? state.range : custom.ok ? "custom" : DEFAULT_ANALYTICS_RANGE_PRESET;
	const days = custom?.ok === true ? custom.range : presetLocalDateRange(preset === "custom" ? DEFAULT_ANALYTICS_RANGE_PRESET : preset, today);
	const fromMs = startOfLocalDateInTimeZone(days.fromDate, timeZone);
	const toMs = startOfLocalDateInTimeZone(addLocalDays(days.toDate, 1), timeZone);
	return { preset, days, fromMs, toMs, interval: state.interval ?? defaultAnalyticsInterval(fromMs, toMs), today, timeZone };
}

/** `from` / `to` / `interval` of a resolved range, for a dashboard query or an export. */
export function toAnalyticsRangeQuery(range: ResolvedAnalyticsRange): AnalyticsRangeQuery {
	return { from: range.fromMs, to: range.toMs, interval: range.interval };
}

/** Separates the parts of a prefetch key; never occurs in a number, an interval name or a UUID. */
const PREFETCH_KEY_SEPARATOR = "|";

/**
 * Identifies the exact request a server prefetch answered (range, interval and
 * an optional scope such as the store filter) — the `stateKey` of a
 * `PrefetchedQuery`. A client query is seeded with the prefetched data only
 * under the same key, never after the person picks another range.
 */
export function analyticsPrefetchKey(query: AnalyticsRangeQuery, scope = ""): string {
	return [String(query.from), String(query.to), query.interval, scope].join(PREFETCH_KEY_SEPARATOR);
}
