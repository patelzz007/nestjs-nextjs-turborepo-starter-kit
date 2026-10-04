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

import type { DisplayRegion } from "@workspace/shared";

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
	return dateTimeFormatter(style, region).format(epochMs);
}

/** ISO 8601 (UTC) form of an instant — the machine-readable `dateTime` of a `<time>` element. */
export function toIsoTimestamp(epochMs: number): string {
	return new Date(epochMs).toISOString();
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
			return formatter.format(Math.trunc(elapsedSeconds / unitSeconds), unit);
		}
	}
	return formatter.format(Math.trunc(elapsedSeconds), "second");
}
