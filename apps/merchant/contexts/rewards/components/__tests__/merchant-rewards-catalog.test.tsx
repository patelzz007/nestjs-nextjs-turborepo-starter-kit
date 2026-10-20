// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UI_PREFERENCES_VERSION, UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { MerchantRewardSummarySchema, RewardStatusSchema, type RewardResponse, type RewardStatus } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantRewardsCatalog, REWARDS_CATALOG_LOADING_LABELS } from "@/contexts/rewards/components/merchant-rewards-catalog";
import { defaultRewardStatusGroupId, groupStatusCounts, REWARD_STATUS_GROUPS, statusesOfGroup, type RewardStatusGroupId } from "@/contexts/rewards/lib/presentation";
import { REWARDS_URL_STATE, rewardsTabPatch } from "@/contexts/rewards/url-state/rewards";
import { TENANT_ROUTES, resolveTenantHref } from "@/lib/routes";
import { MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME, MERCHANT_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { REWARD_FIXTURE_COVER_URL, rewardFixture } from "@/test/rewards";
import { busyRegionAnnouncements } from "@/test/skeleton";

const ORG_SLUG = "jonker-street-kitchen";
const REWARDS_PATH = resolveTenantHref(ORG_SLUG, TENANT_ROUTES.rewards.list);
const CREATE_REWARD_HREF = resolveTenantHref(ORG_SLUG, TENANT_ROUTES.rewards.new);

// The open tab is read from the address bar, as Next.js's `useSearchParams`
// does once its History API integration has synced it.
vi.mock("next/navigation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/navigation")>();
	return {
		...actual,
		useParams: (): Record<string, string> => ({ tenantSlug: ORG_SLUG }),
		useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
	};
});

interface RenderCatalogOptions {
	readonly isLoading?: boolean;
	readonly canManageRewards?: boolean;
	/** What the page passes for its pager (a tab with more than one page). */
	readonly pager?: React.ReactNode;
}

interface CatalogHarnessProps extends RenderCatalogOptions {
	/** Every reward of the catalog — what the API holds. */
	readonly rewards: readonly RewardResponse[];
}

/**
 * The page's wiring around the catalog, with the API answered from `rewards`: the figures are their
 * per-status counts, the open tab is URL state, and the tab's page is the rewards in its statuses.
 */
function CatalogHarness({ rewards, isLoading = false, canManageRewards = true, pager = null }: CatalogHarnessProps): React.JSX.Element {
	const [urlState, updateUrlState] = useUrlState(REWARDS_URL_STATE);
	const countsByStatus = MerchantRewardSummarySchema.shape.countsByStatus.parse(
		Object.fromEntries(
			RewardStatusSchema.options.map((status: RewardStatus): [RewardStatus, number] => [status, rewards.filter((reward) => reward.status === status).length]),
		),
	);
	const groups = groupStatusCounts(countsByStatus);
	const selectedGroupId: RewardStatusGroupId = urlState.status ?? defaultRewardStatusGroupId(groups);
	const tabStatuses = statusesOfGroup(selectedGroupId);
	const selectGroup = React.useCallback(
		(groupId: RewardStatusGroupId): void => {
			updateUrlState(rewardsTabPatch(groupId));
		},
		[updateUrlState],
	);
	return (
		<MerchantRewardsCatalog
			groups={groups}
			selectedGroupId={selectedGroupId}
			onSelectGroup={selectGroup}
			rewards={rewards.filter((reward) => tabStatuses.includes(reward.status))}
			isLoading={isLoading}
			isPageLoading={false}
			pastEndAction={<button type="button">Go to the first page</button>}
			pager={pager}
			canManageRewards={canManageRewards}
			createRewardHref={CREATE_REWARD_HREF}
		/>
	);
}

function catalogElement(rewards: readonly RewardResponse[], options: RenderCatalogOptions): React.JSX.Element {
	return (
		<UiKitTestProviders>
			<UiPreferencesStoreProvider storageKey={MERCHANT_UI_PREFERENCES_STORAGE_KEY} devtoolsName={MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME}>
				<CatalogHarness rewards={rewards} {...options} />
			</UiPreferencesStoreProvider>
		</UiKitTestProviders>
	);
}

