import {
	PLATFORM_DISPLAY_REGION,
	UNCATEGORISED_MERCHANT_CATEGORY_LABEL,
	type SaleCurrency,
	type UserSpendByCategory,
	type UserSpendByMerchant,
	type UserSpendingSummary,
} from "@workspace/shared";
import { formatMinorUnits } from "@workspace/ui/lib/format/money";
import { describe, expect, it } from "vitest";

import {
	formatSharePercent,
	formatVisitCount,
	getSpendCategoryLabel,
	MAX_CATEGORY_SLICES,
	shareOfTotalPercent,
	toCategorySpendSlices,
	toMerchantSpendRows,
	toSpendingSectionState,
} from "@/lib/rewards/spending-insights";

const CURRENCY: SaleCurrency = "MYR";
const LOCALE = PLATFORM_DISPLAY_REGION.locale;

function buildMerchantSpend(overrides: Partial<UserSpendByMerchant> = {}): UserSpendByMerchant {
	return {
		organizationId: "7f0c3c1e-2d4b-4a8e-9b1a-2f3c4d5e6f70",
		merchantName: "Kopi Corner",
		category: "cafe",
		totalMinor: 5_000,
		visits: 2,
		...overrides,
	};
}

function buildSpendingSummary(overrides: Partial<UserSpendingSummary> = {}): UserSpendingSummary {
	return {
		currency: "MYR",
		totalSpentMinor: { value: 5_000, changePercent: 25 },
		visits: { value: 2, changePercent: null },
		byMerchant: [buildMerchantSpend()],
		byCategory: [buildCategorySpend()],
		...overrides,
	};
}

function buildCategorySpend(overrides: Partial<UserSpendByCategory> = {}): UserSpendByCategory {
	return { category: "cafe", totalMinor: 5_000, visits: 2, ...overrides };
}

describe("getSpendCategoryLabel", () => {
	it("uses the shared business-category label", () => {
		expect(getSpendCategoryLabel("cafe")).toBe("Café");
		expect(getSpendCategoryLabel("restaurant")).toBe("Restaurant");
	});

	it("labels uncategorised spend as Other", () => {
		expect(getSpendCategoryLabel(null)).toBe(UNCATEGORISED_MERCHANT_CATEGORY_LABEL);
	});
});

describe("shareOfTotalPercent", () => {
	it("returns the rounded whole-number share", () => {
		expect(shareOfTotalPercent(1, 3)).toBe(33);
		expect(shareOfTotalPercent(2, 3)).toBe(67);
	});

	it("returns 0 when there is no total, instead of dividing by zero", () => {
		expect(shareOfTotalPercent(0, 0)).toBe(0);
		expect(shareOfTotalPercent(500, 0)).toBe(0);
	});

	it("never exceeds 100", () => {
		expect(shareOfTotalPercent(150, 100)).toBe(100);
	});
});

describe("formatSharePercent", () => {
	it("formats a share as a percentage", () => {
		expect(formatSharePercent(1, 4)).toBe("25%");
	});

	it("shows a real but tiny share as <1% rather than 0%", () => {
		expect(formatSharePercent(1, 1_000)).toBe("<1%");
	});

	it("shows 0% when nothing was spent", () => {
		expect(formatSharePercent(0, 1_000)).toBe("0%");
		expect(formatSharePercent(0, 0)).toBe("0%");
	});
});

describe("formatVisitCount", () => {
	it("uses the singular for one visit", () => {
		expect(formatVisitCount(1, LOCALE)).toBe("1 visit");
	});

	it("uses the plural otherwise", () => {
		expect(formatVisitCount(0, LOCALE)).toBe("0 visits");
		expect(formatVisitCount(4, LOCALE)).toBe("4 visits");
	});

	it("groups the count in the given locale", () => {
		expect(formatVisitCount(1_234, LOCALE)).toBe("1,234 visits");
		expect(formatVisitCount(1_234, "de-DE")).toBe("1.234 visits");
	});
});

describe("toMerchantSpendRows", () => {
	it("maps each merchant to formatted display data with its share of total spend", () => {
		const rows = toMerchantSpendRows(
			[buildMerchantSpend({ totalMinor: 7_500, visits: 3 }), buildMerchantSpend({ merchantName: "Nasi Lemak Hub", category: null, totalMinor: 2_500, visits: 1 })],
			10_000,
			CURRENCY,
			LOCALE,
		);

		expect(rows).toEqual([
			expect.objectContaining({
				merchantName: "Kopi Corner",
				categoryLabel: "Café",
				amountLabel: formatMinorUnits(7_500, CURRENCY, LOCALE),
				visitsLabel: "3 visits",
				sharePercent: 75,
				shareLabel: "75%",
			}),
			expect.objectContaining({
				merchantName: "Nasi Lemak Hub",
				categoryLabel: "Other",
				amountLabel: formatMinorUnits(2_500, CURRENCY, LOCALE),
				visitsLabel: "1 visit",
				sharePercent: 25,
				shareLabel: "25%",
			}),
		]);
	});

	it("keeps the API's highest-spend-first order", () => {
		const rows = toMerchantSpendRows(
			[buildMerchantSpend({ merchantName: "First", totalMinor: 900 }), buildMerchantSpend({ merchantName: "Second", totalMinor: 100 })],
			1_000,
			CURRENCY,
			LOCALE,
		);

		expect(rows.map((row) => row.merchantName)).toEqual(["First", "Second"]);
	});

	it("returns no rows when there is no spend", () => {
		expect(toMerchantSpendRows([], 0, CURRENCY, LOCALE)).toEqual([]);
	});
});

