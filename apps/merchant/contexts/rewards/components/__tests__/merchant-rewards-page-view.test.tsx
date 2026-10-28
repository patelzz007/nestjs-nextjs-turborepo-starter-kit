// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REWARDS_CATALOG_LOADING_LABELS } from "@/contexts/rewards/components/merchant-rewards-catalog";
import { MerchantRewardsPageView } from "@/contexts/rewards/components/merchant-rewards-page-view";
import { MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME, MERCHANT_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, twoStoreSeed, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A } from "@/test/terminals";
import type { apiRouter } from "@workspace/client/lib/api/endpoints";
import { ApiError } from "@workspace/client/lib/api/use-api";
import { UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { MERCHANT_REWARDS_LOADING_LABELS } from "@/components/loading/merchant-page-skeletons";
import { busyRegionAnnouncements } from "@/test/skeleton";
import { REWARD_CATALOG_PAGE_SIZE } from "@/contexts/rewards/url-state/rewards";
import { rewardFixture } from "@/test/rewards";
import { LIST_SLOT_INDEX } from "@workspace/shared";

type RewardsListInput = Parameters<typeof apiRouter.tenants.rewards.list.queryKey>[0];

interface RewardsListOptions {
	readonly enabled?: boolean;
	readonly staleTime?: number;
	readonly gcTime?: number;
}

type RewardsSummaryInput = Parameters<typeof apiRouter.tenants.rewards.summary.queryKey>[0];

const { rewardsListQuery, prefetchRewards, rewardsSummaryQuery, contextQuery } = vi.hoisted(() => ({
	rewardsListQuery: vi.fn<(input: RewardsListInput, options?: RewardsListOptions) => object>(),
	prefetchRewards: vi.fn<(input: RewardsListInput) => void>(),
	rewardsSummaryQuery: vi.fn<(input: RewardsSummaryInput, options?: RewardsListOptions) => object>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

// A reward card links into the tenant, whose slug comes from the route.
vi.mock("next/navigation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/navigation")>();
	const { TEST_ORG_SLUG: tenantSlug } = await import("@/test/authorization");
	return { ...actual, useParams: (): Record<string, string> => ({ tenantSlug }) };
});

const NO_REWARDS = { countsByStatus: { DRAFT: 0, PENDING_REVIEW: 0, PUBLISHED: 0, EXPIRED: 0, DISABLED: 0 }, unitsRemaining: 0 };

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				rewards: { list: { useQuery: rewardsListQuery, usePrefetch: (): typeof prefetchRewards => prefetchRewards }, summary: { useQuery: rewardsSummaryQuery } },
				context: { useQuery: contextQuery },
			},
		},
	}),
}));

beforeEach((): void => {
	window.history.replaceState(null, "", "/");
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
	rewardsSummaryQuery.mockReturnValue({ isSuccess: true, isPending: false, isError: false, error: null, data: { data: NO_REWARDS }, refetch: vi.fn() });
	rewardsListQuery.mockReturnValue({
		isSuccess: true,
		isPending: false,
		isFetching: false,
		isError: false,
		error: null,
		data: { data: [] },
		refetch: vi.fn(),
	});
});

afterEach((): void => {
	cleanup();
	rewardsListQuery.mockReset();
	prefetchRewards.mockReset();
	rewardsSummaryQuery.mockReset();
	contextQuery.mockReset();
});

