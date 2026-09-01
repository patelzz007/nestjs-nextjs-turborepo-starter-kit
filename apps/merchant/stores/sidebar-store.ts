"use client";

import { MERCHANT_SIDEBAR_MENU_DATA } from "@/lib/navigation/sidebar-menu";
import { createSidebarStore, type SidebarState } from "@workspace/client/lib/sidebar/sidebar-store";

export type MerchantSidebarState = SidebarState;

export const useMerchantSidebarStore = createSidebarStore({
	storageKey: "merchant-sidebar-state",
	devtoolsName: "MerchantSidebarStore",
	initialMenuData: MERCHANT_SIDEBAR_MENU_DATA,
});

export const useSidebar = useMerchantSidebarStore;
