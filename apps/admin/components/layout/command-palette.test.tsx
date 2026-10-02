// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AppCommandPaletteQuickAction } from "@workspace/ui/components/navigation/app-command-palette";
import type { PaletteRecentSearch, PaletteSearchableItem } from "@workspace/ui/lib/palette/types";
import { CommandPaletteStoreProvider } from "@workspace/client/lib/features/command-palette/facade";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizedNavigationProvider } from "@/components/layout/authorized-navigation";
import { CommandPalette } from "@/components/layout/command-palette";
import { ADMIN_COMMAND_PALETTE_DEVTOOLS_NAME, ADMIN_COMMAND_PALETTE_STORAGE_KEY } from "@/lib/palette/store-config";
import { ROUTES } from "@/lib/routes";

interface StubPaletteProps {
	readonly searchableItems: readonly PaletteSearchableItem[];
	readonly quickActions: readonly AppCommandPaletteQuickAction[];
	readonly recentSearches: readonly PaletteRecentSearch[];
	readonly pinnedUrls: readonly string[];
	readonly onAddRecent: (item: PaletteRecentSearch) => void;
	readonly onTogglePinned: (url: string) => void;
}

const STUB_RECENT: PaletteRecentSearch = { title: "Billing", url: "/settings/billing", section: "Main" };

/** Renders what the palette receives, plus buttons that fire its recent/pin callbacks. */
function StubAppCommandPalette({ searchableItems, quickActions, recentSearches, pinnedUrls, onAddRecent, onTogglePinned }: StubPaletteProps): React.JSX.Element {
	const handleOpenBilling = React.useCallback((): void => {
		onAddRecent(STUB_RECENT);
	}, [onAddRecent]);
	const handlePinBilling = React.useCallback((): void => {
		onTogglePinned(STUB_RECENT.url);
	}, [onTogglePinned]);

	return (
		<>
			<ul aria-label="pages">
				{searchableItems.map((item) => (
					<li key={item.id}>{item.title}</li>
				))}
			</ul>
			<ul aria-label="actions">
				{quickActions.map((action) => (
					<li key={action.id}>{action.title}</li>
				))}
			</ul>
			<ul aria-label="recent">
				{recentSearches.map((item) => (
					<li key={item.url}>{item.url}</li>
				))}
			</ul>
			<ul aria-label="pinned">
				{pinnedUrls.map((url) => (
					<li key={url}>{url}</li>
				))}
			</ul>
			<button type="button" onClick={handleOpenBilling}>
				Open billing
			</button>
			<button type="button" onClick={handlePinBilling}>
				Pin billing
			</button>
		</>
	);
}

vi.mock("@workspace/ui/components/navigation/app-command-palette", () => ({
	AppCommandPalette: StubAppCommandPalette,
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { push: () => void } => ({ push: vi.fn() }),
}));

vi.mock("next-themes", () => ({
	useTheme: (): { setTheme: () => void; resolvedTheme: string } => ({ setTheme: vi.fn(), resolvedTheme: "light" }),
}));

const AUTHORIZED_ITEMS: readonly PaletteSearchableItem[] = [
	{ id: "main-billing", title: "Billing", url: "/settings/billing", section: "Main", breadcrumb: ["Settings", "Billing"] },
];

function allowAll(): boolean {
	return true;
}

/** Denies the settings pages (as the guard would for a session without them). */
function denySettings(href: string): boolean {
	return href !== ROUTES.settings.billing && href !== ROUTES.settings.index;
}

/** The palette's store as the admin shell mounts it — real store, real persistence key. */
function PaletteStore({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<CommandPaletteStoreProvider storageKey={ADMIN_COMMAND_PALETTE_STORAGE_KEY} devtoolsName={ADMIN_COMMAND_PALETTE_DEVTOOLS_NAME}>
			{children}
		</CommandPaletteStoreProvider>
	);
}

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

function titlesIn(listName: string): readonly string[] {
	return within(screen.getByRole("list", { name: listName }))
		.queryAllByRole("listitem")
		.map((item) => item.textContent);
}

function actionTitles(): readonly string[] {
	return titlesIn("actions");
}

describe("CommandPalette", () => {
	it("searches only the authorized items provided by the layout", () => {
		render(
			<AuthorizedNavigationProvider searchableItems={AUTHORIZED_ITEMS} canAccessRoute={allowAll}>
				<CommandPalette open setOpen={vi.fn()} />
			</AuthorizedNavigationProvider>,
			{ wrapper: PaletteStore },
		);

		expect(titlesIn("pages")).toEqual(["Billing"]);
	});

	it("offers every navigation quick action when each target page is allowed", () => {
		render(
			<AuthorizedNavigationProvider searchableItems={[]} canAccessRoute={allowAll}>
				<CommandPalette open setOpen={vi.fn()} />
			</AuthorizedNavigationProvider>,
			{ wrapper: PaletteStore },
		);

		expect(actionTitles()).toEqual(["Toggle Theme", "Open Settings", "Open Account", "Go to Dashboard", "Open Billing"]);
	});

	it("hides a quick action whose target page the route guard would deny", () => {
		render(
			<AuthorizedNavigationProvider searchableItems={[]} canAccessRoute={denySettings}>
				<CommandPalette open setOpen={vi.fn()} />
			</AuthorizedNavigationProvider>,
			{ wrapper: PaletteStore },
		);

		expect(actionTitles()).toEqual(["Toggle Theme", "Open Account", "Go to Dashboard"]);
	});

	it("shows no pages and only in-place actions outside the provider (fail closed)", () => {
		render(<CommandPalette open setOpen={vi.fn()} />, { wrapper: PaletteStore });

		expect(titlesIn("pages")).toEqual([]);
		expect(actionTitles()).toEqual(["Toggle Theme"]);
	});

	it("keeps the recents and pins an earlier build saved under the admin key", () => {
		localStorage.setItem(ADMIN_COMMAND_PALETTE_STORAGE_KEY, JSON.stringify({ state: { recentSearches: [STUB_RECENT], pinnedUrls: ["/docs"] }, version: 0 }));

		render(<CommandPalette open setOpen={vi.fn()} />, { wrapper: PaletteStore });

		expect(titlesIn("recent")).toEqual([STUB_RECENT.url]);
		expect(titlesIn("pinned")).toEqual(["/docs"]);
	});

	it("records opened pages and toggled pins in the shared store and saves them", () => {
		render(<CommandPalette open setOpen={vi.fn()} />, { wrapper: PaletteStore });

		fireEvent.click(screen.getByRole("button", { name: "Open billing" }));
		fireEvent.click(screen.getByRole("button", { name: "Pin billing" }));

		expect(titlesIn("recent")).toEqual([STUB_RECENT.url]);
		expect(titlesIn("pinned")).toEqual([STUB_RECENT.url]);
		expect(localStorage.getItem(ADMIN_COMMAND_PALETTE_STORAGE_KEY)).toBe(JSON.stringify({ recentSearches: [STUB_RECENT], pinnedUrls: [STUB_RECENT.url] }));

		fireEvent.click(screen.getByRole("button", { name: "Pin billing" }));
		expect(titlesIn("pinned")).toEqual([]);
	});
});
