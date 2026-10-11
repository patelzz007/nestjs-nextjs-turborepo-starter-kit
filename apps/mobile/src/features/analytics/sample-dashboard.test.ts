import {
	CUSTOMER_TOP_MERCHANTS_LIMIT,
	CustomerAnalyticsDashboardSchema,
	DAY_MS,
	EpochMsSchema,
	WEEK_MS,
	type ClaimStatusBreakdown,
	type CustomerDashboardPoint,
	type CustomerMerchantSpend,
} from "@workspace/shared";

import { ActivityRangePresetSchema, activityRangeOf, type ActivityRangePreset } from "./activity-range";
import { bucketsOf, compare, sampleActivityDashboard } from "./sample-dashboard";

const TODAY = "2026-10-12";

function sumOf(points: readonly CustomerDashboardPoint[], read: (point: CustomerDashboardPoint) => number): number {
	return points.reduce((total: number, point: CustomerDashboardPoint): number => total + read(point), 0);
}

describe("sampleActivityDashboard", () => {
	it.each(ActivityRangePresetSchema.options)("satisfies the API's contract for %s", (preset: ActivityRangePreset) => {
		const dashboard = sampleActivityDashboard(activityRangeOf(preset, TODAY));

		expect(CustomerAnalyticsDashboardSchema.safeParse(dashboard).success).toBe(true);
		expect(dashboard.range).toStrictEqual(activityRangeOf(preset, TODAY));
	});

	it("is the same on every call for the same day", () => {
		expect(sampleActivityDashboard(activityRangeOf("last30Days", TODAY))).toStrictEqual(sampleActivityDashboard(activityRangeOf("last30Days", TODAY)));
	});

	it("has some activity to show in a month", () => {
		const { totals } = sampleActivityDashboard(activityRangeOf("last30Days", TODAY));

		expect(totals.visits.value).toBeGreaterThan(0);
		expect(totals.spentMinor.value).toBeGreaterThan(0);
		expect(totals.claims.value).toBeGreaterThan(0);
	});

	it("adds its buckets up to its totals", () => {
		const { totals, series } = sampleActivityDashboard(activityRangeOf("last90Days", TODAY));

		expect(sumOf(series, (point: CustomerDashboardPoint): number => point.spentMinor)).toBe(totals.spentMinor.value);
		expect(sumOf(series, (point: CustomerDashboardPoint): number => point.visits)).toBe(totals.visits.value);
		expect(sumOf(series, (point: CustomerDashboardPoint): number => point.claims)).toBe(totals.claims.value);
		expect(sumOf(series, (point: CustomerDashboardPoint): number => point.redemptions)).toBe(totals.redemptions.value);
	});

	it("tells the same story for a day in every range", () => {
		const week = sampleActivityDashboard(activityRangeOf("last7Days", TODAY));
		const month = sampleActivityDashboard(activityRangeOf("last30Days", TODAY));

		expect(month.series.slice(-week.series.length)).toStrictEqual(week.series);
	});

	it("never redeems more rewards than were claimed", () => {
		const { series, totals } = sampleActivityDashboard(activityRangeOf("last90Days", TODAY));

		expect(series.every((point: CustomerDashboardPoint): boolean => point.redemptions <= point.claims)).toBe(true);
		expect(totals.conversionRate.value).toBeLessThanOrEqual(100);
	});

	it("splits the range's claims by status, every status listed in order", () => {
		const { claimsByStatus, totals } = sampleActivityDashboard(activityRangeOf("last30Days", TODAY));

		expect(claimsByStatus.map((row: ClaimStatusBreakdown): string => row.status)).toStrictEqual(["PENDING", "REDEEMED", "EXPIRED"]);
		expect(claimsByStatus.reduce((total: number, row: ClaimStatusBreakdown): number => total + row.claims, 0)).toBe(totals.claims.value);
	});

	it("lists the top shops by spend, highest first, at most the API's limit", () => {
		const { spendingByMerchant, series } = sampleActivityDashboard(activityRangeOf("last90Days", TODAY));

		expect(spendingByMerchant.length).toBeGreaterThan(0);
		expect(spendingByMerchant.length).toBeLessThanOrEqual(CUSTOMER_TOP_MERCHANTS_LIMIT);
		const totals = spendingByMerchant.map((merchant: CustomerMerchantSpend): number => merchant.totalMinor);
		expect(totals).toStrictEqual([...totals].sort((left: number, right: number): number => right - left));
		spendingByMerchant.forEach((merchant: CustomerMerchantSpend): void => {
			expect(merchant.series).toHaveLength(series.length);
		});
	});
});

describe("bucketsOf", () => {
	it("cuts a short range into whole days", () => {
		const buckets = bucketsOf(activityRangeOf("last7Days", TODAY));

		expect(buckets).toHaveLength(7);
		expect(buckets.every((bucket): boolean => bucket.end - bucket.start === DAY_MS && !bucket.isPartial)).toBe(true);
	});

	it("cuts a long range at Mondays, clipping the first and last week to it", () => {
		const range = activityRangeOf("last90Days", TODAY);
		const buckets = bucketsOf(range);
		const first = buckets.at(0);
		const last = buckets.at(-1);

		// 15 Jul 2026 is a Wednesday and 13 Oct a Tuesday: both edge weeks are clipped.
		expect(first).toStrictEqual({ start: range.from, end: Date.UTC(2026, 6, 20), isPartial: true });
		expect(last).toStrictEqual({ start: Date.UTC(2026, 9, 12), end: range.to, isPartial: true });
		expect(buckets.slice(1, -1).every((bucket): boolean => bucket.end - bucket.start === WEEK_MS && !bucket.isPartial)).toBe(true);
	});

	it("cuts a year into calendar months", () => {
		const buckets = bucketsOf({
			from: EpochMsSchema.parse(Date.UTC(2026, 0, 1)),
			to: EpochMsSchema.parse(Date.UTC(2026, 2, 15)),
			timeZone: "UTC",
			interval: "month",
			previousFrom: EpochMsSchema.parse(Date.UTC(2025, 9, 18)),
			previousTo: EpochMsSchema.parse(Date.UTC(2026, 0, 1)),
		});

		expect(buckets.map((bucket): number => bucket.start)).toStrictEqual([Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 1), Date.UTC(2026, 2, 1)]);
		expect(buckets.map((bucket): boolean => bucket.isPartial)).toStrictEqual([false, false, true]);
	});
});

describe("compare", () => {
	it("gives the change and its percentage, to one decimal", () => {
		expect(compare(120, 100)).toStrictEqual({ value: 120, previous: 100, change: 20, changePercent: 20 });
		expect(compare(2, 3)).toStrictEqual({ value: 2, previous: 3, change: -1, changePercent: -33.3 });
	});

	it("has no percentage when the previous period had nothing", () => {
		expect(compare(5, 0).changePercent).toBeNull();
	});
});
