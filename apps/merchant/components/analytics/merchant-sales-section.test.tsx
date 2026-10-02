// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { epochMs, type SalesSummary } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { hasNoSalesHistory, MerchantSalesSection } from "@/components/analytics/merchant-sales-section";

const API_KEYS_HREF = "/orgs/acme-coffee/api-keys";
const WEEK_MS = 604_800_000;
const FIRST_WEEK = epochMs(1_788_220_800_000);
const SECOND_WEEK = epochMs(FIRST_WEEK + WEEK_MS);

function buildSales(overrides: Partial<SalesSummary> = {}): SalesSummary {
	return {
		currency: "MYR",
		totalSalesMinor: { value: 1_234_550, changePercent: 12 },
		bills: { value: 42, changePercent: -5 },
		averageBillMinor: { value: 29_394, changePercent: 18 },
		overTime: [
			{ date: FIRST_WEEK, salesMinor: 600_000, bills: 20 },
			{ date: SECOND_WEEK, salesMinor: 634_550, bills: 22 },
		],
		...overrides,
	};
}

const NO_SALES: SalesSummary = buildSales({
	totalSalesMinor: { value: 0, changePercent: null },
	bills: { value: 0, changePercent: null },
	averageBillMinor: { value: 0, changePercent: null },
	overTime: [{ date: FIRST_WEEK, salesMinor: 0, bills: 0 }],
});

afterEach((): void => {
	cleanup();
});

describe("hasNoSalesHistory", () => {
	it("is true when neither this nor the previous period had a bill", () => {
		expect(hasNoSalesHistory(NO_SALES)).toBe(true);
	});

	it("is false when the previous period had bills, even if this one has none", () => {
		expect(hasNoSalesHistory(buildSales({ bills: { value: 0, changePercent: -100 } }))).toBe(false);
	});

	it("is false when this period has bills", () => {
		expect(hasNoSalesHistory(buildSales())).toBe(false);
	});
});

describe("MerchantSalesSection", () => {
	it("shows total sales and average bill in ringgit, the bill count, and each change", () => {
		render(<MerchantSalesSection sales={buildSales()} isLoading={false} apiKeysHref={API_KEYS_HREF} />);

		expect(screen.getByRole("heading", { name: "Sales" })).toBeTruthy();
		expect(screen.getByText("RM 12,345.50")).toBeTruthy();
		expect(screen.getByText("42")).toBeTruthy();
		expect(screen.getByText("RM 293.94")).toBeTruthy();
		expect(screen.getByText("+12%")).toBeTruthy();
		expect(screen.getByText("-5%")).toBeTruthy();
		expect(screen.getByText("+18%")).toBeTruthy();
		expect(screen.getByText("Weekly sales")).toBeTruthy();
		expect(screen.queryByText("No sales yet")).toBeNull();
	});

	it("renders skeleton cards while loading, without values", () => {
		const { container } = render(<MerchantSalesSection sales={undefined} isLoading apiKeysHref={API_KEYS_HREF} />);
		// Scoped to the section: recharts keeps a text-measurement span on <body> between tests.
		const section = within(container);

		expect(section.getByText("Total sales")).toBeTruthy();
		expect(section.getByText("Average bill")).toBeTruthy();
		expect(section.queryByText(/RM/)).toBeNull();
		expect(screen.queryByText("No sales yet")).toBeNull();
	});

	it("explains how sales appear and links to API keys when there are no bills yet", () => {
		render(<MerchantSalesSection sales={NO_SALES} isLoading={false} apiKeysHref={API_KEYS_HREF} />);

		expect(screen.getByText("No sales yet")).toBeTruthy();
		expect(screen.getByText("Sales appear once your POS reports bills through the checkout API.")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Set up API keys" }).getAttribute("href")).toBe(API_KEYS_HREF);
		expect(screen.queryByText("Total sales")).toBeNull();
	});

	it("points to the store owner instead of linking when the member cannot manage API keys", () => {
		render(<MerchantSalesSection sales={NO_SALES} isLoading={false} apiKeysHref={undefined} />);

		expect(screen.getByText(/Ask your store owner to connect your POS/)).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Set up API keys" })).toBeNull();
	});

	it("keeps the cards when only the previous period had bills", () => {
		render(
			<MerchantSalesSection
				sales={buildSales({ totalSalesMinor: { value: 0, changePercent: -100 }, bills: { value: 0, changePercent: -100 } })}
				isLoading={false}
				apiKeysHref={API_KEYS_HREF}
			/>,
		);

		expect(screen.queryByText("No sales yet")).toBeNull();
		expect(screen.getByText("RM 0.00")).toBeTruthy();
	});
});
