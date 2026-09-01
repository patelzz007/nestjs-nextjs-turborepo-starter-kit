"use client";

import { USER_SIDEBAR_MENU_DATA } from "@/lib/navigation/sidebar-menu";
import { createSidebarStore, type SidebarState } from "@workspace/client/lib/sidebar/sidebar-store";

export type WebSidebarState = SidebarState;

export const useWebSidebarStore = createSidebarStore({
	storageKey: "web-sidebar-state",
	devtoolsName: "WebSidebarStore",
	initialMenuData: USER_SIDEBAR_MENU_DATA,
});

export const useSidebar = useWebSidebarStore;
