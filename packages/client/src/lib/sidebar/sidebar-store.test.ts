// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SidebarMenuData } from "./sidebar-menu-schema";
import { createSidebarStore } from "./sidebar-store";

const STORAGE_KEY = "test-sidebar-state";

const SAMPLE_MENU: SidebarMenuData = {
	header: { title: "Test App", subtitle: "Panel" },
	sections: [
		{
			title: "Main",
			items: [
				{ title: "Overview", url: "/", icon: "LayoutDashboard" },
				{ title: "Settings", url: "/settings", icon: "Settings" },
			],
		},
	],
	bottomItems: [{ title: "Support", url: "/support", icon: "LifeBuoy" }],
};

describe("createSidebarStore", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("loads compiled menu JSON at init", () => {
		const useSidebarStore = createSidebarStore({
			storageKey: STORAGE_KEY,
			devtoolsName: "TestSidebarStore",
			initialMenuData: SAMPLE_MENU,
		});

		expect(useSidebarStore.getState().menu.header.title).toBe("Test App");
		expect(useSidebarStore.getState().menu.sections[0]?.items[0]?.id).toBe("main-overview");
	});

	it("tracks current and previous page", () => {
		const useSidebarStore = createSidebarStore({
			storageKey: STORAGE_KEY,
			devtoolsName: "TestSidebarStore",
			initialMenuData: SAMPLE_MENU,
		});

		useSidebarStore.getState().setCurrentPage("/settings");
		expect(useSidebarStore.getState().currentPage).toBe("/settings");
		expect(useSidebarStore.getState().previousPage).toBeNull();

		useSidebarStore.getState().setCurrentPage("/support");
		expect(useSidebarStore.getState().currentPage).toBe("/support");
		expect(useSidebarStore.getState().previousPage).toBe("/settings");
	});

	it("toggles isOpen and dispatches named actions for DevTools", () => {
		const useSidebarStore = createSidebarStore({
			storageKey: STORAGE_KEY,
			devtoolsName: "TestSidebarStore",
			initialMenuData: SAMPLE_MENU,
		});

		expect(useSidebarStore.getState().isOpen).toBe(true);

		useSidebarStore.getState().close();
		expect(useSidebarStore.getState().isOpen).toBe(false);

		useSidebarStore.getState().toggle();
		expect(useSidebarStore.getState().isOpen).toBe(true);
	});

	it("persists isOpen and sectionOrder but not searchQuery or menu", async () => {
		const useSidebarStore = createSidebarStore({
			storageKey: STORAGE_KEY,
			devtoolsName: "TestSidebarStore",
			initialMenuData: SAMPLE_MENU,
		});

		useSidebarStore.getState().close();
		useSidebarStore.getState().moveSectionUp("Main", ["Main", "Settings"]);
		useSidebarStore.getState().setSearchQuery("billing");
		useSidebarStore.getState().setCurrentPage("/settings");

		await useSidebarStore.persist.rehydrate();

		const raw = localStorage.getItem(STORAGE_KEY);
		expect(raw).not.toBeNull();
		expect(raw).toContain("isOpen");
		expect(raw).not.toContain("searchQuery");
		expect(raw).not.toContain("currentPage");
		expect(useSidebarStore.getState().searchQuery).toBe("billing");
		expect(useSidebarStore.getState().currentPage).toBe("/settings");
	});

	it("caps persisted expandedItems at 20 entries", () => {
		const useSidebarStore = createSidebarStore({
			storageKey: STORAGE_KEY,
			devtoolsName: "TestSidebarStore",
			initialMenuData: SAMPLE_MENU,
		});

		for (let index = 0; index < 25; index += 1) {
			useSidebarStore.getState().setItemExpanded(`item-${String(index)}`, true);
		}

		const persisted = useSidebarStore.persist.getOptions().partialize?.(useSidebarStore.getState());
		expect(Object.keys(persisted?.expandedItems ?? {})).toHaveLength(20);
	});
});
