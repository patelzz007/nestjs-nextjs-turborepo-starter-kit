import type { DisplayRegion } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatBucket, formatEpochMs, formatEpochMsRange, formatRelativeTime, toIsoTimestamp } from "./date-time";

const KUALA_LUMPUR: DisplayRegion = { locale: "en-MY", timeZone: "Asia/Kuala_Lumpur" };
const LOS_ANGELES_US: DisplayRegion = { locale: "en-US", timeZone: "America/Los_Angeles" };
const UTC_MALAYSIAN_ENGLISH: DisplayRegion = { locale: "en-MY", timeZone: "UTC" };

/** 14 Nov 2026 16:30 UTC — already 15 Nov 00:30 in Kuala Lumpur (UTC+8), still 14 Nov 08:30 in Los Angeles. */
const ACROSS_THE_DATE_LINE = Date.UTC(2026, 10, 14, 16, 30);

/** Runtime zones a server or browser may run in — the output must not depend on any of them. */
const RUNTIME_TIME_ZONES: readonly string[] = ["UTC", "America/Los_Angeles", "Asia/Kuala_Lumpur", "Pacific/Kiritimati"];

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("formatEpochMs", () => {
	it("writes the instant on the wall clock of the region's time zone", () => {
		expect(formatEpochMs(ACROSS_THE_DATE_LINE, "date", KUALA_LUMPUR)).toBe("15 Nov 2026");
		expect(formatEpochMs(ACROSS_THE_DATE_LINE, "dayMonth", KUALA_LUMPUR)).toBe("15 Nov");
		expect(formatEpochMs(ACROSS_THE_DATE_LINE, "dateTime", KUALA_LUMPUR)).toBe("15 Nov 2026, 12:30 am");

		expect(formatEpochMs(ACROSS_THE_DATE_LINE, "date", LOS_ANGELES_US)).toBe("Nov 14, 2026");
		expect(formatEpochMs(ACROSS_THE_DATE_LINE, "dateTime", LOS_ANGELES_US)).toBe("Nov 14, 2026, 8:30 AM");
	});

	it("labels a UTC-aligned bucket with its UTC calendar day", () => {
		expect(formatEpochMs(Date.UTC(2026, 10, 16), "dayMonth", UTC_MALAYSIAN_ENGLISH)).toBe("16 Nov");
	});

	it.each(RUNTIME_TIME_ZONES)("is identical whatever the runtime's own time zone is (%s)", (runtimeTimeZone: string) => {
		// Node re-reads TZ whenever it changes, so this switches the runtime zone the way a differently configured server or browser would.
		vi.stubEnv("TZ", runtimeTimeZone);

		expect(formatEpochMs(ACROSS_THE_DATE_LINE, "date", KUALA_LUMPUR)).toBe("15 Nov 2026");
		expect(formatEpochMs(ACROSS_THE_DATE_LINE, "dateTime", KUALA_LUMPUR)).toBe("15 Nov 2026, 12:30 am");
	});
});

describe("toIsoTimestamp", () => {
	it("is the UTC ISO 8601 form", () => {
		expect(toIsoTimestamp(ACROSS_THE_DATE_LINE)).toBe("2026-11-14T16:30:00.000Z");
	});
});

describe("formatRelativeTime", () => {
	const NOW = Date.UTC(2026, 10, 15, 12);
	const SECOND_MS = 1_000;
	const MINUTE_MS = 60 * SECOND_MS;
	const HOUR_MS = 60 * MINUTE_MS;
	const DAY_MS = 24 * HOUR_MS;

	it("speaks the largest whole unit, truncating toward zero", () => {
		expect(formatRelativeTime(NOW - 5 * MINUTE_MS, NOW, "en-MY")).toBe("5 minutes ago");
		expect(formatRelativeTime(NOW - 119 * SECOND_MS, NOW, "en-MY")).toBe("1 minute ago");
		expect(formatRelativeTime(NOW - 3 * HOUR_MS, NOW, "en-MY")).toBe("3 hours ago");
		expect(formatRelativeTime(NOW - 2 * DAY_MS, NOW, "en-MY")).toBe("2 days ago");
		expect(formatRelativeTime(NOW - 14 * DAY_MS, NOW, "en-MY")).toBe("2 weeks ago");
		expect(formatRelativeTime(NOW - 400 * DAY_MS, NOW, "en-MY")).toBe("last year");
	});

	it("uses the locale's words for adjacent units and the present", () => {
		expect(formatRelativeTime(NOW - DAY_MS, NOW, "en-MY")).toBe("yesterday");
		expect(formatRelativeTime(NOW, NOW, "en-MY")).toBe("now");
		expect(formatRelativeTime(NOW - 30 * SECOND_MS, NOW, "en-MY")).toBe("30 seconds ago");
	});

	it("describes future instants", () => {
		expect(formatRelativeTime(NOW + 2 * HOUR_MS, NOW, "en-MY")).toBe("in 2 hours");
	});

	it("speaks the given locale", () => {
		expect(formatRelativeTime(NOW - 5 * MINUTE_MS, NOW, "de-DE")).toBe("vor 5 Minuten");
	});
});

