// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AdminSalesAnalyticsResponseSchema, createApiSuccessEnvelopeSchema, type AdminSalesAnalyticsResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSalesPeriodQuery } from "@/lib/analytics/sales-period";
import { ROUTES } from "@/lib/routes";
import { buildAdminSalesAnalytics, buildSalesSummary } from "@/test/sales-analytics-fixtures";

import SalesAnalyticsPanel from "../sales-analytics-panel";

/** Only the query fields the panel reads. */
interface SalesQueryStub {
	readonly data: { readonly data: AdminSalesAnalyticsResponse } | undefined;
	readonly error: Error | null;
	readonly isFetching: boolean;
	readonly refetch: () => Promise<void>;
}

const { salesQuery, refetch, push } = vi.hoisted(() => ({
	salesQuery: vi.fn(),
	refetch: vi.fn(),
	push: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { rewardsAdmin: { salesAnalytics: { useQuery: salesQuery } } } }),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): object => ({ push }),
}));

const NOW_MS = 1_793_059_200_000;
const QUERY = resolveSalesPeriodQuery(8, NOW_MS);

function queryResult(overrides: Partial<SalesQueryStub>): SalesQueryStub {
	return { data: undefined, error: null, isFetching: false, refetch, ...overrides };
}

function renderPanel(): void {
	render(<SalesAnalyticsPanel weeks={8} query={QUERY} />);
}

beforeEach((): void => {
	refetch.mockResolvedValue(undefined);
});

afterEach((): void => {
	cleanup();
	salesQuery.mockReset();
	refetch.mockReset();
	push.mockReset();
});

describe("SalesAnalyticsPanel", () => {
	it("queries the server-resolved period and shows the headline numbers", () => {
		salesQuery.mockReturnValue(queryResult({ data: { data: buildAdminSalesAnalytics() } }));
		renderPanel();

		expect(salesQuery).toHaveBeenCalledWith(QUERY, {});
		expect(screen.getByRole("heading", { name: "Sales" })).toBeTruthy();
		expect(screen.getByText("RM 10,000.00")).toBeTruthy();
		expect(screen.getByText("1,500")).toBeTruthy();
		expect(screen.getByText("RM 6.67")).toBeTruthy();
		expect(screen.getByText("Active merchants")).toBeTruthy();
		expect(screen.getByText("Weekly sales")).toBeTruthy();
	});

	it("lists the top merchants with category and share of sales", () => {
		salesQuery.mockReturnValue(queryResult({ data: { data: buildAdminSalesAnalytics() } }));
		renderPanel();

		const table = within(screen.getByRole("table"));
		expect(table.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Merchant", "Category", "Sales", "Bills", "Share"]);
		const sunrise = within(table.getByText("Sunrise Café").closest("tr") ?? document.body);
		expect(sunrise.getByText("Café")).toBeTruthy();
		expect(sunrise.getByText("RM 7,500.00")).toBeTruthy();
		expect(sunrise.getByText("75%")).toBeTruthy();
		const corner = within(table.getByText("Corner Shop").closest("tr") ?? document.body);
		expect(corner.getByText("Other")).toBeTruthy();
		expect(corner.getByText("25%")).toBeTruthy();
	});

	it("shows an empty state instead of the chart and table when the period has no bills", () => {
		const noBills = buildAdminSalesAnalytics({
			sales: buildSalesSummary({ totalSalesMinor: { value: 0, changePercent: -100 }, bills: { value: 0, changePercent: -100 }, overTime: [] }),
			topMerchants: [],
		});
		salesQuery.mockReturnValue(queryResult({ data: { data: noBills } }));
		renderPanel();

		expect(screen.getByText("No sales in this period")).toBeTruthy();
		expect(screen.queryByRole("table")).toBeNull();
		expect(screen.queryByText("Weekly sales")).toBeNull();
		expect(screen.getByText("RM 0.00")).toBeTruthy();
	});

	it("renders skeletons while the first load is in flight", () => {
		salesQuery.mockReturnValue(queryResult({ isFetching: true }));
		renderPanel();

		expect(screen.getByText("Total sales")).toBeTruthy();
		expect(screen.getByText("Top merchants")).toBeTruthy();
		expect(screen.queryByText("Sunrise Café")).toBeNull();
		expect(screen.queryByText("Couldn't load sales analytics")).toBeNull();
	});

	it("shows the error with a retry that refetches", () => {
		salesQuery.mockReturnValue(queryResult({ error: new Error("Service unavailable") }));
		renderPanel();

		expect(screen.getByText("Couldn't load sales analytics")).toBeTruthy();
		expect(screen.getByText("Service unavailable")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("keeps the last numbers visible when a background refetch fails", () => {
		salesQuery.mockReturnValue(queryResult({ data: { data: buildAdminSalesAnalytics() }, error: new Error("Network error") }));
		renderPanel();

		expect(screen.getByText("RM 10,000.00")).toBeTruthy();
		expect(screen.queryByText("Couldn't load sales analytics")).toBeNull();
	});

	it("puts a new period in the URL", () => {
		salesQuery.mockReturnValue(queryResult({ data: { data: buildAdminSalesAnalytics() } }));
		renderPanel();

		const period = screen.getByLabelText("Period");
		expect(period).toHaveProperty("value", "8");
		fireEvent.change(period, { target: { value: "12" } });
		expect(push).toHaveBeenCalledWith(`${ROUTES.analytics.sales}?weeks=12`, { scroll: false });
	});

	it("drops the default period from the URL", () => {
		salesQuery.mockReturnValue(queryResult({ data: { data: buildAdminSalesAnalytics() } }));
		render(<SalesAnalyticsPanel weeks={12} query={resolveSalesPeriodQuery(12, NOW_MS)} />);

		fireEvent.change(screen.getByLabelText("Period"), { target: { value: "8" } });
		expect(push).toHaveBeenCalledWith(ROUTES.analytics.sales, { scroll: false });
	});

	it("ignores a period value that is not a preset", () => {
		salesQuery.mockReturnValue(queryResult({ data: { data: buildAdminSalesAnalytics() } }));
		renderPanel();

		fireEvent.change(screen.getByLabelText("Period"), { target: { value: "5" } });
		expect(push).not.toHaveBeenCalled();
	});

	it("seeds the query with the server's own envelope, stamped with the server's answer time", () => {
		const envelope = createApiSuccessEnvelopeSchema(AdminSalesAnalyticsResponseSchema).parse({
			success: true,
			data: buildAdminSalesAnalytics(),
			meta: { correlationId: "corr-1", timestamp: NOW_MS },
		});
		salesQuery.mockReturnValue(queryResult({ data: envelope }));
		render(<SalesAnalyticsPanel weeks={8} query={QUERY} initialAnalytics={envelope} />);

		expect(salesQuery).toHaveBeenCalledWith(QUERY, { initialData: envelope, initialDataUpdatedAt: NOW_MS });
	});
});
