// ============================================
// lib/format/date-time.ts - timestamp and relative-time formatting
// ============================================
// Timestamps cross the API as epoch milliseconds (UTC instants). These helpers
// are the one sanctioned way to render one in every app — never call
// `toLocaleString()` / `toLocaleDateString()` / `date-fns` `format()` on a
// `Date` at a call site.
//
// Every formatter takes the locale AND the IANA time zone explicitly. A bare
// `toLocaleString()` or date-fns `format()` uses the runtime's own locale and
// zone, which differ between the Node server (often UTC, en-US) and the
// viewer's browser — the server HTML and the first client render then
// disagree and React reports a hydration mismatch. With both pinned the output
// is identical on every runtime. Apps pass `PLATFORM_DISPLAY_REGION` from
// @workspace/shared, or `ANALYTICS_BUCKET_DISPLAY_REGION` for analytics series
// points (UTC week buckets).
//
// Relative times ("5 minutes ago") depend on the current time, which the
// server and the browser never agree on — render them with the `RelativeTime`
// component, which shows the absolute time until after hydration.

import type { AnalyticsInterval, DisplayRegion } from "@workspace/shared";
import { normalizeIntlSpacing } from "./intl-text";

/** How an instant is written. */
export type DateTimeDisplayStyle = "date" | "dateTime" | "dayMonth";