/** Renders the catalog; `rerender` re-reads the URL after the catalog wrote it (as Next.js does on a History API write). */
function renderCatalog(isLoading = false, rewards: readonly RewardResponse[] = [], options: Omit<RenderCatalogOptions, "isLoading"> = {}): { readonly rerender: () => void } {
	const view = render(catalogElement(rewards, { ...options, isLoading }));
	return {
		rerender: (): void => {
			view.rerender(catalogElement(rewards, { ...options, isLoading }));
		},
	};
}

function isPressed(name: string): boolean {
	return screen.getByRole("button", { name }).getAttribute("aria-pressed") === "true";
}

/** The list layout's column header — the grid has none. */
function listColumnHeader(): HTMLElement | null {
	return screen.queryByText("Inventory");
}

beforeEach((): void => {
	window.localStorage.clear();
	window.history.replaceState(null, "", REWARDS_PATH);
});

afterEach((): void => {
	cleanup();
	window.localStorage.clear();
	vi.restoreAllMocks();
});

describe("MerchantRewardsCatalog layout preference", () => {
	it("shows the grid until the member picks a layout", () => {
		renderCatalog(false, [rewardFixture()]);

		expect(isPressed("Grid view")).toBe(true);
		expect(listColumnHeader()).toBeNull();
	});

	it("switches to the list and remembers the choice", () => {
		renderCatalog(false, [rewardFixture()]);

		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "List view" }));
		});

		expect(isPressed("List view")).toBe(true);
		expect(listColumnHeader()).not.toBeNull();
		expect(window.localStorage.getItem(MERCHANT_UI_PREFERENCES_STORAGE_KEY)).toBe(
			JSON.stringify({ schemaVersion: UI_PREFERENCES_VERSION, snapshot: { rewardsViewMode: "list" } }),
		);
	});

	it("keeps the layout the older view-mode helper saved as a bare string", () => {
		window.localStorage.setItem(MERCHANT_UI_PREFERENCES_STORAGE_KEY, "list");

		renderCatalog(false, [rewardFixture()]);

		expect(isPressed("List view")).toBe(true);
		expect(listColumnHeader()).not.toBeNull();
	});
});

describe("MerchantRewardsCatalog loading", () => {
	it("draws reward cards in the grid layout, announced once, while the catalog loads", () => {
		renderCatalog(true);

		expect(busyRegionAnnouncements()).toEqual([REWARDS_CATALOG_LOADING_LABELS.loading]);
		expect(document.querySelector('[data-slot="rewards-grid-skeleton"]')).not.toBeNull();
		expect(screen.queryByRole("tab")).toBeNull();
	});

	it("draws the tab bar's bones, out of the accessibility tree, until the counts are known", () => {
		renderCatalog(true);

		expect(document.querySelector('[data-slot="rewards-tabs-skeleton"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
		expect(screen.queryByRole("tablist")).toBeNull();
	});

	it("draws list rows instead when the member chose the list layout", () => {
		window.localStorage.setItem(MERCHANT_UI_PREFERENCES_STORAGE_KEY, "list");
		renderCatalog(true);

		expect(document.querySelector('[data-slot="rewards-list-skeleton"]')).not.toBeNull();
		expect(document.querySelector('[data-slot="rewards-grid-skeleton"]')).toBeNull();
	});

	it("keeps the layout toggle usable while the catalog loads", () => {
		renderCatalog(true);

		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "List view" }));
		});

		expect(document.querySelector('[data-slot="rewards-list-skeleton"]')).not.toBeNull();
	});
});

