import { describe, expect, it } from "vitest";

import { dayWindowContaining, STORE_TIME_ZONE } from "@/lib/redemptions/today-window";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe("dayWindowContaining", () => {
	it("is the stores' calendar day, not the runtime's: 01:30 in Kuala Lumpur is still 'today' there although it is the previous day in UTC", () => {
		// 2026-10-02T17:30:00Z = 2026-10-03 01:30 in Asia/Kuala_Lumpur (UTC+8).
		const window = dayWindowContaining(Date.UTC(2026, 9, 2, 17, 30), "Asia/Kuala_Lumpur");

		expect(window).toEqual({ fromMs: Date.UTC(2026, 9, 2, 16, 0), toMs: Date.UTC(2026, 9, 3, 16, 0) });
	});

	it("starts exactly at local midnight", () => {
		const midnight = Date.UTC(2026, 9, 2, 16, 0);

		expect(dayWindowContaining(midnight, "Asia/Kuala_Lumpur").fromMs).toBe(midnight);
		expect(dayWindowContaining(midnight - 1, "Asia/Kuala_Lumpur").toMs).toBe(midnight);
	});

	it("follows a daylight-saving change (a 23-hour day)", () => {
		// 2026-03-08 in New York: clocks jump from 02:00 to 03:00 EST→EDT.
		const window = dayWindowContaining(Date.UTC(2026, 2, 8, 18, 0), "America/New_York");

		expect(window).toEqual({ fromMs: Date.UTC(2026, 2, 8, 5, 0), toMs: Date.UTC(2026, 2, 9, 4, 0) });
		expect(window.toMs - window.fromMs).toBe(DAY_MS - HOUR_MS);
	});

	it("uses the stores' time zone by default", () => {
		expect(STORE_TIME_ZONE).toBe("Asia/Kuala_Lumpur");
	});
});