const DATE_TIME_STYLE_OPTIONS: Readonly<Record<DateTimeDisplayStyle, Intl.DateTimeFormatOptions>> = {
	/** "15 Nov 2026" */
	date: { year: "numeric", month: "short", day: "numeric" },
	/** "15 Nov 2026, 2:05 pm" */
	dateTime: { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
	/** "15 Nov" — chart axes and compact rows. */
	dayMonth: { month: "short", day: "numeric" },
};

/** Separates the parts of a formatter cache key; never occurs in a locale tag, an IANA zone or a style name. */
const CACHE_KEY_SEPARATOR = "|";

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function dateTimeFormatter(style: DateTimeDisplayStyle, region: DisplayRegion): Intl.DateTimeFormat {
	const key = [style, region.locale, region.timeZone].join(CACHE_KEY_SEPARATOR);
	const cached = dateTimeFormatters.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.DateTimeFormat(region.locale, { ...DATE_TIME_STYLE_OPTIONS[style], timeZone: region.timeZone });
	dateTimeFormatters.set(key, formatter);
	return formatter;
}

/** `epochMs` written in `style`, on the wall clock of `region.timeZone` and in `region.locale`. */
export function formatEpochMs(epochMs: number, style: DateTimeDisplayStyle, region: DisplayRegion): string {
	return normalizeIntlSpacing(dateTimeFormatter(style, region).format(epochMs));
}

/** ISO 8601 (UTC) form of an instant — the machine-readable `dateTime` of a `<time>` element. */
export function toIsoTimestamp(epochMs: number): string {
	return new Date(epochMs).toISOString();
}

// ── Ranges and analytics buckets ───────────────────────────────────────────
// A range or bucket is half-open `[start, end)`: the last instant it covers is
// `end - 1`, so "1 Sep → 1 Oct" is written "1 – 30 Sep 2026".

/** The last instant of a half-open range is one millisecond before its exclusive end. */
const EXCLUSIVE_END_OFFSET_MS = 1;

const RANGE_DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

/** How an analytics bucket is written: compact for an axis tick, complete for a tooltip or a table row. */
export type BucketLabelStyle = "axis" | "full";

const BUCKET_LABEL_OPTIONS: Readonly<Record<BucketLabelStyle, Readonly<Record<AnalyticsInterval, Intl.DateTimeFormatOptions>>>> = {
	axis: {
		/** "5 Oct" */
		day: { month: "short", day: "numeric" },
		/** "5 Oct" — the week's Monday. */
		week: { month: "short", day: "numeric" },
		/** "Oct 26" */
		month: { month: "short", year: "2-digit" },
	},
	full: {
		/** "Mon, 5 Oct 2026" */
		day: { weekday: "short", year: "numeric", month: "short", day: "numeric" },
		/** "5 – 11 Oct 2026" (a range) */
		week: RANGE_DATE_OPTIONS,
		/** "October 2026" */
		month: { month: "long", year: "numeric" },
	},
};

function formatterFor(options: Intl.DateTimeFormatOptions, cacheKey: string, region: DisplayRegion): Intl.DateTimeFormat {
	const key = [cacheKey, region.locale, region.timeZone].join(CACHE_KEY_SEPARATOR);
	const cached = dateTimeFormatters.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.DateTimeFormat(region.locale, { ...options, timeZone: region.timeZone });
	dateTimeFormatters.set(key, formatter);
	return formatter;
}

/**
 * A half-open range `[fromMs, toMs)` as dates in `region` — "6 Sep – 5 Oct 2026",
 * "1 – 30 Sep 2026", or one date when it covers a single day.
 */
export function formatEpochMsRange(fromMs: number, toMs: number, region: DisplayRegion): string {
	const lastMs = Math.max(fromMs, toMs - EXCLUSIVE_END_OFFSET_MS);
	return normalizeIntlSpacing(formatterFor(RANGE_DATE_OPTIONS, "range", region).formatRange(fromMs, lastMs));
}

/**
 * One analytics bucket `[startMs, endMs)` cut at `interval` in `region.timeZone`:
 * `axis` → "5 Oct" / "Oct 26"; `full` → "Mon, 5 Oct 2026" / "5 – 11 Oct 2026" / "October 2026".
 * A clipped (partial) week is written with its own clipped dates.
 */
export function formatBucket(startMs: number, endMs: number, interval: AnalyticsInterval, style: BucketLabelStyle, region: DisplayRegion): string {
	const formatter = formatterFor(BUCKET_LABEL_OPTIONS[style][interval], `bucket-${style}-${interval}`, region);
	if (style === "full" && interval === "week") {
		return normalizeIntlSpacing(formatter.formatRange(startMs, Math.max(startMs, endMs - EXCLUSIVE_END_OFFSET_MS)));
	}
	return normalizeIntlSpacing(formatter.format(startMs));
}

// ── Relative time ──────────────────────────────────────────────────────────

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 604_800;
/** Average Gregorian month (365.2425 / 12 days), so "N months ago" stays accurate across the year. */
const SECONDS_PER_MONTH = 2_629_746;
/** Average Gregorian year (365.2425 days). */
const SECONDS_PER_YEAR = 31_556_952;

/** Largest-first: the first unit whose size fits the elapsed time is the one spoken. */
const RELATIVE_TIME_UNITS: readonly (readonly [unit: Intl.RelativeTimeFormatUnit, seconds: number])[] = [
	["year", SECONDS_PER_YEAR],
	["month", SECONDS_PER_MONTH],
	["week", SECONDS_PER_WEEK],
	["day", SECONDS_PER_DAY],
	["hour", SECONDS_PER_HOUR],
	["minute", SECONDS_PER_MINUTE],
];

function relativeTimeFormatter(locale: string): Intl.RelativeTimeFormat {
	const cached = relativeTimeFormatters.get(locale);
	if (cached !== undefined) {
		return cached;
	}
	// `numeric: "auto"` says "yesterday" / "now" where the locale has a word for it.
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	relativeTimeFormatters.set(locale, formatter);
	return formatter;
}

/**
 * `epochMs` relative to `nowMs` in `locale` — "5 minutes ago", "in 2 days",
 * "now". Pure: the caller supplies the current time, so the result is
 * testable and never computed during a server render (see `RelativeTime`).
 * Truncates toward zero, so 119 seconds ago reads "1 minute ago", never "2".
 */
export function formatRelativeTime(epochMs: number, nowMs: number, locale: string): string {
	const elapsedSeconds = (epochMs - nowMs) / MS_PER_SECOND;
	const magnitude = Math.abs(elapsedSeconds);
	const formatter = relativeTimeFormatter(locale);
	for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
		if (magnitude >= unitSeconds) {
			return normalizeIntlSpacing(formatter.format(Math.trunc(elapsedSeconds / unitSeconds), unit));
		}
	}
	return normalizeIntlSpacing(formatter.format(Math.trunc(elapsedSeconds), "second"));
}
