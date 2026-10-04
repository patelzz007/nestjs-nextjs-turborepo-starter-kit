import type { DisplayRegion } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatEpochMs, formatRelativeTime, toIsoTimestamp } from "./date-time";

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
