// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import { apiDownloads, ApiDownloadError, type DownloadedFile } from "@workspace/client/lib/api/download";
import type { Envelope, MerchantAnalyticsDashboard } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantAnalyticsPageView, type MerchantAnalyticsPageViewProps } from "@/components/analytics/merchant-analytics-page-view";
import { orgRoutes } from "@/lib/routes";
import { buildMerchantDashboard } from "@/test/analytics-dashboard";
import { renderWithAuthorization, TEST_ORG_SLUG, type AuthorizationFixture } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { contextQueryState, twoStoreSeed, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_B } from "@/test/terminals";

const KUALA_LUMPUR = "Asia/Kuala_Lumpur";
/** 5 Oct 2026 12:00 UTC (20:00 in Kuala Lumpur) — "last 30 days" is 6 Sep – 5 Oct there. */
const NOW_MS = Date.UTC(2026, 9, 5, 12);
const KL_OFFSET_MS = 8 * 3_600_000;
const DEFAULT_FROM = Date.UTC(2026, 8, 6) - KL_OFFSET_MS;
const DEFAULT_TO = Date.UTC(2026, 9, 6) - KL_OFFSET_MS;

interface DashboardQueryOptions {
	readonly initialData?: Envelope<MerchantAnalyticsDashboard>;
}

const mocks = vi.hoisted(() => ({
	dashboardQuery: vi.fn<(input: object, options?: DashboardQueryOptions) => object>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
	download: vi.fn(),
	saveDownloadedFile: vi.fn(),
	refetch: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: { organizations: { analyticsDashboard: { useQuery: mocks.dashboardQuery }, context: { useQuery: mocks.contextQuery } }, download: mocks.download },
	}),
}));

vi.mock("@workspace/client/lib/api/download", async (importOriginal) => ({
	...(await importOriginal<typeof import("@workspace/client/lib/api/download")>()),
	saveDownloadedFile: mocks.saveDownloadedFile,
}));

// `useSearchParams` reads the address bar, as Next.js does once its History API integration has synced it.
vi.mock("next/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/navigation")>()),
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

function ready(dashboard: MerchantAnalyticsDashboard = buildMerchantDashboard()): object {
	return { data: testEnvelope(dashboard), error: null, isFetching: false, isPlaceholderData: false, refetch: mocks.refetch };
}

function spaced(value: string | null | undefined): string {
	return (value ?? "").replace(/\s/g, " ");
}

function renderView(props: Partial<MerchantAnalyticsPageViewProps> = {}, fixture: AuthorizationFixture = { role: "CASHIER" }): () => void {
	const { rerender } = renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} nowMs={NOW_MS} timeZone={KUALA_LUMPUR} {...props} />, fixture);
	// The URL changed through the History API; re-render so `useSearchParams` reads it (Next does this itself).
	return (): void => {
		rerender(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} nowMs={NOW_MS} timeZone={KUALA_LUMPUR} {...props} />);
	};
}

function lastCall(): readonly [input: object, options?: DashboardQueryOptions | undefined] {
	const call = mocks.dashboardQuery.mock.lastCall;
	if (call === undefined) throw new Error("the dashboard was never queried");
	return call;
}

