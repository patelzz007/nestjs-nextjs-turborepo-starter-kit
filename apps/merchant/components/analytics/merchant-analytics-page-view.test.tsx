// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeClaimsChartPeriod, MerchantAnalyticsPageView, truncateAxisLabel } from "@/components/analytics/merchant-analytics-page-view";
import { orgRoutes } from "@/lib/routes";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, twoStoreSeed, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_B } from "@/test/terminals";
import { testEnvelope } from "@/test/envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { epochMs, MerchantAnalyticsResponseSchema, SalesSummarySchema, type AnalyticsMetric, type Envelope, type MerchantAnalyticsResponse } from "@workspace/shared";

const PERIOD_FROM = epochMs(1_788_220_800_000);
const PERIOD_TO = epochMs(1_793_059_200_000);
const ZERO: AnalyticsMetric = { value: 0, changePercent: null };

/** Parsed through the shared contract, so a new required field fails here loudly instead of slipping past the fixture. */
function buildAnalytics(sales: MerchantAnalyticsResponse["sales"]): MerchantAnalyticsResponse {
	return MerchantAnalyticsResponseSchema.parse({
		period: { from: PERIOD_FROM, to: PERIOD_TO, timeZone: "Asia/Kuala_Lumpur" },
		totalRewards: { value: 3, changePercent: null },
		activeRewards: { value: 2, changePercent: null },
		totalClaims: ZERO,
		totalRedemptions: ZERO,
		conversionRate: ZERO,
		referralCount: ZERO,
		claimsOverTime: [],
		topRewards: [],
		sales,
	});
}

const WITH_SALES = buildAnalytics(
	SalesSummarySchema.parse({
		currency: "MYR",
		totalSalesMinor: { value: 250_000, changePercent: 25 },
		bills: { value: 10, changePercent: 11 },
		averageBillMinor: { value: 25_000, changePercent: 12 },
		overTime: [{ date: PERIOD_FROM, salesMinor: 250_000, bills: 10 }],
		firstBillAt: PERIOD_FROM,
	}),
);

const WITHOUT_SALES = buildAnalytics(
	SalesSummarySchema.parse({
		currency: "MYR",
		totalSalesMinor: ZERO,
		bills: ZERO,
		averageBillMinor: ZERO,
		overTime: [],
		firstBillAt: null,
	}),
);

type AnalyticsInput = Parameters<typeof apiRouter.organizations.analytics.queryKey>[0];

interface AnalyticsQueryOptions {
	readonly initialData?: Envelope<MerchantAnalyticsResponse>;
}

const { analyticsQuery, contextQuery } = vi.hoisted(() => ({
	analyticsQuery: vi.fn<(input: AnalyticsInput, options?: AnalyticsQueryOptions) => object>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: { organizations: { analytics: { useQuery: analyticsQuery }, context: { useQuery: contextQuery } } },
	}),
}));

beforeEach((): void => {
	analyticsQuery.mockReturnValue({ data: undefined, isLoading: true });
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
});

afterEach((): void => {
	cleanup();
	analyticsQuery.mockReset();
	contextQuery.mockReset();
});

/** The cache key of the analytics query's first render — what SSR data must be stored under. */
function firstRenderQuery(): { readonly key: ReturnType<typeof apiRouter.organizations.analytics.queryKey>; readonly options: AnalyticsQueryOptions | undefined } {
	const [input, options] = analyticsQuery.mock.calls.at(0) ?? [];
	expect(input).toBeDefined();
	return { key: input === undefined ? [] : apiRouter.organizations.analytics.queryKey(input), options };
}

describe("MerchantAnalyticsPageView authorization", () => {
	it("renders analytics with merchant:view_analytics", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByRole("heading", { name: "Analytics" })).toBeTruthy();
		expect(analyticsQuery).toHaveBeenCalled();
	});

	it("denies the page and skips the analytics query without the capability", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "MEMBER" });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(analyticsQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { isLoading: true });

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(analyticsQuery).not.toHaveBeenCalled();
	});
});

