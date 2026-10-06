// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { apiDownloads, ApiDownloadError, type DownloadedFile } from "@workspace/client/lib/api/download";
import { createApiSuccessEnvelopeSchema, AdminAnalyticsDashboardSchema, type AdminAnalyticsDashboard, type Envelope } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformAnalyticsDashboard } from "@/components/analytics/platform-analytics-dashboard";
import { buildAdminDashboard } from "@/test/analytics-dashboard-fixtures";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

/** Only the query fields the dashboard reads. */
interface DashboardQueryStub {
	readonly data: Envelope<AdminAnalyticsDashboard> | undefined;
	readonly error: Error | null;
	readonly isFetching: boolean;
	readonly isPlaceholderData: boolean;
	readonly refetch: () => Promise<void>;
}

const mocks = vi.hoisted(() => ({
	dashboardQuery: vi.fn<(input: object, options?: object) => object>(),
	download: vi.fn(),
	saveDownloadedFile: vi.fn(),
	refetch: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { rewardsAdmin: { analyticsDashboard: { useQuery: mocks.dashboardQuery } }, download: mocks.download } }),
}));

vi.mock("@workspace/client/lib/api/download", async (importOriginal) => ({
	...(await importOriginal<typeof import("@workspace/client/lib/api/download")>()),
	saveDownloadedFile: mocks.saveDownloadedFile,
}));

// `useSearchParams` reads the address bar, as Next.js does once its History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

/** 5 Oct 2026 12:00 UTC — "last 30 days" is 6 Sep – 5 Oct. */
const NOW_MS = Date.UTC(2026, 9, 5, 12);
const DEFAULT_FROM = Date.UTC(2026, 8, 6);
const DEFAULT_TO = Date.UTC(2026, 9, 6);
const DEFAULT_KEY = `${String(DEFAULT_FROM)}|${String(DEFAULT_TO)}|day|`;

const EnvelopeSchema = createApiSuccessEnvelopeSchema(AdminAnalyticsDashboardSchema);

function envelope(dashboard: AdminAnalyticsDashboard): Envelope<AdminAnalyticsDashboard> {
	return EnvelopeSchema.parse({ success: true, data: dashboard, meta: { correlationId: "test", timestamp: NOW_MS } });
}

function queryResult(overrides: Partial<DashboardQueryStub>): DashboardQueryStub {
	return { data: undefined, error: null, isFetching: false, isPlaceholderData: false, refetch: mocks.refetch, ...overrides };
}

function spaced(value: string | null): string {
	return (value ?? "").replace(/\s/g, " ");
}

function renderDashboard(props: Partial<React.ComponentProps<typeof PlatformAnalyticsDashboard>> = {}): () => void {
	const { rerender } = render(<PlatformAnalyticsDashboard nowMs={NOW_MS} {...props} />, { wrapper: UiKitTestProviders });
	// The URL changed through the History API; re-render so `useSearchParams` reads it (Next does this itself).
	return (): void => {
		rerender(<PlatformAnalyticsDashboard nowMs={NOW_MS} {...props} />);
	};
}

function lastQueryInput(): object {
	const call = mocks.dashboardQuery.mock.lastCall;
	if (call === undefined) throw new Error("the dashboard was never queried");
	return call[0];
}

