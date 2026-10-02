import { AdminSalesAnalyticsResponseSchema, type AdminSalesAnalyticsResponse, type SalesSummary } from "@workspace/shared";

const PERIOD_FROM_MS = 1_788_220_800_000;
const PERIOD_TO_MS = 1_793_059_200_000;
const WEEK_MS = 604_800_000;

/** A platform sales summary: RM 10,000.00 over 1,500 bills, two weekly points. */
export function buildSalesSummary(overrides: Partial<SalesSummary> = {}): SalesSummary {
	const base = AdminSalesAnalyticsResponseSchema.shape.sales.parse({
		currency: "MYR",
		totalSalesMinor: { value: 1_000_000, changePercent: 20 },
		bills: { value: 1_500, changePercent: -10 },
		averageBillMinor: { value: 667, changePercent: 33 },
		overTime: [
			{ date: PERIOD_FROM_MS, salesMinor: 400_000, bills: 600 },
			{ date: PERIOD_FROM_MS + WEEK_MS, salesMinor: 600_000, bills: 900 },
		],
	});
	return { ...base, ...overrides };
}

/** `GET /admin/analytics/sales` response with two top merchants (75% / 25% of sales). */
export function buildAdminSalesAnalytics(overrides: Partial<AdminSalesAnalyticsResponse> = {}): AdminSalesAnalyticsResponse {
	const base = AdminSalesAnalyticsResponseSchema.parse({
		period: { from: PERIOD_FROM_MS, to: PERIOD_TO_MS },
		sales: buildSalesSummary(),
		activeMerchants: { value: 2, changePercent: 100 },
		topMerchants: [
			{ organizationId: "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11", name: "Sunrise Café", category: "cafe", salesMinor: 750_000, bills: 1_200 },
			{ organizationId: "9b1d2e4f-1c2d-4e5f-8a9b-0c1d2e3f4a5b", name: "Corner Shop", category: null, salesMinor: 250_000, bills: 300 },
		],
	});
	return { ...base, ...overrides };
}
