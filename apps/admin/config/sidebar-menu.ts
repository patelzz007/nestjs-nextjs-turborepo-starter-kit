import sidebarMenuJson from "@/config/sidebar-menu.json";

import type { SidebarMenuData } from "@/types/sidebar";

/**
 * Static import of the sidebar menu JSON — TypeScript validates it against
 * `SidebarMenuData`. The raw JSON lives in `config/sidebar-menu.json`; this
 * module is the single typed entry point every consumer imports.
 */
export const SIDEBAR_MENU: SidebarMenuData = sidebarMenuJson;