/** Opens a labelled filter menu and picks an option (the shared DropdownMenu). */
async function chooseFilter(label: string, option: string): Promise<void> {
	fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label} `) }));
	fireEvent.click(await screen.findByRole("menuitemradio", { name: option }));
}

beforeEach((): void => {
	window.history.replaceState(null, "", "/analytics");
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: true,
		media: query,
		addEventListener: (): void => undefined,
		removeEventListener: (): void => undefined,
	}));
	vi.spyOn(toastMessage, "success").mockImplementation(() => "toast");
	vi.spyOn(toastMessage, "error").mockImplementation(() => "toast");
	mocks.refetch.mockResolvedValue(undefined);
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("PlatformAnalyticsDashboard", () => {
	it("queries the last 30 UTC days by default and shows every KPI group, chart and breakdown", () => {
		mocks.dashboardQuery.mockReturnValue(queryResult({ data: envelope(buildAdminDashboard()) }));
		renderDashboard();

		expect(lastQueryInput()).toEqual({ from: DEFAULT_FROM, to: DEFAULT_TO, interval: "day" });
		expect(screen.getByRole("heading", { name: "Analytics" })).toBeTruthy();

		const sales = within(screen.getByRole("group", { name: "Sales" }));
		expect(sales.getAllByText((_content, element) => spaced(element?.textContent ?? null) === "RM 10,000.00").length).toBeGreaterThan(0);
		// The direction is words and an icon, never colour alone.
		expect(sales.getByText("+25%").textContent).toBe("Up +25%");
		const rewards = within(screen.getByRole("group", { name: "Rewards" }));
		expect(rewards.getByText("No data in the previous period")).toBeTruthy();
		expect(within(screen.getByRole("group", { name: "Customers" })).getByText("New customers")).toBeTruthy();

		for (const chart of ["Sales over time", "Bills over time", "Claims and redemptions", "New vs returning customers"]) {
			expect(screen.getByRole("table", { name: chart })).toBeTruthy();
		}
		const merchants = within(screen.getByRole("list", { name: "Merchants ranked by sales" })).getAllByRole("listitem");
		expect(spaced(merchants[0]?.textContent ?? null)).toContain("Sunrise Café");
		expect(spaced(merchants[0]?.textContent ?? null)).toContain("Café · 1,200 bills · avg RM 6.25 · 75% of sales");
		expect(spaced(within(screen.getByRole("list", { name: "Cities ranked by sales" })).getByRole("listitem").textContent)).toContain("Kuala Lumpur");
	});

	it("seeds the query with the server prefetch only for the exact range it answered", async (): Promise<void> => {
		const prefetched = envelope(buildAdminDashboard());
		mocks.dashboardQuery.mockReturnValue(queryResult({ data: prefetched }));
		const refresh = renderDashboard({ initialDashboard: { stateKey: DEFAULT_KEY, data: prefetched } });

		expect(mocks.dashboardQuery.mock.lastCall?.[1]).toMatchObject({ initialData: prefetched });

		await chooseFilter("Date range", "Last month");
		refresh();

		expect(lastQueryInput()).toEqual({ from: Date.UTC(2026, 8, 1), to: Date.UTC(2026, 9, 1), interval: "day" });
		expect(mocks.dashboardQuery.mock.lastCall?.[1]).not.toHaveProperty("initialData");
	});

	it("reads and writes the range in the URL, so a shared link opens the same view", async (): Promise<void> => {
		window.history.replaceState(null, "", "/analytics?range=custom&from=2026-01-01&to=2026-06-30&interval=month");
		mocks.dashboardQuery.mockReturnValue(queryResult({ data: envelope(buildAdminDashboard()) }));
		const refresh = renderDashboard();

		expect(lastQueryInput()).toEqual({ from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 6, 1), interval: "month" });
		expect(screen.getByRole("button", { name: /^Date range / }).textContent).toBe("Custom range");

		await chooseFilter("Group by", "Week");
		refresh();

		expect(decodeURIComponent(window.location.search)).toBe("?range=custom&from=2026-01-01&to=2026-06-30&interval=week");
		expect(lastQueryInput()).toEqual({ from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 6, 1), interval: "week" });
	});

	it("exports the range on screen in the chosen format and saves the server's file", async () => {
		const file: DownloadedFile = { blob: new Blob(["%PDF"]), fileName: "analytics_platform_2026-09-06_2026-10-05_day.pdf", contentType: "application/pdf" };
		mocks.dashboardQuery.mockReturnValue(queryResult({ data: envelope(buildAdminDashboard()) }));
		mocks.download.mockResolvedValue(file);
		renderDashboard();

		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "PDF" }));

		await waitFor((): void => {
			expect(mocks.saveDownloadedFile).toHaveBeenCalledWith(file);
		});
		expect(mocks.download).toHaveBeenCalledWith(apiDownloads.rewardsAdmin.analyticsExport, { from: DEFAULT_FROM, to: DEFAULT_TO, interval: "day", format: "pdf" });
	});

	it("tells the admin how long to wait when the export limit is reached", async () => {
		mocks.dashboardQuery.mockReturnValue(queryResult({ data: envelope(buildAdminDashboard()) }));
		mocks.download.mockRejectedValue(new ApiDownloadError({ code: "ANALYTICS_EXPORT_RATE_LIMITED", statusCode: 429, message: "Too many exports", retryAfterSeconds: 240 }));
		renderDashboard();

		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "CSV" }));

		await waitFor((): void => {
			expect(toastMessage.error).toHaveBeenCalledWith({ title: "Export limit reached", description: "You can start 10 exports every 10 minutes. Try again in 4 minutes." });
		});
		expect(mocks.saveDownloadedFile).not.toHaveBeenCalled();
	});

	it("shows an error with a retry in every chart when the first load fails", () => {
		mocks.dashboardQuery.mockReturnValue(queryResult({ error: new Error("Service unavailable") }));
		renderDashboard();

		const alerts = screen.getAllByRole("alert");
		expect(alerts.length).toBeGreaterThan(0);
		expect(alerts[0]?.textContent).toContain("Service unavailable");
		act((): void => {
			fireEvent.click(within(alerts[0] ?? document.body).getByRole("button", { name: "Try again" }));
		});
		expect(mocks.refetch).toHaveBeenCalledTimes(1);
	});

	it("shows empty states when the range has no activity", () => {
		const quiet = buildAdminDashboard({ topMerchants: [], byCategory: [], byCity: [], series: [] });
		mocks.dashboardQuery.mockReturnValue(queryResult({ data: envelope(quiet) }));
		renderDashboard();

		expect(screen.getAllByText("No paid bills in this range. Bills appear once merchants' POS systems report them.").length).toBeGreaterThan(0);
		expect(screen.queryByRole("list", { name: "Merchants ranked by sales" })).toBeNull();
	});
});
