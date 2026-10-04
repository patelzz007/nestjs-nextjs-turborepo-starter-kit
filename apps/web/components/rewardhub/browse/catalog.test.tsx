// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UI_PREFERENCES_VERSION, UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RewardHubCatalog } from "@/components/rewardhub/browse/catalog";
import { WEB_UI_PREFERENCES_DEVTOOLS_NAME, WEB_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { buildRewardResponse } from "@/test-support/reward";

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