/** ICU separates range parts with thin / narrow no-break spaces; compare them as plain spaces. */
function spaced(value: string): string {
	return value.replace(/\s/g, " ");
}

describe("formatEpochMsRange", () => {
	it("writes a half-open range with its last included day", () => {
		expect(spaced(formatEpochMsRange(Date.UTC(2026, 8, 1), Date.UTC(2026, 9, 1), UTC_MALAYSIAN_ENGLISH))).toBe("1–30 Sept 2026");
		expect(spaced(formatEpochMsRange(Date.UTC(2026, 8, 6), Date.UTC(2026, 9, 6), UTC_MALAYSIAN_ENGLISH))).toBe("6 Sept – 5 Oct 2026");
	});

	it("writes the days of the region's time zone", () => {
		// 1 Sep 00:00 → 1 Oct 00:00 in Kuala Lumpur is 31 Aug 16:00 → 30 Sep 16:00 UTC.
		expect(spaced(formatEpochMsRange(Date.UTC(2026, 7, 31, 16), Date.UTC(2026, 8, 30, 16), KUALA_LUMPUR))).toBe("1–30 Sept 2026");
	});

	it("writes a single day once", () => {
		expect(spaced(formatEpochMsRange(Date.UTC(2026, 9, 5), Date.UTC(2026, 9, 6), UTC_MALAYSIAN_ENGLISH))).toBe("5 Oct 2026");
	});

	it("spans years", () => {
		expect(spaced(formatEpochMsRange(Date.UTC(2025, 11, 15), Date.UTC(2026, 0, 15), UTC_MALAYSIAN_ENGLISH))).toBe("15 Dec 2025 – 14 Jan 2026");
	});
});

describe("formatBucket", () => {
	const MONDAY = Date.UTC(2026, 9, 5);
	const NEXT_MONDAY = Date.UTC(2026, 9, 12);

	it("writes compact axis ticks per interval", () => {
		expect(spaced(formatBucket(MONDAY, Date.UTC(2026, 9, 6), "day", "axis", UTC_MALAYSIAN_ENGLISH))).toBe("5 Oct");
		expect(spaced(formatBucket(MONDAY, NEXT_MONDAY, "week", "axis", UTC_MALAYSIAN_ENGLISH))).toBe("5 Oct");
		expect(spaced(formatBucket(Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), "month", "axis", UTC_MALAYSIAN_ENGLISH))).toBe("Oct 26");
	});

	it("writes the complete bucket for tooltips and tables", () => {
		expect(spaced(formatBucket(MONDAY, Date.UTC(2026, 9, 6), "day", "full", UTC_MALAYSIAN_ENGLISH))).toBe("Mon, 5 Oct 2026");
		expect(spaced(formatBucket(MONDAY, NEXT_MONDAY, "week", "full", UTC_MALAYSIAN_ENGLISH))).toBe("5–11 Oct 2026");
		expect(spaced(formatBucket(Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), "month", "full", UTC_MALAYSIAN_ENGLISH))).toBe("October 2026");
	});

	it("writes a week crossing a month end and a clipped (partial) week", () => {
		expect(spaced(formatBucket(Date.UTC(2026, 8, 28), MONDAY, "week", "full", UTC_MALAYSIAN_ENGLISH))).toBe("28 Sept – 4 Oct 2026");
		expect(spaced(formatBucket(Date.UTC(2026, 9, 8), NEXT_MONDAY, "week", "full", UTC_MALAYSIAN_ENGLISH))).toBe("8–11 Oct 2026");
	});

	it("cuts buckets on the region's calendar, not UTC's", () => {
		// The Kuala Lumpur month of October starts 30 Sep 16:00 UTC.
		expect(spaced(formatBucket(Date.UTC(2026, 8, 30, 16), Date.UTC(2026, 9, 31, 16), "month", "full", KUALA_LUMPUR))).toBe("October 2026");
	});
});
