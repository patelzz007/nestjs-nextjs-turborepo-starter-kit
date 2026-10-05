import { CustomerAnalyticsDashboardSchema, type AnalyticsComparison, type CustomerAnalyticsDashboard } from "@workspace/shared";

const DAY_MS = 86_400_000;
/** 1 Sep 2026 00:00 UTC — the range's first day. */
export const CUSTOMER_RANGE_FROM_MS = Date.UTC(2026, 8, 1);
/** Two UTC days later (exclusive). */
export const CUSTOMER_RANGE_TO_MS = CUSTOMER_RANGE_FROM_MS + 2 * DAY_MS;

export const TEH_TARIK_ID = "2d0b4c6a-8e3f-4a51-8c1d-3e4f5a6b7c82";
export const BREW_BEAN_ID = "3d0b4c6a-8e3f-4a51-8c1d-3e4f5a6b7c83";

function compared(value: number, previous: number): AnalyticsComparison {
	return { value, previous, change: value - previous, changePercent: previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10 };
}

/**
 * `GET /claims/analytics/dashboard`: RM 42.00 over 3 visits at two shops in two
 * UTC days. Overrides are merged BEFORE parsing, so a fixture can never break the contract.
 */
export function buildCustomerDashboard(overrides: Partial<CustomerAnalyticsDashboard> = {}): CustomerAnalyticsDashboard {
	return CustomerAnalyticsDashboardSchema.parse({
		range: {
			from: CUSTOMER_RANGE_FROM_MS,
			to: CUSTOMER_RANGE_TO_MS,
			timeZone: "UTC",
			interval: "day",
			previousFrom: CUSTOMER_RANGE_FROM_MS - 2 * DAY_MS,
			previousTo: CUSTOMER_RANGE_FROM_MS,
		},
		currency: "MYR",
		totals: {
			spentMinor: compared(4_200, 3_000),
			visits: compared(3, 3),
			averageBillMinor: compared(1_400, 1_000),
			claims: compared(4, 0),
			redemptions: compared(3, 2),
			conversionRate: compared(75, 100),
			merchants: compared(2, 1),
			referralsSent: compared(4, 2),
			referralsCredited: compared(2, 0),
			referralRewardsEarned: compared(2, 1),
		},
		series: [
			{ start: CUSTOMER_RANGE_FROM_MS, end: CUSTOMER_RANGE_FROM_MS + DAY_MS, isPartial: false, spentMinor: 1_200, visits: 1, claims: 2, redemptions: 1 },
			{ start: CUSTOMER_RANGE_FROM_MS + DAY_MS, end: CUSTOMER_RANGE_TO_MS, isPartial: true, spentMinor: 3_000, visits: 2, claims: 2, redemptions: 2 },
		],
		spendingByCategory: [
			{
				category: "beverage",
				totalMinor: 3_000,
				visits: 2,
				series: [
					{ start: CUSTOMER_RANGE_FROM_MS, totalMinor: 0 },
					{ start: CUSTOMER_RANGE_FROM_MS + DAY_MS, totalMinor: 3_000 },
				],
			},
			{
				category: null,
				totalMinor: 1_200,
				visits: 1,
				series: [
					{ start: CUSTOMER_RANGE_FROM_MS, totalMinor: 1_200 },
					{ start: CUSTOMER_RANGE_FROM_MS + DAY_MS, totalMinor: 0 },
				],
			},
		],
		spendingByMerchant: [
			{
				organizationId: TEH_TARIK_ID,
				merchantName: "Teh Tarik House",
				category: "beverage",
				totalMinor: 3_000,
				visits: 2,
				series: [
					{ start: CUSTOMER_RANGE_FROM_MS, totalMinor: 0 },
					{ start: CUSTOMER_RANGE_FROM_MS + DAY_MS, totalMinor: 3_000 },
				],
			},
			{
				organizationId: BREW_BEAN_ID,
				merchantName: "Brew & Bean",
				category: null,
				totalMinor: 1_200,
				visits: 1,
				// A shop's series may omit a bucket; it reads as zero.
				series: [{ start: CUSTOMER_RANGE_FROM_MS, totalMinor: 1_200 }],
			},
		],
		claimsByStatus: [
			{ status: "PENDING", claims: 1 },
			{ status: "REDEEMED", claims: 3 },
			{ status: "EXPIRED", claims: 0 },
		],
		...overrides,
	});
}
