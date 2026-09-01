import userSidebarMenuJson from "@/data/user-sidebar-menu.json";

import { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
import { SidebarMenuDataSchema, type CompiledSidebarMenuData, type SidebarMenuData } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

export { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
export type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

/** Validated consumer sidebar menu JSON — loaded into `useWebSidebarStore` at init. */
export const USER_SIDEBAR_MENU_DATA: SidebarMenuData = SidebarMenuDataSchema.parse(userSidebarMenuJson);

/** Compiled menu snapshot for non-store consumers (tests, breadcrumbs). */
export const USER_SIDEBAR_MENU: CompiledSidebarMenuData = compileMenu(USER_SIDEBAR_MENU_DATA);
