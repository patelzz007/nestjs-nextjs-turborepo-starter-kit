// ============================================
// analytics-range.ts — the date range + bucket interval of every analytics dashboard and export
// ============================================
// One range grammar for the customer, merchant and admin dashboards and for the
// merchant / admin exports (docs/technical/api/analytics.md):
//
//   from      epoch ms, INCLUSIVE   (default: `to` − DEFAULT_ANALYTICS_RANGE_DAYS days)
//   to        epoch ms, EXCLUSIVE   (default: the request time)
//   interval  day | week | month    (default: derived from the range length — defaultAnalyticsInterval)
//
// The range is half-open, so "September" is `from = Sep 1 00:00`, `to = Oct 1 00:00`
// in the report's time zone, and two adjacent ranges never count a bill twice.
// The range is NOT re-aligned: totals cover exactly [from, to). Buckets are cut
// at local midnight / Monday 00:00 / the 1st of the month in the report's time
// zone; the first and last bucket are clipped to the range (`isPartial`).

import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { DAY_MS } from "./analytics";
import { IanaTimeZoneSchema } from "./analytics-time-zone";

/** Bucket width of an analytics time series. Weeks start on Monday 00:00, months on the 1st, both in the report's time zone. */
export const AnalyticsIntervalSchema = z.enum(["day", "week", "month"]).meta({
	description: "Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length.",
	example: "week",
});

export type AnalyticsInterval = z.output<typeof AnalyticsIntervalSchema>;

/** Days a request covers when it sends no `from`. */
export const DEFAULT_ANALYTICS_RANGE_DAYS = 30;

/**
 * Longest range one request may cover (a leap year). Every aggregate, every
 * series (at most 367 daily buckets) and every export stays bounded by it.
 */
export const MAX_ANALYTICS_RANGE_DAYS = 366;

/** One hour: a range of whole LOCAL days is one hour longer when it crosses the autumn DST change. */
const DST_TRANSITION_TOLERANCE_MS = 3_600_000;

/** {@link MAX_ANALYTICS_RANGE_DAYS} in milliseconds, plus the DST hour a local-calendar range may span. */
export const MAX_ANALYTICS_RANGE_MS = MAX_ANALYTICS_RANGE_DAYS * DAY_MS + DST_TRANSITION_TOLERANCE_MS;

/** Ranges up to this many days default to daily buckets (≤ 32 points: a month). */
export const DAILY_INTERVAL_MAX_DAYS = 31;

/** Ranges up to this many days default to weekly buckets (≤ 27 points: half a year); longer ones to monthly. */
export const WEEKLY_INTERVAL_MAX_DAYS = 183;

/** The interval a range gets when the request names none: day ≤ 31 days < week ≤ 183 days < month. */
export function defaultAnalyticsInterval(fromMs: number, toMs: number): AnalyticsInterval {
	const days = (toMs - fromMs) / DAY_MS;
	if (days <= DAILY_INTERVAL_MAX_DAYS) {
		return "day";
	}
	return days <= WEEKLY_INTERVAL_MAX_DAYS ? "week" : "month";
}

/** The range a request actually covers (every default applied). */
export interface ResolvedAnalyticsRange {
	readonly fromMs: number;
	readonly toMs: number;
	readonly interval: AnalyticsInterval;
}

/** The range fields of an analytics request, before defaults. */
export interface AnalyticsRangeInput {
	readonly from?: number | undefined;
	readonly to?: number | undefined;
	readonly interval?: AnalyticsInterval | undefined;
}

/** Applies the defaults: `to` = `nowMs`, `from` = `to` − {@link DEFAULT_ANALYTICS_RANGE_DAYS} days, `interval` from the length. */
export function resolveAnalyticsRange(input: AnalyticsRangeInput, nowMs: number): ResolvedAnalyticsRange {
	const toMs = input.to ?? nowMs;
	const fromMs = input.from ?? toMs - DEFAULT_ANALYTICS_RANGE_DAYS * DAY_MS;
	return { fromMs, toMs, interval: input.interval ?? defaultAnalyticsInterval(fromMs, toMs) };
}

/** The equally long range right before `[fromMs, toMs)` — what every "vs previous period" change compares with. */
export function previousAnalyticsRange(range: { readonly fromMs: number; readonly toMs: number }): { readonly fromMs: number; readonly toMs: number } {
	return { fromMs: range.fromMs - (range.toMs - range.fromMs), toMs: range.fromMs };
}

/** Human message for a range longer than {@link MAX_ANALYTICS_RANGE_DAYS} — the UI shows it as is. */
export const ANALYTICS_RANGE_TOO_LONG_MESSAGE = `The date range may cover at most ${String(MAX_ANALYTICS_RANGE_DAYS)} days — choose a shorter range`;

/**
 * Cross-field rules of every analytics range, shared by client and server:
 * `from` < `to`, and at most {@link MAX_ANALYTICS_RANGE_DAYS} days. A missing
 * bound is checked with its default (`to` = now, `from` = 30 days before `to`).
 */
export function validateAnalyticsRange(value: AnalyticsRangeInput, context: z.RefinementCtx): void {
	const toMs = value.to ?? Date.now();
	const fromMs = value.from ?? toMs - DEFAULT_ANALYTICS_RANGE_DAYS * DAY_MS;
	if (fromMs >= toMs) {
		context.addIssue({ code: "custom", message: "from must be earlier than to", path: ["from"] });
		return;
	}
	if (toMs - fromMs > MAX_ANALYTICS_RANGE_MS) {
		context.addIssue({ code: "custom", message: ANALYTICS_RANGE_TOO_LONG_MESSAGE, path: ["from"] });
	}
}

/** The range fields every analytics request accepts (query string — Ajv coerces the numbers). */
export const analyticsRangeQueryShape = {
	from: EpochMsSchema.optional().meta({ description: "Range start, epoch ms, inclusive. Default: 30 days before `to`.", example: 1788192000000 }),
	to: EpochMsSchema.optional().meta({ description: "Range end, epoch ms, EXCLUSIVE. Default: now. At most 366 days after `from`.", example: 1790784000000 }),
	interval: AnalyticsIntervalSchema.optional(),
};

/** The range fields of an export: both bounds are required, so the file is reproducible and its name is deterministic. */
export const analyticsExportRangeShape = {
	from: EpochMsSchema.meta({ description: "Range start, epoch ms, inclusive.", example: 1788192000000 }),
	to: EpochMsSchema.meta({ description: "Range end, epoch ms, EXCLUSIVE. At most 366 days after `from`.", example: 1790784000000 }),
	interval: AnalyticsIntervalSchema.optional(),
};

/** The range a response covers, echoed with every default applied. */
export const AnalyticsReportRangeSchema = z.object({
	from: EpochMsSchema,
	/** Exclusive. */
	to: EpochMsSchema,
	/** IANA zone every bucket was cut in: the merchant's `Organization.timeZone`, or UTC for the admin and customer views. */
	timeZone: IanaTimeZoneSchema,
	interval: AnalyticsIntervalSchema,
	/** The equally long range right before `[from, to)` — the base of every `change` / `changePercent`. */
	previousFrom: EpochMsSchema,
	previousTo: EpochMsSchema,
});

export type AnalyticsReportRange = z.output<typeof AnalyticsReportRangeSchema>;
