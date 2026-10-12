// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UI_PREFERENCES_VERSION, UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { REWARDS_CATALOG_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RewardHubCatalog } from "@/components/rewardhub/browse/catalog";
import { WEB_UI_PREFERENCES_DEVTOOLS_NAME, WEB_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { buildRewardResponse } from "@/test-support/reward";
import { countSlots, expectSingleLoadingStatus, SkeletonTestProviders } from "@/test-support/skeleton";

const REWARD_TITLE = "Free flat white";

function noop(): void {
	// Pagination is not under test here.
}

function renderCatalog(): void {
	render(
		<UiPreferencesStoreProvider storageKey={WEB_UI_PREFERENCES_STORAGE_KEY} devtoolsName={WEB_UI_PREFERENCES_DEVTOOLS_NAME}>
			<RewardHubCatalog rewards={[buildRewardResponse({ title: REWARD_TITLE })]} isLoading={false} hasNext={false} hasPrevious={false} onNext={noop} onPrevious={noop} />
		</UiPreferencesStoreProvider>,
	);
}

function isPressed(name: string): boolean {
	return screen.getByRole("button", { name }).getAttribute("aria-pressed") === "true";
}

function listRowLink(): HTMLElement | null {
	return screen.queryByRole("link", { name: `View ${REWARD_TITLE}` });
}

beforeEach((): void => {
	window.localStorage.clear();
});

afterEach((): void => {
	cleanup();
	window.localStorage.clear();
});

describe("RewardHubCatalog layout preference", () => {
	it("shows the grid until the visitor picks a layout", () => {
		renderCatalog();

		expect(isPressed("Grid view")).toBe(true);
		expect(screen.getByRole("heading", { name: REWARD_TITLE })).toBeDefined();
		expect(listRowLink()).toBeNull();
	});

	it("switches to the list and remembers the choice", () => {
		renderCatalog();

		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "List view" }));
		});

		expect(isPressed("List view")).toBe(true);
		expect(listRowLink()).not.toBeNull();
		expect(window.localStorage.getItem(WEB_UI_PREFERENCES_STORAGE_KEY)).toBe(JSON.stringify({ schemaVersion: UI_PREFERENCES_VERSION, snapshot: { rewardsViewMode: "list" } }));
	});

	it("keeps the layout the older view-mode helper saved as a bare string", () => {
		window.localStorage.setItem(WEB_UI_PREFERENCES_STORAGE_KEY, "list");

		renderCatalog();

		expect(isPressed("List view")).toBe(true);
		expect(listRowLink()).not.toBeNull();
	});
});

describe("RewardHubCatalog loading", () => {
	function renderLoadingCatalog(): HTMLElement {
		return render(<RewardHubCatalog rewards={[]} isLoading hasNext={false} hasPrevious={false} onNext={noop} onPrevious={noop} />, { wrapper: SkeletonTestProviders })
			.container;
	}

	it("shows reward-card skeletons, announced once, while the grid loads", () => {
		const container = renderLoadingCatalog();

		expectSingleLoadingStatus(REWARDS_CATALOG_LOADING_LABELS.loading);
		expect(countSlots(container, "reward-card-skeleton")).toBeGreaterThan(0);
		expect(screen.queryByText(/^Showing/)).toBeNull();
	});

	it("shapes the skeleton as list rows for a visitor who chose the list layout", () => {
		window.localStorage.setItem(WEB_UI_PREFERENCES_STORAGE_KEY, "list");

		const container = renderLoadingCatalog();

		expect(countSlots(container, "reward-list-row-skeleton")).toBeGreaterThan(0);
		expect(countSlots(container, "reward-card-skeleton")).toBe(0);
	});

	it("keeps the layout toggle usable while the catalog loads", () => {
		renderLoadingCatalog();

		expect(screen.getByRole("button", { name: "List view" })).toBeDefined();
	});
});
