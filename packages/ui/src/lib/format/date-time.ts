// ============================================
// lib/format/date-time.ts -timestamp and relative-time formatting
// ============================================
// Time is epoch milliseconds everywhere — in data, state, URLs, logs and on the
// wire (a UTC instant, a plain number that sorts and compares). The only place
// an instant becomes text is here, at the moment it is shown to a person, and
// it is written with date-fns. Never call `toLocaleString()`, `Intl.DateTimeFormat`
// or date-fns `format()` on a time at a call site.
//
// Every formatter takes the locale AND the IANA time zone explicitly (`DisplayRegion`).
// The instant is placed on that zone's wall clock with `TZDate` (@date-fns/tz), so
// the Node server and the viewer's browser — whatever their own zones — write the
// same text, and React never reports a hydration mismatch. Apps pass
// `PLATFORM_DISPLAY_REGION`, or `ANALYTICS_BUCKET_DISPLAY_REGION` for analytics
// series points (UTC week buckets).
//
// Relative times ("5 minutes ago") depend on the current time, which the
// server and the browser never agree on — render them with the `RelativeTime`
// component, which shows the absolute time until after hydration.

import { TZDate } from "@date-fns/tz";
import { formatDistanceStrict, formatISO, format as formatDate, isSameDay, isSameMonth, isSameYear, type Locale } from "date-fns";
import { de, enGB, enUS, ms } from "date-fns/locale";

import type { AnalyticsInterval, DisplayRegion } from "@workspace/shared";

/**
 * How an instant is written: `date` "15 Nov 2026", `dateTime` "15 Nov 2026, 14:05",
 * `fullDate` "Sunday, 15 November 2026", `dayMonth` "15 Nov", `time` "14:05",
 * `preciseTime` "14:05:09.042" (24-hour, to the millisecond — log viewers).
 */
export type DateTimeDisplayStyle = "date" | "dateTime" | "fullDate" | "dayMonth" | "time" | "preciseTime";

/** A display locale's date-fns locale and the one pattern date-fns has no localized token for. */
interface DateLocale {
	readonly locale: Locale;
	/** Day and month without the year — "15 Nov" / "Nov 15". */
	readonly dayMonth: string;
	/** Writes a same-month range as "1–30 Sep 2026" (day first) rather than "Sep 1 – Sep 30, 2026". */
	readonly dayFirst: boolean;
}

const BRITISH_ENGLISH: DateLocale = { locale: enGB, dayMonth: "d MMM", dayFirst: true };
const AMERICAN_ENGLISH: DateLocale = { locale: enUS, dayMonth: "MMM d", dayFirst: false };

/**
 * The display locales the kit writes dates in, by BCP 47 tag. date-fns has no `en-MY`:
 * Malaysian English writes dates the British way. Add a region's tag here to support it;
 * an unknown tag falls back to its language, then to American English.
 */
const DATE_LOCALES: Readonly<Record<string, DateLocale>> = {
	en: AMERICAN_ENGLISH,
	"en-US": AMERICAN_ENGLISH,
	"en-GB": BRITISH_ENGLISH,
	"en-MY": BRITISH_ENGLISH,
	de: { locale: de, dayMonth: "d. MMM", dayFirst: true },
	"de-DE": { locale: de, dayMonth: "d. MMM", dayFirst: true },
	ms: { locale: ms, dayMonth: "d MMM", dayFirst: true },
	"ms-MY": { locale: ms, dayMonth: "d MMM", dayFirst: true },
};

function dateLocale(tag: string): DateLocale {
	const [language = tag] = tag.split("-");
	return DATE_LOCALES[tag] ?? DATE_LOCALES[language] ?? AMERICAN_ENGLISH;
}

/** `epochMs` on the wall clock of `timeZone`. */
function inZone(epochMs: number, timeZone: string): TZDate {
	return new TZDate(epochMs, timeZone);
}

/** date-fns patterns: `PP` is the locale's medium date ("15 Nov 2026"), `p` its short time. */
function stylePattern(style: DateTimeDisplayStyle, locale: DateLocale): string {
	switch (style) {
		case "date":
			return "PP";
		case "dateTime":
			return "PP, p";
		case "fullDate":
			return "PPPP";
		case "dayMonth":
			return locale.dayMonth;
		case "time":
			return "p";
		case "preciseTime":
			return "HH:mm:ss.SSS";
	}
}

