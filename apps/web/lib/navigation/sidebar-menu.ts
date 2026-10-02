import userSidebarMenuJson from "@/data/user-sidebar-menu.json";

import { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
import { SidebarMenuDataSchema, type CompiledSidebarMenuData, type SidebarMenuData } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

import { applyWebRouteAuthorization } from "@/lib/navigation/route-access";

export { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
export type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

/**
 * Validated consumer sidebar menu JSON with each page's capability
 * requirement taken from the route-access table (`WEB_ROUTE_ACCESS`), so an
 * item is visible exactly when its page is allowed — loaded into
 * `useWebSidebarStore` at init.
 */
export const USER_SIDEBAR_MENU_DATA: SidebarMenuData = applyWebRouteAuthorization(SidebarMenuDataSchema.parse(userSidebarMenuJson));

/** Compiled menu snapshot for non-store consumers (tests, breadcrumbs). */
export const USER_SIDEBAR_MENU: CompiledSidebarMenuData = compileMenu(USER_SIDEBAR_MENU_DATA);
