import { describe, expect, it } from "vitest";

import {
	addLocalDays,
	IanaTimeZoneSchema,
	inclusiveLocalDayCount,
	LocalDateSchema,
	nextWeekStartInTimeZone,
	startOfLocalDateInTimeZone,
	startOfWeekInTimeZone,
} from "./analytics-time-zone";

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

describe("LocalDateSchema", () => {
	it("accepts real calendar dates only", () => {
		expect(LocalDateSchema.safeParse("2028-02-29").success).toBe(true);
		expect(LocalDateSchema.safeParse("2026-02-29").success).toBe(false);
		expect(LocalDateSchema.safeParse("2026-13-01").success).toBe(false);
		expect(LocalDateSchema.safeParse("1 Oct 2026").success).toBe(false);
	});
});

describe("startOfLocalDateInTimeZone", () => {
	it("is 00:00 UTC for UTC", () => {
		expect(startOfLocalDateInTimeZone("2026-10-05", "UTC")).toBe(Date.UTC(2026, 9, 5));
	});

	it("is local midnight for Kuala Lumpur (UTC+8): the previous UTC day at 16:00", () => {
		expect(startOfLocalDateInTimeZone("2026-10-05", "Asia/Kuala_Lumpur")).toBe(Date.UTC(2026, 9, 4, 16));
	});

	it("follows the zone's offset on each side of a DST change", () => {
		// London is UTC+1 until Sunday 2026-10-25, UTC+0 after.
		expect(startOfLocalDateInTimeZone("2026-10-25", "Europe/London")).toBe(Date.UTC(2026, 9, 24, 23));
		expect(startOfLocalDateInTimeZone("2026-10-26", "Europe/London")).toBe(Date.UTC(2026, 9, 26));
	});

	it("rejects a string that is not a calendar date", () => {
		expect(() => startOfLocalDateInTimeZone("2026-02-30", "UTC")).toThrow();
	});
});

describe("addLocalDays", () => {
	it("crosses month, year and leap-day boundaries", () => {
		expect(addLocalDays("2026-03-01", -1)).toBe("2026-02-28");
		expect(addLocalDays("2028-03-01", -1)).toBe("2028-02-29");
		expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addLocalDays("2026-10-05", 0)).toBe("2026-10-05");
	});
});

describe("inclusiveLocalDayCount", () => {
	it("counts both ends", () => {
		expect(inclusiveLocalDayCount("2026-09-01", "2026-09-30")).toBe(30);
		expect(inclusiveLocalDayCount("2026-10-05", "2026-10-05")).toBe(1);
		expect(inclusiveLocalDayCount("2028-01-01", "2028-12-31")).toBe(366);
	});

	it("is zero or negative when the end is before the start", () => {
		expect(inclusiveLocalDayCount("2026-10-05", "2026-10-04")).toBe(0);
		expect(inclusiveLocalDayCount("2026-10-05", "2026-10-01")).toBe(-3);
	});
});
