// @vitest-environment jsdom
import { cleanup, getDefaultNormalizer, render, screen } from "@testing-library/react";
import { epochMs, PLATFORM_DISPLAY_REGION, type UserRewardsAnalyticsResponse } from "@workspace/shared";
import { formatMinorUnits } from "@workspace/ui/lib/format/money";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RewardHubAnalyticsPageView } from "@/components/rewardhub/shared/analytics-page-view";
import { testEnvelope } from "@/test-support/envelope";

interface AnalyticsEnvelopeStub {
	readonly data: UserRewardsAnalyticsResponse;
}

interface AnalyticsQueryStub {
	readonly data: AnalyticsEnvelopeStub | undefined;
	readonly isLoading: boolean;
}

/** The second `useQuery` argument — only `initialData` (SSR hydration) matters here. */
interface AnalyticsQueryOptionsStub {
	readonly initialData?: AnalyticsEnvelopeStub;
}

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

/** Keep Intl's no-break space after "RM" intact when matching formatted amounts. */
const KEEP_SPACES = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

const PERIOD_FROM = 1_788_000_000_000;
const PERIOD_TO = 1_790_592_000_000;

const { analyticsUseQuery } = vi.hoisted(() => ({
	analyticsUseQuery: vi.fn<(input: object, options: AnalyticsQueryOptionsStub) => AnalyticsQueryStub>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): { readonly api: { readonly claims: { readonly analytics: { readonly useQuery: typeof analyticsUseQuery } } } } => ({
		api: { claims: { analytics: { useQuery: analyticsUseQuery } } },
	}),
}));

function buildAnalytics(overrides: Partial<UserRewardsAnalyticsResponse> = {}): UserRewardsAnalyticsResponse {
	const metric = { value: 0, changePercent: null };
	return {
		period: { from: epochMs(PERIOD_FROM), to: epochMs(PERIOD_TO), timeZone: "UTC" },
		totalClaims: { value: 3, changePercent: null },
		pendingClaims: metric,
		redeemedClaims: { value: 3, changePercent: null },
		expiredClaims: metric,
		referralsSent: metric,
		referralsCredited: metric,
		conversionRate: { value: 100, changePercent: null },
		claimsOverTime: [],
		byStatus: [{ status: "REDEEMED", count: 3 }],
		spending: {
			currency: "MYR",
			totalSpentMinor: { value: 4_200, changePercent: null },
			visits: { value: 3, changePercent: null },
			byMerchant: [{ organizationId: "2d0b4c6a-8e3f-4a51-8c1d-3e4f5a6b7c82", merchantName: "Teh Tarik House", category: "beverage", totalMinor: 4_200, visits: 3 }],
			byCategory: [{ category: "beverage", totalMinor: 4_200, visits: 3 }],
		},
		...overrides,
	};
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	analyticsUseQuery.mockReset();
	vi.unstubAllGlobals();
});

describe("RewardHubAnalyticsPageView", () => {
	it("keeps the spending section busy while the analytics load", () => {
		analyticsUseQuery.mockReturnValue({ data: undefined, isLoading: true });

		render(<RewardHubAnalyticsPageView />);

		expect(screen.getByRole("heading", { name: "My Activity" })).toBeDefined();
		expect(screen.getByRole("region", { name: "Your spending" }).getAttribute("aria-busy")).toBe("true");
	});

	it("shows where the user spent the most and what they spent on once loaded", () => {
		analyticsUseQuery.mockReturnValue({ data: { data: buildAnalytics() }, isLoading: false });

		render(<RewardHubAnalyticsPageView />);

		expect(screen.getByRole("region", { name: "Your spending" }).getAttribute("aria-busy")).toBe("false");
		expect(screen.getByText("Where you spent the most")).toBeDefined();
		expect(screen.getByText("What you spent on")).toBeDefined();
		expect(screen.getByText("Teh Tarik House")).toBeDefined();
		expect(screen.getAllByText(formatMinorUnits(4_200, "MYR", PLATFORM_DISPLAY_REGION.locale), KEEP_SPACES).length).toBeGreaterThan(0);
		expect(screen.getByRole("list", { name: "Spending by category" }).textContent).toContain("Beverage");
	});

	it("renders server-prefetched analytics immediately, without a loading state", () => {
		// Like TanStack Query: hydrated `initialData` is the data from the first render.
		analyticsUseQuery.mockImplementation((_input: object, options: AnalyticsQueryOptionsStub): AnalyticsQueryStub => ({ data: options.initialData, isLoading: false }));

		render(<RewardHubAnalyticsPageView initialAnalytics={testEnvelope(buildAnalytics())} />);

		expect(screen.getByRole("region", { name: "Your spending" }).getAttribute("aria-busy")).toBe("false");
	});

	it("shows the empty-spending guidance when there were no paid bills", () => {
		const analytics = buildAnalytics();
		analyticsUseQuery.mockReturnValue({
			data: {
				data: {
					...analytics,
					spending: { ...analytics.spending, totalSpentMinor: { value: 0, changePercent: null }, visits: { value: 0, changePercent: null }, byMerchant: [], byCategory: [] },
				},
			},
			isLoading: false,
		});

		render(<RewardHubAnalyticsPageView />);

		expect(screen.getByText("Spending shows up after you redeem a reward at a participating shop.")).toBeDefined();
		expect(screen.queryByText("Where you spent the most")).toBeNull();
	});
});
