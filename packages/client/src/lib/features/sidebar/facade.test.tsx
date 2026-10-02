// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SidebarStoreProvider, useSidebarCommands, useSidebarExpandedItems, useSidebarIsOpen, useSidebarSearchQuery } from "./facade";

const STORAGE_KEY = "test-sidebar-state";

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
	return { isOpen: useSidebarIsOpen(), expandedItems: useSidebarExpandedItems(), searchQuery: useSidebarSearchQuery(), commands: useSidebarCommands() };
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
			result.current.commands.setItemExpanded("wallet", true);
			result.current.commands.setSearchQuery("rew");
		});

		expect(result.current).toMatchObject({ isOpen: false, expandedItems: { wallet: true }, searchQuery: "rew" });
	});

	it("keeps command identities stable across renders", () => {
		const { result, rerender } = renderHook(useSidebarCommands, { wrapper });
		const first = result.current;

		rerender();

		expect(result.current).toBe(first);
	});

	it("restores saved preferences after mount and saves changes back", () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen: false, sectionOrder: null, expandedItems: { wallet: true } }));

		const { result } = renderHook(useSidebarProbe, { wrapper });
		expect(result.current).toMatchObject({ isOpen: false, expandedItems: { wallet: true } });

		act(() => {
			result.current.commands.open();
		});
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ isOpen: true, sectionOrder: null, expandedItems: { wallet: true } }));
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
