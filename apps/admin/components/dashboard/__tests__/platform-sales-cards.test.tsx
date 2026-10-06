// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type AdminAnalyticsDashboard, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformSalesCards } from "@/components/dashboard/platform-sales-cards";
import { ROUTES } from "@/lib/routes";
import { buildAdminDashboard } from "@/test/analytics-dashboard-fixtures";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

/** Only the query fields the cards read. */
interface DashboardQueryStub {
	readonly data: { readonly data: AdminAnalyticsDashboard } | undefined;
	readonly isError: boolean;
	readonly refetch: () => Promise<void>;
}

const { dashboardQuery, refetch } = vi.hoisted(() => ({ dashboardQuery: vi.fn(), refetch: vi.fn() }));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { rewardsAdmin: { analyticsDashboard: { useQuery: dashboardQuery } } } }),
}));

function queryResult(overrides: Partial<DashboardQueryStub>): DashboardQueryStub {
	return { data: undefined, isError: false, refetch, ...overrides };
}

function renderCards(capabilities: readonly CapabilitySlug[]): void {
	render(
		<CapabilitiesProvider capabilities={capabilities}>
			<PlatformSalesCards />
		</CapabilitiesProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

function spaced(value: string | null): string {
	return (value ?? "").replace(/\s/g, " ");
}

beforeEach((): void => {
	// jsdom has no matchMedia; the chart reads prefers-reduced-motion through it.
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: true,
		media: query,
		addEventListener: (): void => undefined,
		removeEventListener: (): void => undefined,
	}));
});

afterEach((): void => {
	cleanup();
	dashboardQuery.mockReset();
	refetch.mockReset();
	vi.unstubAllGlobals();
});

describe("PlatformSalesCards", () => {
	it("shows the last 30 days' sales KPIs with ANALYTICS read, from the API's default range", () => {
		dashboardQuery.mockReturnValue(queryResult({ data: { data: buildAdminDashboard() } }));
		renderCards([PERMISSION.ANALYTICS.READ]);

		expect(dashboardQuery).toHaveBeenCalledWith({});
		expect(screen.getByRole("heading", { name: "Platform sales" })).toBeTruthy();
		const kpis = within(screen.getByRole("group", { name: "Platform sales" }));
		expect(kpis.getAllByText((_content, element) => spaced(element?.textContent ?? null) === "RM 10,000.00").length).toBeGreaterThan(0);
		expect(kpis.getByText("Active merchants")).toBeTruthy();
		expect(screen.getByRole("link", { name: "View analytics" }).getAttribute("href")).toBe(ROUTES.analytics.index);
	});

	it("charts the daily sales of the same response, with every value in its table", () => {
		dashboardQuery.mockReturnValue(queryResult({ data: { data: buildAdminDashboard() } }));
		renderCards([PERMISSION.ANALYTICS.READ]);

		const table = screen.getByRole("table", { name: "Sales per day" });
		expect(
			within(table)
				.getAllByRole("row")
				.map((row) => spaced(row.textContent)),
		).toEqual(["PeriodSales", "Tue, 1 Sept 2026RM 4,000.00", "Wed, 2 Sept 2026(partial)RM 6,000.00"]);
		expect(dashboardQuery).toHaveBeenCalledTimes(1);
	});

	it("is hidden, and never queries, without ANALYTICS read", () => {
		renderCards([PERMISSION.GEO.READ]);

		expect(screen.queryByRole("heading", { name: "Platform sales" })).toBeNull();
		expect(dashboardQuery).not.toHaveBeenCalled();
	});

	it("renders skeleton cards while loading", () => {
		dashboardQuery.mockReturnValue(queryResult({}));
		renderCards([PERMISSION.ANALYTICS.READ]);

		expect(screen.getByText("Sales")).toBeTruthy();
		// No amount rendered yet (recharts' off-screen measurement span is not a card).
		expect(screen.queryAllByText(/RM/).filter((element) => element.id !== "recharts_measurement_span")).toEqual([]);
		expect(screen.queryByRole("table")).toBeNull();
	});

	it("offers a retry when the first load fails", () => {
		refetch.mockResolvedValue(undefined);
		dashboardQuery.mockReturnValue(queryResult({ isError: true }));
		renderCards([PERMISSION.ANALYTICS.READ]);

		expect(screen.getByRole("alert").textContent).toContain("Couldn't load platform sales.");
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalledTimes(1);
	});
});
