import { CapabilityMenuResponseSchema, type CapabilityMenuItem, type CapabilityMenuResponse } from "@workspace/shared";

import type { SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

function mapSidebarItem(item: SidebarMenuItem, id: string): CapabilityMenuItem {
	const requiredCapabilities = item.requiredCapabilities !== undefined ? [...item.requiredCapabilities] : [];
	const children = item.children !== undefined ? item.children.map((child, index) => mapSidebarItem(child, `${id}-${String(index)}`)) : [];

	return {
		id,
		title: item.title,
		url: item.url,
		icon: item.icon ?? null,
		disabled: item.disabled ?? false,
		requiredCapabilities,
		matchType: "ANY",
		children,
	};
}

/** Converts static sidebar JSON into the navigation API shape for SSR bootstrap. */
export function sidebarMenuDataToCapabilityMenuResponse(menu: SidebarMenuData): CapabilityMenuResponse {
	const response: CapabilityMenuResponse = {
		header: menu.header,
		sections: menu.sections.map((section, sectionIndex) => ({
			title: section.title,
			color: section.color,
			items: section.items.map((item, itemIndex) => mapSidebarItem(item, `section-${String(sectionIndex)}-item-${String(itemIndex)}`)),
		})),
	};

	return CapabilityMenuResponseSchema.parse(response);
}
