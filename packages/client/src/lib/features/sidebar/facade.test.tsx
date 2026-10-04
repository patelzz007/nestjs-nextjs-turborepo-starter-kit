// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SidebarStoreProvider, useSidebarCommands, useSidebarExpandedItems, useSidebarIsOpen, useSidebarSearchQuery } from "./facade";

const STORAGE_KEY = "test-sidebar-state";
const PATHNAME = "/rewardhub/wallet";
const AUTO_EXPANDED: Readonly<Record<string, boolean>> = { rewards: true };

function wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<SidebarStoreProvider storageKey={STORAGE_KEY} devtoolsName="Sidebar · test">
			{children}
		</SidebarStoreProvider>
	);
}

interface SidebarProbe {
	readonly isOpen: boolean;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly searchQuery: string;
	readonly commands: ReturnType<typeof useSidebarCommands>;
}

function useSidebarProbe(): SidebarProbe {
	return {
		isOpen: useSidebarIsOpen(),
		expandedItems: useSidebarExpandedItems(PATHNAME, AUTO_EXPANDED),
		searchQuery: useSidebarSearchQuery(),
		commands: useSidebarCommands(),
	};
}

beforeEach((): void => {
	window.localStorage.clear();
});

afterEach((): void => {
	cleanup();
	window.localStorage.clear();
});

describe("sidebar facade", () => {
	it("exposes state through narrow hooks and changes it through commands", () => {
		const { result } = renderHook(useSidebarProbe, { wrapper });

		act(() => {
			result.current.commands.toggle();
			result.current.commands.setItemExpanded(PATHNAME, "wallet", true);
			result.current.commands.setItemExpanded(PATHNAME, "rewards", false);
			result.current.commands.setSearchQuery("rew");
		});

		expect(result.current).toMatchObject({ isOpen: false, expandedItems: { rewards: false, wallet: true }, searchQuery: "rew" });
	});

	it("keeps command identities stable across renders", () => {
		const { result, rerender } = renderHook(useSidebarCommands, { wrapper });
		const first = result.current;

		rerender();

		expect(result.current).toBe(first);
	});

	it("restores saved preferences after mount and saves changes back", () => {
		const saved = { isOpen: false, sectionOrder: null, manualExpansion: { pathname: PATHNAME, items: { wallet: true } } };
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, snapshot: saved }));

		const { result } = renderHook(useSidebarProbe, { wrapper });
		expect(result.current).toMatchObject({ isOpen: false, expandedItems: { rewards: true, wallet: true } });

		act(() => {
			result.current.commands.open();
		});
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ schemaVersion: 1, snapshot: { ...saved, isOpen: true } }));
	});

	it("applies a page's manual choices on that page only — navigation needs no reset", () => {
		function useNavigatingProbe(pathname: string): { readonly expandedItems: Readonly<Record<string, boolean>>; readonly commands: ReturnType<typeof useSidebarCommands> } {
			return { expandedItems: useSidebarExpandedItems(pathname, AUTO_EXPANDED), commands: useSidebarCommands() };
		}
		const { result, rerender } = renderHook(({ pathname }: { readonly pathname: string }) => useNavigatingProbe(pathname), {
			wrapper,
			initialProps: { pathname: PATHNAME },
		});

		act(() => {
			result.current.commands.setItemExpanded(PATHNAME, "rewards", false);
		});
		expect(result.current.expandedItems).toEqual({ rewards: false });

		rerender({ pathname: "/rewardhub/other" });
		expect(result.current.expandedItems).toEqual({ rewards: true });

		rerender({ pathname: PATHNAME });
		expect(result.current.expandedItems).toEqual({ rewards: false });
	});

	it("gives each provider its own store", () => {
		const first = renderHook(useSidebarProbe, { wrapper });
		const second = renderHook(useSidebarProbe, { wrapper });

		act(() => {
			first.result.current.commands.close();
		});

		expect(second.result.current.isOpen).toBe(true);
	});

	it("fails loudly outside its provider", () => {
		expect(() => renderHook(useSidebarIsOpen)).toThrow(/Sidebar store is missing/u);
	});
});
