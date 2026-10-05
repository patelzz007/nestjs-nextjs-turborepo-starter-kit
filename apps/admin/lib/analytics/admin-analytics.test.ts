import { analyticsFormatters } from "@workspace/client/lib/analytics/analytics-presentation";
import { describe, expect, it } from "vitest";

import { cityLabel, merchantCategoryLabel, toCategoryItems, toCityItems, toTopMerchantItems, UNKNOWN_CITY_LABEL } from "@/lib/analytics/admin-analytics";
import { buildAdminDashboard } from "@/test/analytics-dashboard-fixtures";

const FORMATTERS = analyticsFormatters("MYR", "en-MY");

function spaced(value: string | undefined): string {
	return (value ?? "").replace(/\s/g, " ");
}

describe("labels", () => {
	it("names categories and cities, with a fallback for the unknown ones", () => {
		expect(merchantCategoryLabel("cafe")).toBe("Café");
		expect(merchantCategoryLabel(null)).toBe("Other");
		expect(cityLabel("MELAKA")).toBe("Melaka");
		expect(cityLabel(null)).toBe(UNKNOWN_CITY_LABEL);
	});
});

describe("toTopMerchantItems", () => {
	it("ranks merchants by sales with category, bills, average bill and share of platform sales", () => {
		const items = toTopMerchantItems(buildAdminDashboard(), FORMATTERS);

		expect(items.map((item) => [item.label, item.value, spaced(item.valueLabel), spaced(item.detail)])).toEqual([
			["Sunrise Café", 750_000, "RM 7,500.00", "Café · 1,200 bills · avg RM 6.25 · 75% of sales"],
			["Corner Shop", 250_000, "RM 2,500.00", "Other · 300 bills · avg RM 8.33 · 25% of sales"],
		]);
	});
});

describe("toCategoryItems / toCityItems", () => {
	it("describe each breakdown row with merchants, bills and share", () => {
		const dashboard = buildAdminDashboard({ byCity: [{ city: null, salesMinor: 1_000_000, bills: 1, merchants: 1 }] });

		expect(spaced(toCategoryItems(dashboard, FORMATTERS)[0]?.detail)).toBe("1 merchant · 1,200 bills · 75% of sales");
		const city = toCityItems(dashboard, FORMATTERS)[0];
		expect(city?.label).toBe(UNKNOWN_CITY_LABEL);
		expect(city?.key).toBe("unknown");
		expect(spaced(city?.detail)).toBe("1 merchant · 1 bill · 100% of sales");
	});
});