describe("MerchantRewardsCatalog status tabs", () => {
	const LIVE_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
	const REWARDS: readonly RewardResponse[] = [
		rewardFixture({ id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", title: "Old cendol giveaway", status: "EXPIRED", quantityRemaining: 0 }),
		rewardFixture({ id: LIVE_ID, title: "Nyonya kuih sampler", rewardType: "DISCOUNT", rewardValue: 10, quantityRemaining: 5, quantityTotal: 50 }),
		rewardFixture({ id: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f", title: "Lunch set draft", status: "DRAFT" }),
		rewardFixture({ id: "4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a", title: "Disabled teh tarik deal", status: "DISABLED" }),
	];

	function tabNames(): (string | null)[] {
		return screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label"));
	}

	function selectedTab(): string | null | undefined {
		return screen
			.getAllByRole("tab")
			.find((tab) => tab.getAttribute("aria-selected") === "true")
			?.getAttribute("aria-label");
	}

	function panel(): HTMLElement {
		return screen.getByRole("tabpanel");
	}

	it("shows one tab per status, in order, each counting its rewards — empty ones included", () => {
		renderCatalog(false, REWARDS);

		expect(screen.getByRole("tablist", { name: "Reward status" })).toBeDefined();
		expect(tabNames()).toEqual(["Live, 1 reward", "In review, 0 rewards", "Drafts, 1 reward", "Ended, 2 rewards"]);
	});

	it("opens on live rewards and shows only that tab's rewards", () => {
		renderCatalog(false, REWARDS);

		expect(selectedTab()).toBe("Live, 1 reward");
		expect(within(panel()).getByText("Nyonya kuih sampler")).toBeDefined();
		expect(screen.queryByText("Lunch set draft")).toBeNull();
		expect(screen.queryByText("Old cendol giveaway")).toBeNull();
	});

	it("opens on the first tab with rewards when nothing is live", () => {
		renderCatalog(false, [rewardFixture({ title: "Lunch set draft", status: "DRAFT" })]);

		expect(selectedTab()).toBe("Drafts, 1 reward");
		expect(within(panel()).getByText("Lunch set draft")).toBeDefined();
		expect(window.location.search).toBe("");
	});

	it("opens the tab the URL names, so a shared link lands on the same rewards", () => {
		window.history.replaceState(null, "", `${REWARDS_PATH}?status=ended`);
		renderCatalog(false, REWARDS);

		expect(selectedTab()).toBe("Ended, 2 rewards");
		expect(within(panel()).getByText("Old cendol giveaway")).toBeDefined();
		expect(within(panel()).getByText("Disabled teh tarik deal")).toBeDefined();
		expect(screen.queryByText("Nyonya kuih sampler")).toBeNull();
	});

	it("falls back to the first tab with rewards for an unknown status in the URL", () => {
		window.history.replaceState(null, "", `${REWARDS_PATH}?status=archived`);
		renderCatalog(false, REWARDS);

		expect(selectedTab()).toBe("Live, 1 reward");
		expect(within(panel()).getByText("Nyonya kuih sampler")).toBeDefined();
	});

	it("pushes the chosen tab to the URL, so Back returns to the previous one", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const view = renderCatalog(false, REWARDS);

		act(() => {
			fireEvent.click(screen.getByRole("tab", { name: "Drafts, 1 reward" }));
		});
		view.rerender();

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?status=drafts");
		expect(selectedTab()).toBe("Drafts, 1 reward");
		expect(within(panel()).getByText("Lunch set draft")).toBeDefined();
	});

	it("explains an empty tab and offers the next step", () => {
		window.history.replaceState(null, "", `${REWARDS_PATH}?status=review`);
		const view = renderCatalog(false, REWARDS);

		expect(within(panel()).getByRole("heading", { name: "Nothing waiting for review" })).toBeDefined();
		act(() => {
			fireEvent.click(within(panel()).getByRole("button", { name: "Open drafts" }));
		});
		view.rerender();

		expect(window.location.search).toBe("?status=drafts");
		expect(selectedTab()).toBe("Drafts, 1 reward");
	});

	it("links an empty tab to the reward editor for members who manage rewards, and offers nothing to the rest", () => {
		const onlyEnded: readonly RewardResponse[] = [rewardFixture({ status: "EXPIRED" })];
		window.history.replaceState(null, "", `${REWARDS_PATH}?status=live`);
		renderCatalog(false, onlyEnded);

		expect(within(panel()).getByRole("heading", { name: "No live rewards" })).toBeDefined();
		expect(within(panel()).getByRole("link", { name: "Create a reward" }).getAttribute("href")).toBe(CREATE_REWARD_HREF);

		cleanup();
		renderCatalog(false, onlyEnded, { canManageRewards: false });
		expect(within(panel()).queryByRole("link")).toBeNull();
	});

	it("leads each card with the offer and opens the reward from the whole card", () => {
		renderCatalog(false, REWARDS);
		const live = within(panel());

		expect(live.getByText("10% off")).toBeDefined();
		expect(live.getByRole("link", { name: "Nyonya kuih sampler, manage reward" }).getAttribute("href")).toBe(
			resolveTenantHref(ORG_SLUG, TENANT_ROUTES.rewards.detail(LIVE_ID)),
		);
		expect(live.queryByRole("button")).toBeNull();
	});

	it("shows the branch, not the business name, and flags stock running low", () => {
		renderCatalog(false, REWARDS);

		expect(within(panel()).getByText("Bukit Katil")).toBeDefined();
		expect(within(panel()).getByText("5 of 50 left").closest('[data-slot="reward-stock"]')?.getAttribute("data-level")).toBe("low");
	});

	it("quietens the covers of ended rewards", () => {
		window.history.replaceState(null, "", `${REWARDS_PATH}?status=ended`);
		renderCatalog(false, REWARDS);
		const covers = [...panel().querySelectorAll<HTMLElement>('[data-slot="cover-image"]')];

		expect(covers.map((cover) => cover.querySelector("img")?.getAttribute("src"))).toEqual([REWARD_FIXTURE_COVER_URL, REWARD_FIXTURE_COVER_URL]);
		expect(covers.every((cover) => cover.className.includes("grayscale"))).toBe(true);
		expect(within(panel()).getByText("Sold out")).toBeDefined();
	});

	it("keeps the tabs, the open tab and the links in the list layout", () => {
		window.localStorage.setItem(MERCHANT_UI_PREFERENCES_STORAGE_KEY, "list");
		window.history.replaceState(null, "", `${REWARDS_PATH}?status=ended`);
		renderCatalog(false, REWARDS);

		expect(tabNames()).toHaveLength(REWARD_STATUS_GROUPS.length);
		expect(selectedTab()).toBe("Ended, 2 rewards");
		expect(panel().querySelectorAll('[data-slot="reward-row"]')).toHaveLength(2);
		expect(panel().querySelectorAll('[data-slot="reward-row"] [data-slot="cover-image"]')).toHaveLength(2);
		expect(within(panel()).getByText("Inventory")).toBeDefined();
	});

	it("keeps the open tab when the member switches layout", () => {
		window.history.replaceState(null, "", `${REWARDS_PATH}?status=drafts`);
		renderCatalog(false, REWARDS);

		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "List view" }));
		});

		expect(selectedTab()).toBe("Drafts, 1 reward");
		expect(panel().querySelectorAll('[data-slot="reward-row"]')).toHaveLength(1);
	});

	it("moves focus between tabs with the arrow keys, without opening them", async () => {
		renderCatalog(false, REWARDS);
		const live = screen.getByRole("tab", { name: "Live, 1 reward" });

		act(() => {
			live.focus();
		});
		fireEvent.keyDown(live, { key: "ArrowRight" });

		await waitFor((): void => {
			expect(document.activeElement?.getAttribute("aria-label")).toBe("In review, 0 rewards");
		});
		expect(selectedTab()).toBe("Live, 1 reward");
		expect(window.location.search).toBe("");
	});
});

