import sidebarMenuJson from "./sidebar-menu.json";

import { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
import { SidebarMenuDataSchema, type CompiledSidebarMenuData, type SidebarMenuData } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

import { ADMIN_MENU_AUTHORIZATION, applyMenuAuthorization } from "./menu-authorization";

export { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
export type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

/**
 * Validated admin sidebar menu JSON with per-page capability requirements
 * applied (`ADMIN_MENU_AUTHORIZATION`) — loaded into `useSidebarStore` at init.
 */
export const SIDEBAR_MENU_DATA: SidebarMenuData = applyMenuAuthorization(SidebarMenuDataSchema.parse(sidebarMenuJson), ADMIN_MENU_AUTHORIZATION);

/** Compiled menu snapshot for non-store consumers (tests, palette flattening). */
export const SIDEBAR_MENU: CompiledSidebarMenuData = compileMenu(SIDEBAR_MENU_DATA);
