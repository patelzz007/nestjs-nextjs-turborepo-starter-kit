import { describe, expect, it } from "vitest";

import { AdminAnalyticsExportQuerySchema, analyticsExportFileName, MerchantAnalyticsExportQuerySchema } from "./analytics-export";

/** 2026-09-01 00:00 and 2026-10-01 00:00 in Kuala Lumpur (UTC+8). */
const FROM = Date.UTC(2026, 7, 31, 16);
const TO = Date.UTC(2026, 8, 30, 16);

describe("analyticsExportFileName", () => {
	it("names the subject, the local first and LAST INCLUDED day, the interval and the format", () => {
		expect(analyticsExportFileName({ subject: "brew-and-bean-kl", fromMs: FROM, toMs: TO, timeZone: "Asia/Kuala_Lumpur", interval: "day", format: "xlsx" })).toBe(
			"analytics_brew-and-bean-kl_2026-09-01_2026-09-30_day.xlsx",
		);
	});

	it("reads the days in the report's zone (the same instants are other days in UTC)", () => {
		expect(analyticsExportFileName({ subject: "platform", fromMs: FROM, toMs: TO, timeZone: "UTC", interval: "week", format: "pdf" })).toBe(
			"analytics_platform_2026-08-31_2026-09-30_week.pdf",
		);
	});

	it("keeps only [a-z0-9-] from the subject, so the name is safe in a header and on every OS", () => {
		expect(analyticsExportFileName({ subject: 'Evil"; filename=../../x\r\n', fromMs: FROM, toMs: TO, timeZone: "UTC", interval: "month", format: "csv" })).toBe(
			"analytics_evil-filename-x_2026-08-31_2026-09-30_month.csv",
		);
		expect(analyticsExportFileName({ subject: "中文", fromMs: FROM, toMs: TO, timeZone: "UTC", interval: "day", format: "csv" })).toMatch(/^analytics_report_/);
	});
});

describe("export queries", () => {
	it("require both bounds and a known format", () => {
		expect(MerchantAnalyticsExportQuerySchema.safeParse({ from: FROM, to: TO, format: "csv" }).success).toBe(true);
		expect(MerchantAnalyticsExportQuerySchema.safeParse({ to: TO, format: "csv" }).success).toBe(false);
		expect(MerchantAnalyticsExportQuerySchema.safeParse({ from: FROM, format: "csv" }).success).toBe(false);
		expect(AdminAnalyticsExportQuerySchema.safeParse({ from: FROM, to: TO, format: "docx" }).success).toBe(false);
		expect(AdminAnalyticsExportQuerySchema.safeParse({ from: FROM, to: TO, format: "pdf", locationId: "x" }).success).toBe(false);
	});
});