describe("MerchantRewardsPageView authorization", () => {
	it("shows create actions to roles with merchant:manage_rewards", () => {
		renderWithAuthorization(<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByRole("link", { name: "New reward" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Create first reward" })).toBeTruthy();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it("hides create actions and shows a read-only notice for view-only roles", () => {
		renderWithAuthorization(<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.queryByRole("link", { name: "New reward" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Create first reward" })).toBeNull();
		expect(screen.getByRole("note").textContent).toContain("view rewards but not create");
	});

	it("denies the page (and skips the list query) without merchant:view_rewards", () => {
		renderWithAuthorization(<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "CASHIER", capabilities: [] });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(rewardsListQuery).not.toHaveBeenCalled();
		expect(rewardsSummaryQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state rather than a denial while the membership resolves", () => {
		renderWithAuthorization(<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />, { isLoading: true });

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_REWARDS_LOADING_LABELS.loading]);
		expect(screen.queryByText("You don't have access to this page")).toBeNull();
		expect(rewardsListQuery).not.toHaveBeenCalled();
	});
});

describe("MerchantRewardsPageView loading", () => {
	it("draws the summary strip and catalog — never zero counts — while the catalog loads", () => {
		rewardsSummaryQuery.mockReturnValue({ isSuccess: false, isPending: true, isError: false, error: null, data: undefined, refetch: vi.fn() });
		rewardsListQuery.mockReturnValue({ isSuccess: false, isPending: true, isFetching: true, isError: false, error: null, data: undefined, refetch: vi.fn() });
		renderWithAuthorization(
			<UiPreferencesStoreProvider storageKey={MERCHANT_UI_PREFERENCES_STORAGE_KEY} devtoolsName={MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME}>
				<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />
			</UiPreferencesStoreProvider>,
			{ role: "OWNER", tenantContext: twoStoreSeed(STORE_A.id) },
		);

		expect(busyRegionAnnouncements()).toEqual([REWARDS_CATALOG_LOADING_LABELS.loading]);
		expect(document.querySelector('[data-slot="rewards-summary-skeleton"]')).not.toBeNull();
		expect(screen.queryByText("Live offers")).toBeNull();
		expect(screen.queryByText("No rewards yet")).toBeNull();
	});
});

/** The page with the catalog's layout preference provider (the catalog reads it once there are rewards). */
function renderCatalogPage(): void {
	renderWithAuthorization(
		<UiPreferencesStoreProvider storageKey={MERCHANT_UI_PREFERENCES_STORAGE_KEY} devtoolsName={MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME}>
			<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />
		</UiPreferencesStoreProvider>,
		{ role: "OWNER", tenantContext: twoStoreSeed(STORE_A.id) },
	);
}

describe("MerchantRewardsPageView store filter", () => {
	it("asks for the figures and the open tab's first page of the chosen store once the server seeded the tenant context", () => {
		renderWithAuthorization(<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER", tenantContext: twoStoreSeed(STORE_A.id) });

		const [summaryInput, summaryOptions] = rewardsSummaryQuery.mock.calls.at(0) ?? [];
		expect(summaryInput).toEqual({ tenantSlug: TEST_ORG_SLUG, locationId: STORE_A.id });
		expect(summaryOptions?.enabled).toBe(true);
		const [input, options] = rewardsListQuery.mock.calls.at(0) ?? [];
		expect(input).toEqual({ tenantSlug: TEST_ORG_SLUG, page: 1, limit: REWARD_CATALOG_PAGE_SIZE, locationId: STORE_A.id, filter: { status: { in: ["PUBLISHED"] } } });
		expect(options?.enabled).toBe(true);
	});

	it("asks for the tab and page the URL names, and opens the first tab with rewards otherwise", () => {
		rewardsSummaryQuery.mockReturnValue({
			isSuccess: true,
			isPending: false,
			isError: false,
			error: null,
			data: { data: { ...NO_REWARDS, countsByStatus: { ...NO_REWARDS.countsByStatus, DRAFT: 2 } } },
			refetch: vi.fn(),
		});
		renderCatalogPage();
		expect(rewardsListQuery.mock.calls.at(0)?.[LIST_SLOT_INDEX.first]).toMatchObject({ page: 1, filter: { status: { in: ["DRAFT"] } } });

		cleanup();
		rewardsListQuery.mockClear();
		window.history.replaceState(null, "", "/?status=ended&page=2");
		renderCatalogPage();
		expect(rewardsListQuery.mock.calls.at(0)?.[LIST_SLOT_INDEX.first]).toMatchObject({ page: 2, filter: { status: { in: ["EXPIRED", "DISABLED"] } } });
	});

	it("counts the summary strip from the figures, never from the page on screen", () => {
		rewardsSummaryQuery.mockReturnValue({
			isSuccess: true,
			isPending: false,
			isError: false,
			error: null,
			data: { data: { countsByStatus: { DRAFT: 2, PENDING_REVIEW: 1, PUBLISHED: 7, EXPIRED: 0, DISABLED: 0 }, unitsRemaining: 340 } },
			refetch: vi.fn(),
		});
		renderCatalogPage();

		expect(screen.getByText("Live offers").parentElement?.textContent).toContain("7");
		expect(screen.getByText("In pipeline").parentElement?.textContent).toContain("3");
		expect(screen.getByText("Units left").parentElement?.textContent).toContain("340");
	});

	it("waits for the accessible locations before querying when they are still loading", () => {
		contextQuery.mockReturnValue(contextQueryState(undefined));
		renderWithAuthorization(<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER", tenantContext: { initialLocationId: STORE_A.id } });

		const [, options] = rewardsListQuery.mock.calls.at(0) ?? [];
		expect(options?.enabled).toBe(false);
		const [, summaryOptions] = rewardsSummaryQuery.mock.calls.at(0) ?? [];
		expect(summaryOptions?.enabled).toBe(false);
	});
});

describe("MerchantRewardsPageView caching and errors", () => {
	it("keeps the catalog cached between navigations instead of bypassing the cache", () => {
		renderWithAuthorization(<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER", tenantContext: twoStoreSeed(STORE_A.id) });

		const [, options] = rewardsListQuery.mock.calls.at(0) ?? [];
		expect(options?.staleTime).toBeGreaterThan(0);
		expect(options?.gcTime).toBeUndefined();
	});

	it("shows a user-safe message, never the raw transport error", () => {
		const rawMessage = "Request failed: GET http://api.internal/t/acme/rewards ECONNRESET";
		rewardsListQuery.mockReturnValue({
			isSuccess: false,
			isPending: false,
			isFetching: false,
			isError: true,
			error: new ApiError({ message: rawMessage, statusCode: 502 }),
			data: undefined,
			refetch: vi.fn(),
		});
		renderWithAuthorization(<MerchantRewardsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER", tenantContext: twoStoreSeed(STORE_A.id) });

		expect(screen.getByText("Could not load rewards")).toBeTruthy();
		expect(screen.queryByText(rawMessage)).toBeNull();
	});
});

describe("MerchantRewardsPageView tab switches", () => {
	const LIVE_REWARD = rewardFixture({ title: "Free yoga class" });

	function showLiveAndDrafts(): void {
		rewardsSummaryQuery.mockReturnValue({
			isSuccess: true,
			isPending: false,
			isError: false,
			error: null,
			data: { data: { ...NO_REWARDS, countsByStatus: { ...NO_REWARDS.countsByStatus, PUBLISHED: 1, DRAFT: 1 } } },
			refetch: vi.fn(),
		});
		window.history.replaceState(null, "", "/?status=live");
	}

	function listResult(isPlaceholderData: boolean): object {
		return {
			isSuccess: true,
			isPending: false,
			isFetching: isPlaceholderData,
			isPlaceholderData,
			isError: false,
			error: null,
			data: { data: [LIVE_REWARD] },
			refetch: vi.fn(),
		};
	}

	it("shows the new tab's loading state, never the previous tab's rewards, while the new tab loads", () => {
		showLiveAndDrafts();
		rewardsListQuery.mockReturnValue(listResult(false));
		renderCatalogPage();
		expect(screen.getByText(LIVE_REWARD.title)).toBeDefined();

		// The drafts are not cached yet: the query keeps the live page as its placeholder.
		rewardsListQuery.mockReturnValue(listResult(true));
		fireEvent.click(screen.getByRole("tab", { name: /Drafts/ }));

		expect(screen.queryByText(LIVE_REWARD.title)).toBeNull();
		expect(busyRegionAnnouncements()).not.toHaveLength(0);
	});

	it("fetches a tab's first page ahead when the pointer or keyboard focus reaches it", () => {
		showLiveAndDrafts();
		rewardsListQuery.mockReturnValue(listResult(false));
		renderCatalogPage();

		fireEvent.pointerEnter(screen.getByRole("tab", { name: /Drafts/ }));
		fireEvent.focus(screen.getByRole("tab", { name: /Live/ }));

		// Only the tab that is not open, on its first page.
		expect(prefetchRewards.mock.calls).toHaveLength(1);
		expect(prefetchRewards.mock.calls.at(0)?.[LIST_SLOT_INDEX.first]).toMatchObject({ page: 1, filter: { status: { in: ["DRAFT"] } } });
	});
});
