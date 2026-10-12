// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UI_PREFERENCES_VERSION, UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MerchantRewardsCatalog, REWARDS_CATALOG_LOADING_LABELS } from "@/components/rewards/merchant-rewards-catalog";
import { MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME, MERCHANT_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { busyRegionAnnouncements } from "@/test/skeleton";

function renderCatalog(isLoading = false): void {
	render(
		<UiKitTestProviders>
			<UiPreferencesStoreProvider storageKey={MERCHANT_UI_PREFERENCES_STORAGE_KEY} devtoolsName={MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME}>
				<MerchantRewardsCatalog rewards={[]} isLoading={isLoading} canManageRewards />
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
