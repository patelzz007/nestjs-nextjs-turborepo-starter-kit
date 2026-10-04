// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CommandPaletteStoreProvider, commandPaletteStorageKey, useCommandPaletteCommands, useCommandPalettePinnedUrls, useCommandPaletteRecentSearches } from "./facade";
import type { CommandPaletteRecentSearch } from "./state";

const BASE_KEY = "test-command-palette-state";
const MEMBER = "member-1";
const OTHER_MEMBER = "member-2";
/** Where the signed-in member's palette state is stored. */
const STORAGE_KEY = commandPaletteStorageKey(BASE_KEY, MEMBER);

const BILLING: CommandPaletteRecentSearch = { title: "Billing", url: "/settings/billing", section: "Platform", icon: "CreditCard" };

function ownedWrapper(ownerId: string | null): (props: { readonly children: React.ReactNode }) => React.JSX.Element {
	return function OwnedWrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<CommandPaletteStoreProvider storageKey={BASE_KEY} ownerId={ownerId} devtoolsName="Command Palette · test">
				{children}
			</CommandPaletteStoreProvider>
		);
	};
}

const wrapper = ownedWrapper(MEMBER);

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
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, snapshot: { recentSearches: [BILLING], pinnedUrls: ["/docs"] } }));

		const { result } = renderHook(useCommandPaletteProbe, { wrapper });
		expect(result.current).toMatchObject({ recentSearches: [BILLING], pinnedUrls: ["/docs"] });

		act(() => {
			result.current.commands.togglePin("/settings");
		});
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ schemaVersion: 1, snapshot: { recentSearches: [BILLING], pinnedUrls: ["/settings", "/docs"] } }));
	});

	it("ignores a corrupted snapshot and starts empty", () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, snapshot: { recentSearches: "nope", pinnedUrls: 42 } }));

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

	it("stores the palette per member: another member on the same browser sees none of the first member's recents", () => {
		const first = renderHook(useCommandPaletteProbe, { wrapper });
		act(() => {
			first.result.current.commands.recordRecentSearch(BILLING);
		});
		first.unmount();

		const other = renderHook(useCommandPaletteProbe, { wrapper: ownedWrapper(OTHER_MEMBER) });

		expect(other.result.current.recentSearches).toEqual([]);
		expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
	});

	it("remembers nothing while nobody is signed in", () => {
		const { result } = renderHook(useCommandPaletteProbe, { wrapper: ownedWrapper(null) });

		act(() => {
			result.current.commands.recordRecentSearch(BILLING);
		});

		expect(window.localStorage.length).toBe(0);
	});

	it("removes the member's stored palette when they sign out", () => {
		let ownerId: string | null = MEMBER;
		function SwitchingOwner({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
			return (
				<CommandPaletteStoreProvider storageKey={BASE_KEY} ownerId={ownerId} devtoolsName="Command Palette · test">
					{children}
				</CommandPaletteStoreProvider>
			);
		}
		const { result, rerender } = renderHook(useCommandPaletteProbe, { wrapper: SwitchingOwner });
		act(() => {
			result.current.commands.recordRecentSearch(BILLING);
		});
		expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

		ownerId = null;
		rerender();

		expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
		expect(result.current.recentSearches).toEqual([]);
	});

	it("drops the pre-scoping, unowned key: whose history it holds cannot be known", () => {
		window.localStorage.setItem(BASE_KEY, JSON.stringify({ schemaVersion: 1, snapshot: { recentSearches: [BILLING], pinnedUrls: [] } }));

		const { result } = renderHook(useCommandPaletteProbe, { wrapper });

		expect(result.current.recentSearches).toEqual([]);
		expect(window.localStorage.getItem(BASE_KEY)).toBeNull();
	});
});
