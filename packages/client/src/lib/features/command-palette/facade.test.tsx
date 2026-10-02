// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CommandPaletteStoreProvider, useCommandPaletteCommands, useCommandPalettePinnedUrls, useCommandPaletteRecentSearches } from "./facade";
import type { CommandPaletteRecentSearch } from "./state";

const STORAGE_KEY = "test-command-palette-state";

const BILLING: CommandPaletteRecentSearch = { title: "Billing", url: "/settings/billing", section: "Platform", icon: "CreditCard" };

function wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<CommandPaletteStoreProvider storageKey={STORAGE_KEY} devtoolsName="Command Palette · test">
			{children}
		</CommandPaletteStoreProvider>
	);
}

interface CommandPaletteProbe {
	readonly recentSearches: readonly CommandPaletteRecentSearch[];
	readonly pinnedUrls: readonly string[];
	readonly commands: ReturnType<typeof useCommandPaletteCommands>;
}

function useCommandPaletteProbe(): CommandPaletteProbe {
	return { recentSearches: useCommandPaletteRecentSearches(), pinnedUrls: useCommandPalettePinnedUrls(), commands: useCommandPaletteCommands() };
}

beforeEach((): void => {
	window.localStorage.clear();
});

afterEach((): void => {
	cleanup();
	window.localStorage.clear();
});

describe("command palette facade", () => {
	it("exposes state through narrow hooks and changes it through commands", () => {
		const { result } = renderHook(useCommandPaletteProbe, { wrapper });

		act(() => {
			result.current.commands.recordRecentSearch(BILLING);
			result.current.commands.togglePin("/docs");
		});

		expect(result.current).toMatchObject({ recentSearches: [BILLING], pinnedUrls: ["/docs"] });
	});

	it("keeps command identities stable across renders", () => {
		const { result, rerender } = renderHook(useCommandPaletteCommands, { wrapper });
		const first = result.current;

		rerender();

		expect(result.current).toBe(first);
	});

	it("restores saved recents and pins after mount and saves changes back — never the search text", () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ recentSearches: [BILLING], pinnedUrls: ["/docs"] }));

		const { result } = renderHook(useCommandPaletteProbe, { wrapper });
		expect(result.current).toMatchObject({ recentSearches: [BILLING], pinnedUrls: ["/docs"] });

		act(() => {
			result.current.commands.togglePin("/settings");
		});
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ recentSearches: [BILLING], pinnedUrls: ["/settings", "/docs"] }));
	});

	it("keeps the shortcuts a zustand/persist build saved", () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { recentSearches: [BILLING], pinnedUrls: ["/docs"] }, version: 0 }));

		const { result } = renderHook(useCommandPaletteProbe, { wrapper });

		expect(result.current).toMatchObject({ recentSearches: [BILLING], pinnedUrls: ["/docs"] });
	});

	it("ignores a corrupted snapshot and starts empty", () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { recentSearches: "nope", pinnedUrls: 42 }, version: 0 }));

		const { result } = renderHook(useCommandPaletteProbe, { wrapper });

		expect(result.current).toMatchObject({ recentSearches: [], pinnedUrls: [] });
	});

	it("gives each provider its own store", () => {
		const first = renderHook(useCommandPaletteProbe, { wrapper });
		const second = renderHook(useCommandPaletteProbe, { wrapper });

		act(() => {
			first.result.current.commands.togglePin("/docs");
		});

		expect(first.result.current.pinnedUrls).toEqual(["/docs"]);
		expect(second.result.current.pinnedUrls).toEqual([]);
	});

	it("fails loudly outside its provider", () => {
		expect(() => renderHook(useCommandPalettePinnedUrls)).toThrow(/Command Palette store is missing/u);
	});
});
