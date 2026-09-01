import sidebarMenuJson from "@/data/merchant-sidebar-menu.json";

import { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
import { SidebarMenuDataSchema, type CompiledSidebarMenuData, type SidebarMenuData } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

export { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
export type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

/** Validated merchant sidebar menu JSON — loaded into `useMerchantSidebarStore` at init. */
export const MERCHANT_SIDEBAR_MENU_DATA: SidebarMenuData = SidebarMenuDataSchema.parse(sidebarMenuJson);

/** Compiled menu snapshot for non-store consumers (tests, breadcrumbs). */
export const MERCHANT_SIDEBAR_MENU: CompiledSidebarMenuData = compileMenu(MERCHANT_SIDEBAR_MENU_DATA);
