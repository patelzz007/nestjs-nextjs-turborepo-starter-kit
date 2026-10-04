import { AdminSalesAnalyticsResponseSchema, WEEK_MS, type AdminSalesAnalyticsResponse, type SalesSummary } from "@workspace/shared";

/** Monday 2026-09-07 00:00 UTC — a UTC week start, as the API aligns every period. */
const PERIOD_FROM_MS = Date.UTC(2026, 8, 7);
/** Two weeks later. */
const PERIOD_TO_MS = PERIOD_FROM_MS + 2 * WEEK_MS;

/**
 * A platform sales summary: RM 10,000.00 over 1,500 bills, two weekly points.
 * Overrides are merged BEFORE parsing, so a test can never build a summary
 * the response schema would reject.
 */
export function buildSalesSummary(overrides: Partial<SalesSummary> = {}): SalesSummary {
	return AdminSalesAnalyticsResponseSchema.shape.sales.parse({
		currency: "MYR",
		totalSalesMinor: { value: 1_000_000, changePercent: 20 },
		bills: { value: 1_500, changePercent: -10 },
		averageBillMinor: { value: 667, changePercent: 33 },
		overTime: [
			{ date: PERIOD_FROM_MS, salesMinor: 400_000, bills: 600 },
			{ date: PERIOD_FROM_MS + WEEK_MS, salesMinor: 600_000, bills: 900 },
		],
		firstBillAt: PERIOD_FROM_MS,
		...overrides,
	});
}

/** `GET /admin/analytics/sales` response with two top merchants (75% / 25% of sales); overrides are validated too. */
export function buildAdminSalesAnalytics(overrides: Partial<AdminSalesAnalyticsResponse> = {}): AdminSalesAnalyticsResponse {
	return AdminSalesAnalyticsResponseSchema.parse({
		period: { from: PERIOD_FROM_MS, to: PERIOD_TO_MS, timeZone: "UTC" },
		sales: buildSalesSummary(),
		activeMerchants: { value: 2, changePercent: 100 },
		topMerchants: [
			{ organizationId: "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11", name: "Sunrise Café", category: "cafe", salesMinor: 750_000, bills: 1_200 },
			{ organizationId: "9b1d2e4f-1c2d-4e5f-8a9b-0c1d2e3f4a5b", name: "Corner Shop", category: null, salesMinor: 250_000, bills: 300 },
		],
		...overrides,
	});
}
