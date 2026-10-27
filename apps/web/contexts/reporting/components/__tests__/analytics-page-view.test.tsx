// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { flushUrlUpdates } from "@workspace/client/testing/flush-url-updates";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import type { CustomerAnalyticsDashboard, Envelope } from "@workspace/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardAnalyticsPageView, type DashboardAnalyticsPageViewProps } from "@/contexts/reporting/components/analytics-page-view";
import { ROUTES } from "@/lib/routes";
import { buildCustomerDashboard } from "@/test-support/analytics-dashboard";
import { testEnvelope } from "@/test-support/envelope";

interface DashboardQueryOptions {
	readonly initialData?: Envelope<CustomerAnalyticsDashboard>;
}

const mocks = vi.hoisted(() => ({
	dashboardQuery: vi.fn<(input: object, options?: DashboardQueryOptions) => object>(),
	refetch: vi.fn(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { claims: { analyticsDashboard: { useQuery: mocks.dashboardQuery } } } }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/navigation")>()),
}));

/** Recharts' ResponsiveContainer observes its size; jsdom has no ResizeObserver. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

/** 5 Oct 2026 12:00 UTC — "last 30 days" is 6 Sep – 5 Oct. */
const NOW_MS = Date.UTC(2026, 9, 5, 12);
const DEFAULT_FROM = Date.UTC(2026, 8, 6);
const DEFAULT_TO = Date.UTC(2026, 9, 6);

function ready(dashboard: CustomerAnalyticsDashboard = buildCustomerDashboard()): object {
	return { data: testEnvelope(dashboard), error: null, isFetching: false, isPlaceholderData: false, refetch: mocks.refetch };
}

function spaced(value: string | null | undefined): string {
	return (value ?? "").replace(/\s/g, " ");
}

function renderView(props: Partial<DashboardAnalyticsPageViewProps> = {}): void {
	render(<DashboardAnalyticsPageView nowMs={NOW_MS} {...props} />, { wrapper: ClientTestProviders });
}

function lastCall(): readonly [input: object, options?: DashboardQueryOptions | undefined] {
	const call = mocks.dashboardQuery.mock.lastCall;
	if (call === undefined) throw new Error("the dashboard was never queried");
	return call;
}

/** The range input of the latest dashboard query. */
function lastInput(): object {
	const [input] = lastCall();
	return input;
}

/** The query options of the latest dashboard query. */
function lastOptions(): DashboardQueryOptions | undefined {
	const [, options] = lastCall();
	return options;
}

