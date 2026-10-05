import { MerchantAnalyticsDashboardSchema, type AnalyticsComparison, type MerchantAnalyticsDashboard } from "@workspace/shared";

import { STORE_A, STORE_B } from "@/test/terminals";

const DAY_MS = 86_400_000;
const KUALA_LUMPUR_OFFSET_MS = 8 * 3_600_000;
/** 1 Sep 2026 00:00 in Kuala Lumpur (31 Aug 16:00 UTC). */
export const MERCHANT_RANGE_FROM_MS = Date.UTC(2026, 8, 1) - KUALA_LUMPUR_OFFSET_MS;
/** Two local days later (exclusive). */
export const MERCHANT_RANGE_TO_MS = MERCHANT_RANGE_FROM_MS + 2 * DAY_MS;

function compared(value: number, previous: number): AnalyticsComparison {
	return { value, previous, change: value - previous, changePercent: previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10 };
}

/**
 * `GET /orgs/:orgSlug/analytics/dashboard` in Kuala Lumpur days: RM 2,500.00
 * over 10 bills, two stores, two rewards and both redemption methods.
 * Overrides are merged BEFORE parsing, so a fixture can never break the contract.
 */
export function buildMerchantDashboard(overrides: Partial<MerchantAnalyticsDashboard> = {}): MerchantAnalyticsDashboard {
	return MerchantAnalyticsDashboardSchema.parse({
		range: {
			from: MERCHANT_RANGE_FROM_MS,
			to: MERCHANT_RANGE_TO_MS,
			timeZone: "Asia/Kuala_Lumpur",
			interval: "day",
			previousFrom: MERCHANT_RANGE_FROM_MS - 2 * DAY_MS,
			previousTo: MERCHANT_RANGE_FROM_MS,
		},
		currency: "MYR",
		firstBillAt: MERCHANT_RANGE_FROM_MS - 30 * DAY_MS,
		totals: {
			salesMinor: compared(250_000, 200_000),
			bills: compared(10, 9),
			averageBillMinor: compared(25_000, 22_222),
			claims: compared(20, 0),
			redemptions: compared(15, 12),
			conversionRate: compared(75, 75),
			customers: compared(8, 6),
		},
		series: [
			{
				start: MERCHANT_RANGE_FROM_MS,
				end: MERCHANT_RANGE_FROM_MS + DAY_MS,
				isPartial: false,
				salesMinor: 100_000,
				bills: 4,
				averageBillMinor: 25_000,
				claims: 8,
				redemptions: 6,
			},
			{
				start: MERCHANT_RANGE_FROM_MS + DAY_MS,
				end: MERCHANT_RANGE_TO_MS,
				isPartial: false,
				salesMinor: 150_000,
				bills: 6,
				averageBillMinor: 25_000,
				claims: 12,
				redemptions: 9,
			},
		],
		byStore: [
			{ locationId: STORE_A.id, name: STORE_A.name, city: "KUALA_LUMPUR", salesMinor: 200_000, bills: 8, averageBillMinor: 25_000, redemptions: 12 },
			{ locationId: STORE_B.id, name: STORE_B.name, city: null, salesMinor: 50_000, bills: 2, averageBillMinor: 25_000, redemptions: 3 },
		],
		byReward: [
			{ rewardId: "ca5e4873-45fa-4124-b24b-14ef2df21d7c", title: "Free refill", claims: 12, redemptions: 10, conversionRate: 83.3 },
			{ rewardId: "da5e4873-45fa-4124-b24b-14ef2df21d7d", title: "Pastry deal", claims: 8, redemptions: 5, conversionRate: 62.5 },
		],
		byRedemptionMethod: [
			{ method: "SCAN", redemptions: 12 },
			{ method: "MANUAL", redemptions: 3 },
		],
		...overrides,
	});
}