describe("MerchantRewardsCatalog pages", () => {
	it("draws the page's pager under the open tab's rewards", () => {
		renderCatalog(false, [rewardFixture({ title: "Nyonya kuih sampler" })], { pager: <nav aria-label="Reward pages">pager</nav> });

		const panel = screen.getByRole("tabpanel");
		expect(within(panel).getByText("Nyonya kuih sampler")).toBeDefined();
		expect(within(panel).getByRole("navigation", { name: "Reward pages" })).toBeDefined();
	});

	it("says when the page is past the end of a tab that has rewards, and offers the first page", () => {
		const view = render(
			<UiKitTestProviders>
				<UiPreferencesStoreProvider storageKey={MERCHANT_UI_PREFERENCES_STORAGE_KEY} devtoolsName={MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME}>
					<MerchantRewardsCatalog
						groups={groupStatusCounts({ PUBLISHED: 3, PENDING_REVIEW: 0, DRAFT: 0, EXPIRED: 0, DISABLED: 0 })}
						selectedGroupId="live"
						onSelectGroup={vi.fn()}
						rewards={[]}
						isLoading={false}
						isPageLoading={false}
						pastEndAction={<button type="button">Go to the first page</button>}
						pager={null}
						canManageRewards
						createRewardHref={CREATE_REWARD_HREF}
					/>
				</UiPreferencesStoreProvider>
			</UiKitTestProviders>,
		);

		expect(within(view.container).getByRole("heading", { name: "No rewards on this page" })).toBeDefined();
		expect(within(view.container).getByRole("button", { name: "Go to the first page" })).toBeDefined();
	});
});
