import { PilotCitySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { DISPLAY_TIME_ZONE, formatDateTime, formatDateTimeWithSeconds, formatUtcShortDate } from "@/lib/format/dates";
import { formatCatalogAmount, formatCoordinate, formatCoordinatePair, formatCount } from "@/lib/format/numbers";
import { pilotCityLabel } from "@/lib/format/pilot-city";

/** 2026-08-13T17:33:15.000Z — 14 Aug 2026, 01:33:15 in Malaysia (UTC+8). */
const LATE_UTC_EVENING_MS = Date.UTC(2026, 7, 13, 17, 33, 15);

describe("timestamp formatters", () => {
	it("render in Malaysia time whatever the runtime zone is", () => {
		expect(DISPLAY_TIME_ZONE).toBe("Asia/Kuala_Lumpur");
		expect(formatDateTime(LATE_UTC_EVENING_MS)).toMatch(/^14 Aug 2026, 1:33\sam$/);
		expect(formatDateTimeWithSeconds(LATE_UTC_EVENING_MS)).toMatch(/^14 Aug 2026, 1:33:15\sam$/);
	});

	it("label an analytics bucket by its UTC calendar day", () => {
		expect(formatUtcShortDate(Date.UTC(2026, 7, 10))).toBe("10 Aug");
		expect(formatUtcShortDate(LATE_UTC_EVENING_MS)).toBe("13 Aug");
	});
});

describe("formatCount", () => {
	it("groups thousands in the display locale", () => {
		expect(formatCount(1_234_567)).toBe("1,234,567");
		expect(formatCount(0)).toBe("0");
	});
});

describe("pilotCityLabel", () => {
	it("labels every pilot city", () => {
		expect(PilotCitySchema.options.map(pilotCityLabel)).toEqual(["Kuala Lumpur", "Melaka"]);
	});
});

describe("coordinates", () => {
	it("render with a fixed precision and no grouping", () => {
		expect(formatCoordinate(3.139003)).toBe("3.1390");
		expect(formatCoordinate(-1234.5)).toBe("-1234.5000");
		expect(formatCoordinatePair(3.139003, 101.686855)).toBe("3.1390, 101.6869");
	});

	it("render a missing value as a dash", () => {
		expect(formatCoordinate(null)).toBe("—");
		expect(formatCoordinatePair(3.1, undefined)).toBe("—");
	});
});

describe("formatCatalogAmount", () => {
	it("renders the column scale with grouping, and a dash when absent", () => {
		expect(formatCatalogAmount(1234.5)).toBe("1,234.50");
		expect(formatCatalogAmount(0)).toBe("0.00");
		expect(formatCatalogAmount(null)).toBe("—");
	});
});
