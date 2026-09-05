import type { CapabilityMenuItem, CapabilityMenuResponse } from "@workspace/shared";

import type { SidebarMenuData, SidebarMenuItem } from "../sidebar/sidebar-menu-schema";

function mapMenuItem(item: CapabilityMenuItem): SidebarMenuItem {
	const requiredCapabilities = item.requiredCapabilities.length > 0 ? item.requiredCapabilities : undefined;
	const children = item.children.length > 0 ? item.children.map(mapMenuItem) : undefined;

	return {
		title: item.title,
		url: item.url,
		icon: item.icon ?? undefined,
		disabled: item.disabled,
		requiredCapabilities,
		children,
	};
}

/** Converts `GET /navigation/menu` payload into sidebar store JSON. */
export function capabilityMenuResponseToSidebarData(response: CapabilityMenuResponse): SidebarMenuData {
	return {
		header: response.header,
		sections: response.sections.map((section) => ({
			title: section.title,
			color: section.color,
			items: section.items.map(mapMenuItem),
		})),
		bottomItems: [],
	};
}