describe("MerchantAnalyticsPageView sales", () => {
	it("shows the sales section ahead of the reward analytics", () => {
		analyticsQuery.mockReturnValue({ data: { data: WITH_SALES }, isLoading: false });
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
		expect(headings.slice(0, 2)).toEqual(["Sales", "Rewards & engagement"]);
		expect(screen.getByText("RM 2,500.00")).toBeTruthy();
		expect(screen.getByText("RM 250.00")).toBeTruthy();
	});

	it("links an owner without bills to the API keys page", () => {
		analyticsQuery.mockReturnValue({ data: { data: WITHOUT_SALES }, isLoading: false });
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByText("No sales yet")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Set up API keys" }).getAttribute("href")).toBe(orgRoutes(TEST_ORG_SLUG).apiKeys);
	});

	it("does not offer the API keys link to a cashier, who cannot manage keys", () => {
		analyticsQuery.mockReturnValue({ data: { data: WITHOUT_SALES }, isLoading: false });
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByText("No sales yet")).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Set up API keys" })).toBeNull();
	});
});

describe("MerchantAnalyticsPageView failures and copy", () => {
	it("shows an error state with a retry instead of endless skeletons when analytics fail to load", () => {
		const refetch = vi.fn();
		analyticsQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByText("Could not load analytics")).toBeTruthy();
		screen.getByRole("button", { name: "Try again" }).click();
		expect(refetch).toHaveBeenCalled();
	});

	it("describes the chart period the API answered for, not a hard-coded window", () => {
		analyticsQuery.mockReturnValue({ data: { data: WITH_SALES }, isLoading: false });
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByText("Weekly performance over the last 8 weeks")).toBeTruthy();
		expect(describeClaimsChartPeriod({ from: PERIOD_FROM, to: epochMs(PERIOD_FROM + 3 * 604_800_000 - 1), timeZone: "Asia/Kuala_Lumpur" })).toBe(
			"Weekly performance over the last 3 weeks",
		);
		expect(describeClaimsChartPeriod({ from: PERIOD_FROM, to: epochMs(PERIOD_FROM + 1), timeZone: "Asia/Kuala_Lumpur" })).toBe("Weekly performance over the last 1 week");
	});

	it("shortens long reward titles on the chart axis", () => {
		expect(truncateAxisLabel("Free latte")).toBe("Free latte");
		expect(truncateAxisLabel("Buy one get one free croissant")).toBe("Buy one get one…");
	});
});

describe("MerchantAnalyticsPageView server prefetch (no double fetch)", () => {
	it("seeds the first render with the server's analytics when they were fetched for the store the client filters by", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} initialAnalytics={{ locationId: STORE_B.id, data: testEnvelope(WITH_SALES) }} />, {
			role: "CASHIER",
			tenantContext: twoStoreSeed(STORE_B.id),
		});

		const { key, options } = firstRenderQuery();
		expect(key).toEqual(apiRouter.organizations.analytics.queryKey({ orgSlug: TEST_ORG_SLUG, locationId: STORE_B.id }));
		expect(options?.initialData?.data).toEqual(WITH_SALES);
	});

	it("seeds the all-stores view only with all-stores data", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} initialAnalytics={{ locationId: undefined, data: testEnvelope(WITH_SALES) }} />, {
			role: "CASHIER",
			tenantContext: twoStoreSeed(null),
		});

		const { key, options } = firstRenderQuery();
		expect(key).toEqual(apiRouter.organizations.analytics.queryKey({ orgSlug: TEST_ORG_SLUG, locationId: undefined }));
		expect(options?.initialData?.data).toEqual(WITH_SALES);
	});

	it("never caches another store's analytics under the client's key — the query fetches instead", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} initialAnalytics={{ locationId: undefined, data: testEnvelope(WITH_SALES) }} />, {
			role: "CASHIER",
			tenantContext: twoStoreSeed(STORE_B.id),
		});

		const { key, options } = firstRenderQuery();
		expect(key).toEqual(apiRouter.organizations.analytics.queryKey({ orgSlug: TEST_ORG_SLUG, locationId: STORE_B.id }));
		expect(options?.initialData).toBeUndefined();
	});
});