/** Opens a labelled filter menu and picks an option (the shared DropdownMenu). */
async function chooseFilter(label: string, option: string): Promise<void> {
	// The range controls are their own `next/dynamic` chunk: wait for it, not just the first render.
	fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${label} `) }));
	fireEvent.click(await screen.findByRole("menuitemradio", { name: option }));
}

// The range controls are a `next/dynamic` chunk. Its first load is Vite transforming that module tree on
// demand, which takes far longer on a busy CI runner than on a warm laptop. Load it once up front so every
// test's lazy import resolves from the module cache and no assertion depends on machine speed.
beforeAll(async (): Promise<void> => {
	await import("@workspace/client/lib/contexts/reporting/analytics-range-controls");
});

beforeEach((): void => {
	window.history.replaceState(null, "", ROUTES.dashboard.activity);
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: true,
		media: query,
		addEventListener: (): void => undefined,
		removeEventListener: (): void => undefined,
	}));
	mocks.dashboardQuery.mockReturnValue({ data: undefined, error: null, isFetching: true, isPlaceholderData: false, refetch: mocks.refetch });
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
	vi.unstubAllGlobals();
});

describe("DashboardAnalyticsPageView", () => {
	it("queries the last 30 UTC days and shows spending, rewards, charts and breakdowns", () => {
		mocks.dashboardQuery.mockReturnValue(ready());
		renderView();

		expect(lastInput()).toEqual({ from: DEFAULT_FROM, to: DEFAULT_TO, interval: "day" });
		expect(screen.getByRole("heading", { name: "My Activity" })).toBeTruthy();

		const spending = within(screen.getByRole("group", { name: "Your spending" }));
		expect(spending.getAllByText((_content, element) => spaced(element?.textContent) === "RM 42.00").length).toBeGreaterThan(0);
		expect(spending.getAllByText("+40%").map((change) => change.textContent)).toEqual(["Up +40%", "Up +40%"]);
		const rewards = within(screen.getByRole("group", { name: "Your rewards" }));
		expect(rewards.getByText("-25%").textContent).toBe("Down -25%");

		const referrals = within(screen.getByRole("group", { name: "Your referrals" }));
		expect(referrals.getByText("Referrals sent")).toBeTruthy();
		expect(referrals.getByText("Rewards earned")).toBeTruthy();
		expect(referrals.getAllByText("No data in the previous period")).toHaveLength(1);
		expect(
			within(screen.getByRole("list", { name: "Claims by status" }))
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["Waiting to be used125%", "Redeemed375%", "Expired00%"]);

		for (const chart of ["Spending over time", "Claimed vs redeemed", "Your top shops over time"]) {
			expect(screen.getByRole("table", { name: chart })).toBeTruthy();
		}
		expect(
			within(screen.getByRole("table", { name: "Your top shops over time" }))
				.getAllByRole("columnheader")
				.map((header) => header.textContent),
		).toEqual([UI_KIT_LABELS_EN.timeSeriesChart.period, "Teh Tarik House", "Brew & Bean"]);
		expect(within(screen.getByRole("list", { name: "Shops ranked by your spending" })).getAllByRole("listitem")).toHaveLength(2);
		const [topCategory] = within(screen.getByRole("list", { name: "Shop categories ranked by your spending" })).getAllByRole("listitem");
		expect(spaced(topCategory?.textContent)).toContain("Beverage");
		// Customers see their own activity only — there is nothing to export.
		expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
	});

	it("keeps the range in the URL and requeries when a preset is picked", async (): Promise<void> => {
		mocks.dashboardQuery.mockReturnValue(ready());
		renderView();

		await chooseFilter(UI_KIT_LABELS_EN.analyticsRangePicker.range, "Last 7 days");
		await flushUrlUpdates();

		expect(window.location.search).toBe("?range=last7Days");
		expect(lastInput()).toEqual({ from: Date.UTC(2026, 8, 29), to: DEFAULT_TO, interval: "day" });
	});

	it("seeds the first render with the server's answer for the same range only", () => {
		const data = testEnvelope(buildCustomerDashboard());
		renderView({ initialDashboard: { stateKey: `${String(DEFAULT_FROM)}|${String(DEFAULT_TO)}|day|`, data } });
		expect(lastOptions()?.initialData).toEqual(data);
		cleanup();

		renderView({ initialDashboard: { stateKey: "another-range", data } });
		expect(lastOptions()?.initialData).toBeUndefined();
	});

	it("guides a customer with no spending to the rewards", () => {
		mocks.dashboardQuery.mockReturnValue(ready(buildCustomerDashboard({ spendingByMerchant: [], spendingByCategory: [] })));
		renderView();

		expect(screen.getByText("No spending yet")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Browse rewards" }).getAttribute("href")).toBe(ROUTES.dashboard.browse);
	});

	it("shows an error with a retry when the activity cannot load", () => {
		mocks.dashboardQuery.mockReturnValue({ data: undefined, error: new Error("HTTP 503"), isFetching: false, isPlaceholderData: false, refetch: mocks.refetch });
		renderView();

		const [alert] = screen.getAllByRole("alert");
		expect(alert?.textContent).toContain("Your activity is unavailable right now.");
		fireEvent.click(within(alert ?? document.body).getByRole("button", { name: "Try again" }));
		expect(mocks.refetch).toHaveBeenCalledTimes(1);
	});
});
