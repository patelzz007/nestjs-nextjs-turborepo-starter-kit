import type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import type { MerchantCapability } from "@workspace/shared";
import { merchantHasCapability } from "@workspace/shared";

interface CapabilityMenuItem {
	readonly requiredCapability?: MerchantCapability;
	readonly children?: readonly CapabilityMenuItem[];
}

function isMenuItemVisible(item: CapabilityMenuItem, capabilities: readonly MerchantCapability[]): boolean {
	if (item.requiredCapability === undefined) {
		return true;
	}
	return merchantHasCapability(capabilities, item.requiredCapability);
}

function filterMenuItems<T extends CapabilityMenuItem>(items: readonly T[], capabilities: readonly MerchantCapability[]): readonly T[] {
	const filtered: T[] = [];
	for (const item of items) {
		if (!isMenuItemVisible(item, capabilities)) {
			continue;
		}
		const children = item.children !== undefined ? filterMenuItems(item.children, capabilities) : undefined;
		filtered.push({
			...item,
			children,
		});
	}
	return filtered;
}

/** Filters raw sidebar menu JSON by the active membership's capabilities. */
export function filterSidebarMenuData(menu: SidebarMenuData, capabilities: readonly MerchantCapability[]): SidebarMenuData {
	return {
		header: menu.header,
		sections: menu.sections
			.map((section) => ({
				...section,
				items: filterMenuItems(section.items, capabilities),
			}))
			.filter((section) => section.items.length > 0),
		bottomItems: filterMenuItems(menu.bottomItems, capabilities),
	};
}

/** Filters a compiled sidebar menu snapshot by capabilities (for render-time filtering). */
export function filterCompiledSidebarMenu(menu: CompiledSidebarMenuData, capabilities: readonly MerchantCapability[]): CompiledSidebarMenuData {
	return {
		header: menu.header,
		sections: menu.sections
			.map((section) => ({
				...section,
				items: filterMenuItems(section.items, capabilities),
			}))
			.filter((section) => section.items.length > 0),
		bottomItems: filterMenuItems(menu.bottomItems, capabilities),
	};
}

/** Returns whether a URL is reachable for the given capability set (uses menu item requirements). */
export function isSidebarUrlAllowed(url: string, items: readonly SidebarMenuItem[] | readonly CompiledSidebarMenuItem[], capabilities: readonly MerchantCapability[]): boolean {
	for (const item of items) {
		if (item.url === url) {
			return isMenuItemVisible(item, capabilities);
		}
		if (item.children !== undefined && isSidebarUrlAllowed(url, item.children, capabilities)) {
			return true;
		}
	}
	return false;
}
