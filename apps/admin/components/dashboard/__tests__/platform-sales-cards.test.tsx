// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type AdminSalesAnalyticsResponse, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlatformSalesCards } from "@/components/dashboard/platform-sales-cards";
import { ROUTES } from "@/lib/routes";
import { buildAdminSalesAnalytics } from "@/test/sales-analytics-fixtures";

/** Only the query fields the cards read. */
interface SalesQueryStub {
	readonly data: { readonly data: AdminSalesAnalyticsResponse } | undefined;
	readonly isError: boolean;
	readonly refetch: () => Promise<void>;
}

const { salesQuery, refetch } = vi.hoisted(() => ({ salesQuery: vi.fn(), refetch: vi.fn() }));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { rewardsAdmin: { salesAnalytics: { useQuery: salesQuery } } } }),
}));

function queryResult(overrides: Partial<SalesQueryStub>): SalesQueryStub {
	return { data: undefined, isError: false, refetch, ...overrides };
}

function renderCards(capabilities: readonly CapabilitySlug[]): void {
	render(
		<CapabilitiesProvider capabilities={capabilities}>
			<PlatformSalesCards />
		</CapabilitiesProvider>,
	);
}

afterEach((): void => {
	cleanup();
	salesQuery.mockReset();
	refetch.mockReset();
});

describe("PlatformSalesCards", () => {
	it("shows real platform sales for the API's default period with ANALYTICS read", () => {
		salesQuery.mockReturnValue(queryResult({ data: { data: buildAdminSalesAnalytics() } }));
		renderCards([PERMISSION.ANALYTICS.READ]);

		expect(salesQuery).toHaveBeenCalledWith({});
		expect(screen.getByRole("heading", { name: "Platform sales" })).toBeTruthy();
		expect(screen.getByText("RM 10,000.00")).toBeTruthy();
		expect(screen.getByText("Active merchants")).toBeTruthy();
		expect(screen.getByRole("link", { name: "View sales analytics" }).getAttribute("href")).toBe(ROUTES.analytics.sales);
	});

	it("charts the real weekly sales of the same response below the cards", () => {
		salesQuery.mockReturnValue(queryResult({ data: { data: buildAdminSalesAnalytics() } }));
		renderCards([PERMISSION.ANALYTICS.READ]);

		expect(screen.getByText("Weekly sales")).toBeTruthy();
		expect(screen.getByText("Paid bill totals per week, last 8 weeks")).toBeTruthy();
		expect(salesQuery).toHaveBeenCalledTimes(1);
	});

	it("is hidden, and never queries, without ANALYTICS read", () => {
		renderCards([PERMISSION.GEO.READ]);

		expect(screen.queryByRole("heading", { name: "Platform sales" })).toBeNull();
		expect(salesQuery).not.toHaveBeenCalled();
	});

	it("renders skeleton cards while loading", () => {
		salesQuery.mockReturnValue(queryResult({}));
		renderCards([PERMISSION.ANALYTICS.READ]);

		expect(screen.getByText("Total sales")).toBeTruthy();
		// No amount rendered yet (recharts' off-screen measurement span is not a card).
		expect(screen.queryAllByText(/RM/).filter((element) => element.id !== "recharts_measurement_span")).toEqual([]);
	});

	it("offers a retry when the first load fails", () => {
		refetch.mockResolvedValue(undefined);
		salesQuery.mockReturnValue(queryResult({ isError: true }));
		renderCards([PERMISSION.ANALYTICS.READ]);

		expect(screen.getByRole("alert").textContent).toContain("Couldn't load platform sales.");
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalledTimes(1);
	});
});