/** Opens a labelled filter menu and picks an option (the shared DropdownMenu). */
async function chooseFilter(label: string, option: string): Promise<void> {
	fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label} `) }));
	fireEvent.click(await screen.findByRole("menuitemradio", { name: option }));
}

beforeEach((): void => {
	window.history.replaceState(null, "", `/orgs/${TEST_ORG_SLUG}/analytics`);
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: true,
		media: query,
		addEventListener: (): void => undefined,
		removeEventListener: (): void => undefined,
	}));
	vi.spyOn(toastMessage, "success").mockImplementation(() => "toast");
	vi.spyOn(toastMessage, "error").mockImplementation(() => "toast");
	mocks.dashboardQuery.mockReturnValue({ data: undefined, error: null, isFetching: true, isPlaceholderData: false, refetch: mocks.refetch });
	mocks.contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("MerchantAnalyticsPageView authorization", () => {
	it("renders the dashboard with merchant:view_analytics", () => {
		renderView();

		expect(screen.getByRole("heading", { name: "Analytics" })).toBeTruthy();
		expect(mocks.dashboardQuery).toHaveBeenCalled();
	});

	it("denies the page and skips the query without the capability", () => {
		renderView({}, { role: "MEMBER" });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(mocks.dashboardQuery).not.toHaveBeenCalled();
	});
});

describe("MerchantAnalyticsPageView data", () => {
	it("queries the last 30 days in the merchant's own days and shows KPIs, charts and breakdowns", () => {
		mocks.dashboardQuery.mockReturnValue(ready());
		renderView();

		expect(lastCall()[0]).toEqual({ orgSlug: TEST_ORG_SLUG, from: DEFAULT_FROM, to: DEFAULT_TO, interval: "day", locationId: undefined });
		// The range and the zone its days are cut in.
		expect(screen.getAllByRole("status").map((status) => spaced(status.textContent))).toContain("6 Sept – 5 Oct 2026 · Asia/Kuala_Lumpur");

		const sales = within(screen.getByRole("group", { name: "Sales" }));
		expect(sales.getAllByText((_content, element) => spaced(element?.textContent) === "RM 2,500.00").length).toBeGreaterThan(0);
		expect(sales.getByText("+25%").textContent).toBe("Up +25%");
		expect(within(screen.getByRole("group", { name: "Rewards" })).getByText("No data in the previous period")).toBeTruthy();

		for (const chart of ["Sales over time", "Bills over time", "Average bill", "Claims and redemptions"]) {
			expect(screen.getByRole("table", { name: chart })).toBeTruthy();
		}
		expect(spaced(within(screen.getByRole("list", { name: "Stores ranked by sales" })).getAllByRole("listitem")[0]?.textContent)).toContain("Bangsar");
		expect(within(screen.getByRole("list", { name: "Rewards ranked by claims" })).getAllByRole("listitem")).toHaveLength(2);
		expect(
			within(screen.getByRole("list", { name: "Redemptions by method" }))
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["QR code scan1280%", "Backup code320%"]);
	});

	it("narrows the query and the export to the store picked in the store selector", async () => {
		mocks.dashboardQuery.mockReturnValue(ready());
		mocks.download.mockResolvedValue({ blob: new Blob(["x"]), fileName: "analytics_acme-coffee.csv", contentType: "text/csv" } satisfies DownloadedFile);
		renderView({}, { role: "CASHIER", tenantContext: twoStoreSeed(STORE_B.id) });

		expect(lastCall()[0]).toMatchObject({ locationId: STORE_B.id });

		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "CSV" }));

		await waitFor((): void => {
			expect(mocks.download).toHaveBeenCalledWith(apiDownloads.organizations.analyticsExport, {
				orgSlug: TEST_ORG_SLUG,
				from: DEFAULT_FROM,
				to: DEFAULT_TO,
				interval: "day",
				locationId: STORE_B.id,
				format: "csv",
			});
		});
		expect(mocks.saveDownloadedFile).toHaveBeenCalled();
	});

	it("keeps the range in the URL and requeries for a picked preset", async (): Promise<void> => {
		mocks.dashboardQuery.mockReturnValue(ready());
		const refresh = renderView();

		await chooseFilter(UI_KIT_LABELS_EN.analyticsRangePicker.range, "This month");
		refresh();

		expect(window.location.search).toBe("?range=thisMonth");
		expect(lastCall()[0]).toMatchObject({ from: Date.UTC(2026, 9, 1) - KL_OFFSET_MS, to: DEFAULT_TO, interval: "day" });
	});

	it("shows a timeout as a toast that suggests a shorter range", async () => {
		mocks.dashboardQuery.mockReturnValue(ready());
		mocks.download.mockRejectedValue(new ApiDownloadError({ code: "ANALYTICS_QUERY_TIMEOUT", statusCode: 503, message: "Timeout" }));
		renderView();

		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "Excel (XLSX)" }));

		await waitFor((): void => {
			expect(toastMessage.error).toHaveBeenCalledWith({
				title: "The report took too long",
				description: "Choose a shorter date range or group by week or month, then export again.",
			});
		});
	});
});

describe("MerchantAnalyticsPageView server prefetch (no double fetch)", () => {
	const KEY_ALL_STORES = `${String(DEFAULT_FROM)}|${String(DEFAULT_TO)}|day|`;

	it("seeds the first render with data fetched for the same range and store", () => {
		const data = testEnvelope(buildMerchantDashboard());
		renderView({ initialDashboard: { stateKey: KEY_ALL_STORES, data } }, { role: "CASHIER", tenantContext: twoStoreSeed(null) });

		expect(lastCall()[1]?.initialData).toEqual(data);
	});

	it("never seeds another store's numbers under the client's key", () => {
		const data = testEnvelope(buildMerchantDashboard());
		renderView({ initialDashboard: { stateKey: KEY_ALL_STORES, data } }, { role: "CASHIER", tenantContext: twoStoreSeed(STORE_B.id) });

		expect(lastCall()[1]?.initialData).toBeUndefined();
	});
});

describe("MerchantAnalyticsPageView empty and failure states", () => {
	it("links an owner whose POS never reported a bill to the API keys page", () => {
		mocks.dashboardQuery.mockReturnValue(ready(buildMerchantDashboard({ firstBillAt: null })));
		renderView({}, { role: "OWNER" });

		expect(screen.getByText("No sales yet")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Set up API keys" }).getAttribute("href")).toBe(orgRoutes(TEST_ORG_SLUG).apiKeys);
	});

	it("does not offer the API keys link to a cashier", () => {
		mocks.dashboardQuery.mockReturnValue(ready(buildMerchantDashboard({ firstBillAt: null })));
		renderView();

		expect(screen.getByText("No sales yet")).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Set up API keys" })).toBeNull();
	});

	it("shows an error with a retry instead of endless skeletons", () => {
		mocks.dashboardQuery.mockReturnValue({ data: undefined, error: new Error("HTTP 503"), isFetching: false, isPlaceholderData: false, refetch: mocks.refetch });
		renderView();

		const [alert] = screen.getAllByRole("alert");
		expect(alert?.textContent).toContain("Your analytics are unavailable right now.");
		fireEvent.click(within(alert ?? document.body).getByRole("button", { name: "Try again" }));
		expect(mocks.refetch).toHaveBeenCalledTimes(1);
	});
});
