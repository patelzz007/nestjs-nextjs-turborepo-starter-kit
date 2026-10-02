import { UNCATEGORISED_MERCHANT_CATEGORY_LABEL, type AdminSalesAnalyticsResponse, type SalesSummary } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { formatShareOfTotal, hasSalesInPeriod, merchantCategoryLabel, toTopMerchantRows } from "@/lib/analytics/sales-analytics";
import { buildAdminSalesAnalytics, buildSalesSummary } from "@/test/sales-analytics-fixtures";

/** Intl separates the currency symbol from the amount with a no-break space. */
const NBSP = "\u00a0";

describe("hasSalesInPeriod", () => {
	it("is true with at least one bill", () => {
		expect(hasSalesInPeriod(buildSalesSummary())).toBe(true);
	});

	it("is false without bills, even when the previous period had some", () => {
		const sales: SalesSummary = buildSalesSummary({ bills: { value: 0, changePercent: -100 } });
		expect(hasSalesInPeriod(sales)).toBe(false);
	});
});

describe("merchantCategoryLabel", () => {
	it("uses the shared business category label", () => {
		expect(merchantCategoryLabel("cafe")).toBe("Café");
	});

	it("labels a merchant without a category", () => {
		expect(merchantCategoryLabel(null)).toBe(UNCATEGORISED_MERCHANT_CATEGORY_LABEL);
	});
});

describe("formatShareOfTotal", () => {
	it("formats the share with one decimal at most", () => {
		expect(formatShareOfTotal(4_253, 10_000)).toBe("42.5%");
		expect(formatShareOfTotal(1, 4)).toBe("25%");
	});

	it("is 0% when the total is zero", () => {
		expect(formatShareOfTotal(0, 0)).toBe("0%");
	});
});

describe("toTopMerchantRows", () => {
	it("formats sales in ringgit, bills, category and share of the platform total", () => {
		const response: AdminSalesAnalyticsResponse = buildAdminSalesAnalytics();
		const rows = toTopMerchantRows(response);

		expect(rows).toEqual([
			{ organizationId: response.topMerchants[0]?.organizationId, name: "Sunrise Café", categoryLabel: "Café", sales: `RM${NBSP}7,500.00`, bills: "1,200", share: "75%" },
			{
				organizationId: response.topMerchants[1]?.organizationId,
				name: "Corner Shop",
				categoryLabel: UNCATEGORISED_MERCHANT_CATEGORY_LABEL,
				sales: `RM${NBSP}2,500.00`,
				bills: "300",
				share: "25%",
			},
		]);
	});

	it("returns no rows when no merchant had a bill", () => {
		expect(toTopMerchantRows(buildAdminSalesAnalytics({ topMerchants: [] }))).toEqual([]);
	});
});
