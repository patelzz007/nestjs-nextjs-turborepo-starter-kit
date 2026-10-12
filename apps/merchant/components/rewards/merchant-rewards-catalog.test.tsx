// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { UI_PREFERENCES_VERSION, UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import type { RewardResponse } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantRewardsCatalog, REWARDS_CATALOG_LOADING_LABELS } from "@/components/rewards/merchant-rewards-catalog";
import { ORG_ROUTES, resolveOrgHref } from "@/lib/routes";
import { MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME, MERCHANT_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { REWARD_FIXTURE_COVER_URL, rewardFixture } from "@/test/rewards";
import { busyRegionAnnouncements } from "@/test/skeleton";

const ORG_SLUG = "jonker-street-kitchen";

vi.mock("next/navigation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/navigation")>();
	return { ...actual, useParams: (): Record<string, string> => ({ orgSlug: ORG_SLUG }) };
});

function renderCatalog(isLoading = false, rewards: readonly RewardResponse[] = []): void {
	render(
		<UiKitTestProviders>
			<UiPreferencesStoreProvider storageKey={MERCHANT_UI_PREFERENCES_STORAGE_KEY} devtoolsName={MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME}>
				<MerchantRewardsCatalog rewards={rewards} isLoading={isLoading} canManageRewards />
			</UiPreferencesStoreProvider>
		</UiKitTestProviders>,
	);
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
});

afterEach((): void => {
	cleanup();
	window.localStorage.clear();
});

describe("MerchantRewardsCatalog layout preference", () => {
	it("shows the grid until the member picks a layout", () => {
		renderCatalog();

		expect(isPressed("Grid view")).toBe(true);
		expect(listColumnHeader()).toBeNull();
	});

	it("switches to the list and remembers the choice", () => {
		renderCatalog();

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

		renderCatalog();

		expect(isPressed("List view")).toBe(true);
		expect(listColumnHeader()).not.toBeNull();
	});
});

describe("MerchantRewardsCatalog loading", () => {
	it("draws reward cards in the grid layout, announced once, while the catalog loads", () => {
		renderCatalog(true);

		expect(busyRegionAnnouncements()).toEqual([REWARDS_CATALOG_LOADING_LABELS.loading]);
		expect(document.querySelector('[data-slot="rewards-grid-skeleton"]')).not.toBeNull();
		expect(screen.queryByText("0 rewards")).toBeNull();
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

describe("MerchantRewardsCatalog sections", () => {
	const LIVE_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
	const REWARDS: readonly RewardResponse[] = [
		rewardFixture({ id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", title: "Old cendol giveaway", status: "EXPIRED", quantityRemaining: 0 }),
		rewardFixture({ id: LIVE_ID, title: "Nyonya kuih sampler", rewardType: "DISCOUNT", rewardValue: 10, quantityRemaining: 5, quantityTotal: 50 }),
		rewardFixture({ id: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f", title: "Lunch set draft", status: "DRAFT" }),
	];

	function sectionTitles(): string[] {
		return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
	}

	function section(name: RegExp): HTMLElement {
		return screen.getByRole("region", { name });
	}

	it("groups the cards by status — live first, ended last — each section counting its rewards", () => {
		renderCatalog(false, REWARDS);

		expect(sectionTitles()).toEqual(["Live1", "Drafts1", "Ended1"]);
		expect(within(section(/^Live/u)).getByText("Nyonya kuih sampler")).toBeDefined();
		expect(within(section(/^Ended/u)).getByText("Old cendol giveaway")).toBeDefined();
		expect(screen.getByText("3 rewards")).toBeDefined();
	});

	it("leads each card with the offer and opens the reward from the whole card", () => {
		renderCatalog(false, REWARDS);
		const live = within(section(/^Live/u));

		expect(live.getByText("10% off")).toBeDefined();
		expect(live.getByRole("link", { name: "Nyonya kuih sampler, manage reward" }).getAttribute("href")).toBe(resolveOrgHref(ORG_SLUG, ORG_ROUTES.rewards.edit(LIVE_ID)));
		expect(live.queryByRole("button")).toBeNull();
	});

	it("shows the branch, not the business name, and flags stock running low", () => {
		renderCatalog(false, REWARDS);
		const live = within(section(/^Live/u));

		expect(live.getByText("Bukit Katil")).toBeDefined();
		expect(live.getByText("5 of 50 left").closest('[data-slot="reward-stock"]')?.getAttribute("data-level")).toBe("low");
		expect(within(section(/^Ended/u)).getByText("Sold out")).toBeDefined();
	});

	it("shows every reward's cover in the grid and as a thumbnail in the list, quietened once the reward has ended", () => {
		renderCatalog(false, REWARDS);
		const covers = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-slot="cover-image"]')];

		expect(covers()).toHaveLength(REWARDS.length);
		expect(covers().map((cover) => cover.querySelector("img")?.getAttribute("src"))).toEqual(REWARDS.map(() => REWARD_FIXTURE_COVER_URL));
		const endedCover = section(/^Ended/u).querySelector<HTMLElement>('[data-slot="cover-image"]');
		expect(endedCover?.className).toContain("grayscale");
		expect(section(/^Live/u).querySelector<HTMLElement>('[data-slot="cover-image"]')?.className).not.toContain("grayscale");

		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "List view" }));
		});
		expect(document.querySelectorAll('[data-slot="reward-row"] [data-slot="cover-image"]')).toHaveLength(REWARDS.length);
	});

	it("keeps the same sections and links in the list layout", () => {
		window.localStorage.setItem(MERCHANT_UI_PREFERENCES_STORAGE_KEY, "list");
		renderCatalog(false, REWARDS);

		expect(sectionTitles()).toEqual(["Live1", "Drafts1", "Ended1"]);
		expect(document.querySelectorAll('[data-slot="reward-row"]')).toHaveLength(REWARDS.length);
		expect(within(section(/^Live/u)).getByRole("link", { name: "Nyonya kuih sampler, manage reward" })).toBeDefined();
	});
});
