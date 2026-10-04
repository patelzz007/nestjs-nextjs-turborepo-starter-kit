import { describe, expect, it } from "vitest";

import { IanaTimeZoneSchema, nextWeekStartInTimeZone, startOfWeekInTimeZone } from "./analytics-time-zone";

const HOUR_MS = 3_600_000;

describe("startOfWeekInTimeZone", () => {
	it("is Monday 00:00 UTC for UTC", () => {
		// Wednesday 2026-10-07 12:00 UTC → Monday 2026-10-05 00:00 UTC.
		expect(startOfWeekInTimeZone(Date.UTC(2026, 9, 7, 12), "UTC")).toBe(Date.UTC(2026, 9, 5));
	});

	it("is Monday 00:00 LOCAL time for a merchant in Kuala Lumpur (UTC+8)", () => {
		// Monday 2026-10-05 01:00 in KL is Sunday 17:00 UTC — it belongs to KL's Monday bucket, not UTC's previous week.
		const mondayOneAmKl = Date.UTC(2026, 9, 4, 17);
		expect(startOfWeekInTimeZone(mondayOneAmKl, "Asia/Kuala_Lumpur")).toBe(Date.UTC(2026, 9, 4, 16));
		expect(startOfWeekInTimeZone(mondayOneAmKl, "UTC")).toBe(Date.UTC(2026, 8, 28));
	});

	it("stays on local midnight across a DST change (a 169-hour week)", () => {
		// Europe/London leaves summer time on Sunday 2026-10-25.
		const weekStart = startOfWeekInTimeZone(Date.UTC(2026, 9, 21, 12), "Europe/London");
		expect(weekStart).toBe(Date.UTC(2026, 9, 18, 23));
		expect(nextWeekStartInTimeZone(weekStart, "Europe/London") - weekStart).toBe(169 * HOUR_MS);
	});
});

describe("IanaTimeZoneSchema", () => {
	it("accepts IANA names and rejects anything else", () => {
		expect(IanaTimeZoneSchema.safeParse("Asia/Kuala_Lumpur").success).toBe(true);
		expect(IanaTimeZoneSchema.safeParse("Mars/Olympus_Mons").success).toBe(false);
	});
});
