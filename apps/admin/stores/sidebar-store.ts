"use client";

import { SIDEBAR_MENU_DATA } from "@/lib/navigation/sidebar-menu";
import { createSidebarStore, type SidebarState } from "@workspace/client/lib/sidebar/sidebar-store";

export type { SidebarState };

export const useSidebarStore = createSidebarStore({
	storageKey: "admin-sidebar-state",
	devtoolsName: "AdminSidebarStore",
	initialMenuData: SIDEBAR_MENU_DATA,
});

/** Convenience alias — callers can subscribe to the whole store or select a slice. */
export const useSidebar = useSidebarStore;
