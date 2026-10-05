import { AdminAnalyticsDashboardSchema, type AdminAnalyticsDashboard, type AnalyticsComparison } from "@workspace/shared";

const DAY_MS = 86_400_000;
/** 1 Sep 2026 00:00 UTC — the range's first day. */
export const RANGE_FROM_MS = Date.UTC(2026, 8, 1);
/** Two whole UTC days later (exclusive). */
export const RANGE_TO_MS = RANGE_FROM_MS + 2 * DAY_MS;

function compared(value: number, previous: number): AnalyticsComparison {
	return { value, previous, change: value - previous, changePercent: previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10 };
}

/**
 * `GET /admin/analytics/dashboard`: RM 10,000.00 over 1,500 bills in two daily
 * buckets (the second partial), two top merchants, one category and one city.
 * Overrides are merged BEFORE parsing, so a test can never build a response
 * the schema would reject.
 */
export function buildAdminDashboard(overrides: Partial<AdminAnalyticsDashboard> = {}): AdminAnalyticsDashboard {
	return AdminAnalyticsDashboardSchema.parse({
		range: { from: RANGE_FROM_MS, to: RANGE_TO_MS, timeZone: "UTC", interval: "day", previousFrom: RANGE_FROM_MS - 2 * DAY_MS, previousTo: RANGE_FROM_MS },
		currency: "MYR",
		totals: {
			salesMinor: compared(1_000_000, 800_000),
			bills: compared(1_500, 1_000),
			averageBillMinor: compared(667, 800),
			claims: compared(300, 0),
			redemptions: compared(240, 200),
			conversionRate: compared(80, 80),
			activeMerchants: compared(2, 1),
			customers: compared(900, 700),
			newCustomers: compared(400, 300),
			returningCustomers: compared(500, 400),
		},
		series: [
			{
				start: RANGE_FROM_MS,
				end: RANGE_FROM_MS + DAY_MS,
				isPartial: false,
				salesMinor: 400_000,
				bills: 600,
				averageBillMinor: 667,
				claims: 120,
				redemptions: 100,
				newCustomers: 150,
				returningCustomers: 200,
			},
			{
				start: RANGE_FROM_MS + DAY_MS,
				end: RANGE_TO_MS,
				isPartial: true,
				salesMinor: 600_000,
				bills: 900,
				averageBillMinor: 667,
				claims: 180,
				redemptions: 140,
				newCustomers: 250,
				returningCustomers: 300,
			},
		],
		topMerchants: [
			{ organizationId: "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11", name: "Sunrise Café", category: "cafe", salesMinor: 750_000, bills: 1_200, averageBillMinor: 625 },
			{ organizationId: "9b1d2e4f-1c2d-4e5f-8a9b-0c1d2e3f4a5b", name: "Corner Shop", category: null, salesMinor: 250_000, bills: 300, averageBillMinor: 833 },
		],
		byCategory: [{ category: "cafe", salesMinor: 750_000, bills: 1_200, merchants: 1 }],
		byCity: [{ city: "KUALA_LUMPUR", salesMinor: 1_000_000, bills: 1_500, merchants: 2 }],
		...overrides,
	});
}
