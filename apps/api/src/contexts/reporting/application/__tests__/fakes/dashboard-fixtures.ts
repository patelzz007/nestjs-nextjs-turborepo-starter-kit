import { EpochMsSchema, type AdminAnalyticsDashboard, type MerchantAnalyticsDashboard } from "@workspace/shared";

/** 2026-09-01 00:00 and 2026-10-01 00:00 in Kuala Lumpur. */
export const FIXTURE_FROM = EpochMsSchema.parse(Date.UTC(2026, 7, 31, 16));
export const FIXTURE_TO = EpochMsSchema.parse(Date.UTC(2026, 8, 30, 16));

const RANGE = {
	from: FIXTURE_FROM,
	to: FIXTURE_TO,
	timeZone: "Asia/Kuala_Lumpur",
	interval: "week",
	previousFrom: EpochMsSchema.parse(FIXTURE_FROM - (FIXTURE_TO - FIXTURE_FROM)),
	previousTo: FIXTURE_FROM,
} satisfies MerchantAnalyticsDashboard["range"];
const ZERO = { value: 0, previous: 0, change: 0, changePercent: null };

export const MERCHANT_DASHBOARD_FIXTURE: MerchantAnalyticsDashboard = {
	range: RANGE,
	currency: "MYR",
	firstBillAt: null,
	totals: { salesMinor: ZERO, bills: ZERO, averageBillMinor: ZERO, claims: ZERO, redemptions: ZERO, conversionRate: ZERO, customers: ZERO },
	series: [{ start: FIXTURE_FROM, end: FIXTURE_TO, isPartial: true, salesMinor: 0, bills: 0, averageBillMinor: 0, claims: 0, redemptions: 0 }],
	byStore: [{ locationId: null, name: null, city: null, salesMinor: 0, bills: 0, averageBillMinor: 0, redemptions: 0 }],
	byReward: [],
	byRedemptionMethod: [
		{ method: "SCAN", redemptions: 0 },
		{ method: "MANUAL", redemptions: 0 },
	],
};

export const ADMIN_DASHBOARD_FIXTURE: AdminAnalyticsDashboard = {
	range: { ...RANGE, timeZone: "UTC" },
	currency: "MYR",
	totals: {
		salesMinor: ZERO,
		bills: ZERO,
		averageBillMinor: ZERO,
		claims: ZERO,
		redemptions: ZERO,
		conversionRate: ZERO,
		activeMerchants: ZERO,
		customers: ZERO,
		newCustomers: ZERO,
		returningCustomers: ZERO,
	},
	series: [],
	topMerchants: [],
	byCategory: [],
	byCity: [],
};
