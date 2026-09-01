import sidebarMenuJson from "./sidebar-menu.json";

import { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
import { SidebarMenuDataSchema, type CompiledSidebarMenuData, type SidebarMenuData } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

export { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
export type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

/** Validated admin sidebar menu JSON — loaded into `useSidebarStore` at init. */
export const SIDEBAR_MENU_DATA: SidebarMenuData = SidebarMenuDataSchema.parse(sidebarMenuJson);

/** Compiled menu snapshot for non-store consumers (tests, palette flattening). */
export const SIDEBAR_MENU: CompiledSidebarMenuData = compileMenu(SIDEBAR_MENU_DATA);