/** `epochMs` written in `style`, on the wall clock of `region.timeZone` and in `region.locale`. */
export function formatEpochMs(epochMs: number, style: DateTimeDisplayStyle, region: DisplayRegion): string {
	const locale = dateLocale(region.locale);
	return formatDate(inZone(epochMs, region.timeZone), stylePattern(style, locale), { locale: locale.locale });
}

/** ISO 8601 (UTC) form of an instant — the machine-readable `dateTime` of a `<time>` element. */
export function toIsoTimestamp(epochMs: number): string {
	return formatISO(inZone(epochMs, "UTC")).replace(/\+00:00$/u, "Z");
}

// ── Ranges and analytics buckets ───────────────────────────────────────────
// A range or bucket is half-open `[start, end)`: the last instant it covers is
// `end - 1`, so "1 Sep → 1 Oct" is written "1–30 Sep 2026".

/** The last instant of a half-open range is one millisecond before its exclusive end. */
const EXCLUSIVE_END_OFFSET_MS = 1;

/** The days from `first` to `last` (both included), written as compactly as they allow. */
function formatDayRange(first: TZDate, last: TZDate, locale: DateLocale): string {
	const options = { locale: locale.locale };
	if (isSameDay(first, last)) {
		return formatDate(last, "PP", options);
	}
	if (locale.dayFirst && isSameMonth(first, last)) {
		return `${formatDate(first, "d", options)}–${formatDate(last, "PP", options)}`;
	}
	const start = isSameYear(first, last) ? formatDate(first, locale.dayMonth, options) : formatDate(first, "PP", options);
	return `${start} – ${formatDate(last, "PP", options)}`;
}

/**
 * A half-open range `[fromMs, toMs)` as dates in `region` — "6 Sep – 5 Oct 2026",
 * "1–30 Sep 2026", or one date when it covers a single day.
 */
export function formatEpochMsRange(fromMs: number, toMs: number, region: DisplayRegion): string {
	const lastMs = Math.max(fromMs, toMs - EXCLUSIVE_END_OFFSET_MS);
	return formatDayRange(inZone(fromMs, region.timeZone), inZone(lastMs, region.timeZone), dateLocale(region.locale));
}

/** How an analytics bucket is written: compact for an axis tick, complete for a tooltip or a table row. */
export type BucketLabelStyle = "axis" | "full";

/**
 * One analytics bucket `[startMs, endMs)` cut at `interval` in `region.timeZone`:
 * `axis` → "5 Oct" / "Oct 26"; `full` → "Mon, 5 Oct 2026" / "5–11 Oct 2026" / "October 2026".
 * A clipped (partial) week is written with its own clipped dates.
 */
export function formatBucket(startMs: number, endMs: number, interval: AnalyticsInterval, style: BucketLabelStyle, region: DisplayRegion): string {
	const locale = dateLocale(region.locale);
	const start = inZone(startMs, region.timeZone);
	const options = { locale: locale.locale };
	if (style === "axis") {
		return formatDate(start, interval === "month" ? "MMM yy" : locale.dayMonth, options);
	}
	switch (interval) {
		case "day":
			return formatDate(start, "EEE, PP", options);
		case "week":
			return formatDayRange(start, inZone(Math.max(startMs, endMs - EXCLUSIVE_END_OFFSET_MS), region.timeZone), locale);
		case "month":
			return formatDate(start, "MMMM yyyy", options);
	}
}

// ── Relative time ──────────────────────────────────────────────────────────

/**
 * `epochMs` relative to `nowMs` in `locale` — "5 minutes ago", "in 2 hours",
 * "1 year ago". Pure: the caller supplies the current time, so the result is
 * testable and never computed during a server render (see `RelativeTime`).
 * Truncates toward zero, so 119 seconds ago reads "1 minute ago", never "2".
 */
export function formatRelativeTime(epochMs: number, nowMs: number, locale: string): string {
	return formatDistanceStrict(epochMs, nowMs, { addSuffix: true, roundingMethod: "trunc", locale: dateLocale(locale).locale });
}
