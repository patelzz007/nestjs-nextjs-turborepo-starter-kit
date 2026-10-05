import { analyticsFormatters } from "@workspace/client/lib/analytics/analytics-presentation";
import { describe, expect, it } from "vitest";

import { MAX_SHOP_TREND_SERIES, spendCategoryLabel, toClaimStatusSegments, toCategoryItems, toShopItems, toShopTrend } from "@/lib/rewards/customer-analytics";
import { BREW_BEAN_ID, buildCustomerDashboard, CUSTOMER_RANGE_FROM_MS, TEH_TARIK_ID } from "@/test-support/analytics-dashboard";

const FORMATTERS = analyticsFormatters("MYR", "en-MY");
const DAY_MS = 86_400_000;

function spaced(value: string | undefined): string {
	return (value ?? "").replace(/\s/g, " ");
}

describe("spendCategoryLabel", () => {
	it("names a category and reads uncategorised spend as Other", () => {
		expect(spendCategoryLabel("beverage")).toBe("Beverage");
		expect(spendCategoryLabel(null)).toBe("Other");
	});
});

describe("toShopItems / toCategoryItems", () => {
	it("rank shops with category, visits and share of the customer's spending", () => {
		expect(toShopItems(buildCustomerDashboard(), FORMATTERS).map((item) => [item.label, spaced(item.valueLabel), item.detail])).toEqual([
			["Teh Tarik House", "RM 30.00", "Beverage · 2 visits · 71.4% of your spending"],
			["Brew & Bean", "RM 12.00", "Other · 1 visit · 28.6% of your spending"],
		]);
	});

	it("rank categories the same way", () => {
		expect(toCategoryItems(buildCustomerDashboard(), FORMATTERS).map((item) => [item.key, item.label, item.detail])).toEqual([
			["beverage", "Beverage", "2 visits · 71.4% of your spending"],
			["uncategorised", "Other", "1 visit · 28.6% of your spending"],
		]);
	});
});

describe("toShopTrend", () => {
	it("draws one line per top shop on the main series' buckets, missing buckets as zero", () => {
		const trend = toShopTrend(buildCustomerDashboard());

		expect(trend.series).toEqual([
			{ key: TEH_TARIK_ID, label: "Teh Tarik House", color: "chart-1" },
			{ key: BREW_BEAN_ID, label: "Brew & Bean", color: "chart-2" },
		]);
		expect(trend.points.map((point) => [point.start, point.isPartial, point.values[TEH_TARIK_ID], point.values[BREW_BEAN_ID]])).toEqual([
			[CUSTOMER_RANGE_FROM_MS, false, 0, 1_200],
			[CUSTOMER_RANGE_FROM_MS + DAY_MS, true, 3_000, 0],
		]);
		expect(trend.isEmpty).toBe(false);
	});

	it(`keeps at most ${String(MAX_SHOP_TREND_SERIES)} shops and is empty without spending`, () => {
		const base = buildCustomerDashboard();
		const shop = base.spendingByMerchant[0];
		if (shop === undefined) throw new Error("fixture missing");
		const many = buildCustomerDashboard({
			spendingByMerchant: ["a", "b", "c", "d", "e"].map((suffix, index) => ({
				...shop,
				organizationId: `${TEH_TARIK_ID.slice(0, -1)}${String(index)}`,
				merchantName: suffix,
			})),
		});

		expect(toShopTrend(many).series).toHaveLength(MAX_SHOP_TREND_SERIES);
		expect(toShopTrend(buildCustomerDashboard({ spendingByMerchant: [] })).isEmpty).toBe(true);
	});
});

describe("toClaimStatusSegments", () => {
	it("lists every status with a fixed colour, its count and share of the range's claims", () => {
		expect(toClaimStatusSegments(buildCustomerDashboard(), FORMATTERS)).toEqual([
			{ key: "PENDING", label: "Waiting to be used", color: "chart-1", value: 1, valueLabel: "1", shareLabel: "25%" },
			{ key: "REDEEMED", label: "Redeemed", color: "chart-2", value: 3, valueLabel: "3", shareLabel: "75%" },
			{ key: "EXPIRED", label: "Expired", color: "chart-3", value: 0, valueLabel: "0", shareLabel: "0%" },
		]);
	});
});
