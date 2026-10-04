// ============================================
// lib/format/dates.ts - timestamp display formatting
// ============================================
// The whole codebase stores timestamps as **epoch milliseconds** (BigInt in
// the DB, `EpochMs` branded numbers in the shared schemas). These helpers are
// the ONLY sanctioned way to render one in the admin app — never call
// `toLocaleString()` / `toLocaleDateString()` / `date-fns` `format()` on a raw
// `Date` at a call site.
//
// Every formatter pins BOTH the locale and the time zone. A bare
// `toLocaleString()` uses the runtime's locale and zone, which differ between
// the Node server (often UTC, en-US) and the admin's browser — the server
// HTML and the first client render then disagree and React reports a
// hydration mismatch. Pinning both makes the output identical everywhere.

/**
 * Locale the admin app renders timestamps, counts and money in ("14 Aug 2026",
 * "RM 1,234.50"). Passed explicitly to every formatter — never the runtime
 * default, which differs between the server and the browser.
 */
export const DISPLAY_LOCALE = "en-MY";

/**
 * Time zone operator-facing timestamps are shown in. The platform operates in
 * Malaysia (every pilot city is in it), so admins read times in Malaysia time
 * regardless of the server's or browser's own zone.
 */
export const DISPLAY_TIME_ZONE = "Asia/Kuala_Lumpur";

/** The API buckets analytics series by UTC week; their labels are read in UTC. */
export const UTC_TIME_ZONE = "UTC";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	timeZone: DISPLAY_TIME_ZONE,
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

const DATE_TIME_WITH_SECONDS_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	timeZone: DISPLAY_TIME_ZONE,
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	second: "2-digit",
});

const UTC_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	timeZone: UTC_TIME_ZONE,
	month: "short",
	day: "numeric",
});

/** "14 Aug 2026, 1:33 am" (Malaysia time) — the default table/card timestamp label. */
export function formatDateTime(ms: number): string {
	return DATE_TIME_FORMATTER.format(ms);
}

/** "14 Aug 2026, 1:33:15 am" (Malaysia time) — with seconds, for detail views. */
export function formatDateTimeWithSeconds(ms: number): string {
	return DATE_TIME_WITH_SECONDS_FORMATTER.format(ms);
}

/**
 * "14 Aug" of the UTC calendar day — for analytics buckets, which the API
 * aligns to UTC. Rendering a UTC bucket start in a local zone west of UTC
 * would label it with the previous day.
 */
export function formatUtcShortDate(ms: number): string {
	return UTC_SHORT_DATE_FORMATTER.format(ms);
}