describe("toCategorySpendSlices", () => {
	it("gives each category a slice with a fixed-order palette tone", () => {
		const slices = toCategorySpendSlices(
			[buildCategorySpend({ category: "restaurant", totalMinor: 6_000 }), buildCategorySpend({ category: null, totalMinor: 4_000, visits: 1 })],
			10_000,
			CURRENCY,
			LOCALE,
		);

		expect(slices).toEqual([
			expect.objectContaining({
				key: "restaurant",
				label: "Restaurant",
				detail: undefined,
				tone: "chart-1",
				sharePercent: 60,
				shareLabel: "60%",
				amountLabel: formatMinorUnits(6_000, CURRENCY, LOCALE),
			}),
			expect.objectContaining({ key: "uncategorised", label: "Other", tone: "chart-2", sharePercent: 40, visitsLabel: "1 visit" }),
		]);
	});

	it("leaves out categories with nothing spent", () => {
		const slices = toCategorySpendSlices(
			[buildCategorySpend({ totalMinor: 1_000 }), buildCategorySpend({ category: "retail", totalMinor: 0, visits: 0 })],
			1_000,
			CURRENCY,
			LOCALE,
		);

		expect(slices.map((slice) => slice.label)).toEqual(["Café"]);
	});

	it("folds the tail into one slice once there are more categories than palette colours", () => {
		const rows: UserSpendByCategory[] = [
			buildCategorySpend({ category: "restaurant", totalMinor: 3_000, visits: 3 }),
			buildCategorySpend({ category: "cafe", totalMinor: 2_500, visits: 2 }),
			buildCategorySpend({ category: "retail", totalMinor: 2_000, visits: 2 }),
			buildCategorySpend({ category: "wellness", totalMinor: 1_500, visits: 1 }),
			buildCategorySpend({ category: "food", totalMinor: 600, visits: 2 }),
			buildCategorySpend({ category: null, totalMinor: 400, visits: 1 }),
		];

		const slices = toCategorySpendSlices(rows, 10_000, CURRENCY, LOCALE);

		expect(slices).toHaveLength(MAX_CATEGORY_SLICES);
		expect(slices.map((slice) => slice.tone)).toEqual(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]);
		expect(slices.at(-1)).toEqual(
			expect.objectContaining({ key: "more-categories", label: "2 more categories", detail: "Food, Other", totalMinor: 1_000, visitsLabel: "3 visits", sharePercent: 10 }),
		);
	});

	it("does not fold when the categories exactly fill the palette", () => {
		const categories: UserSpendByCategory[] = [
			buildCategorySpend({ category: "restaurant" }),
			buildCategorySpend({ category: "cafe" }),
			buildCategorySpend({ category: "retail" }),
			buildCategorySpend({ category: "wellness" }),
			buildCategorySpend({ category: "food" }),
		];

		const slices = toCategorySpendSlices(categories, 25_000, CURRENCY, LOCALE);

		expect(slices.map((slice) => slice.detail)).toEqual([undefined, undefined, undefined, undefined, undefined]);
		expect(slices.at(-1)?.label).toBe("Food");
	});
});

describe("toSpendingSectionState", () => {
	it("is loading until the analytics arrive", () => {
		expect(toSpendingSectionState(undefined, LOCALE)).toEqual({ status: "loading" });
	});

	it("is empty when there were no paid bills, but still carries the zero totals and their trend", () => {
		const state = toSpendingSectionState(
			buildSpendingSummary({ totalSpentMinor: { value: 0, changePercent: -100 }, visits: { value: 0, changePercent: -100 }, byMerchant: [], byCategory: [] }),
			LOCALE,
		);

		expect(state).toEqual({
			status: "empty",
			totals: { totalSpentLabel: formatMinorUnits(0, CURRENCY, LOCALE), totalSpentChangePercent: -100, visitsLabel: "0", visitsChangePercent: -100 },
		});
	});

	it("is ready with formatted totals, merchant rows and category slices when there was spend", () => {
		const state = toSpendingSectionState(buildSpendingSummary(), LOCALE);

		expect(state.status).toBe("ready");
		if (state.status !== "ready") {
			return;
		}
		expect(state.totals).toEqual({ totalSpentLabel: formatMinorUnits(5_000, CURRENCY, LOCALE), totalSpentChangePercent: 25, visitsLabel: "2", visitsChangePercent: null });
		expect(state.merchants.map((row) => row.shareLabel)).toEqual(["100%"]);
		expect(state.categories.map((slice) => slice.label)).toEqual(["Café"]);
	});
});
