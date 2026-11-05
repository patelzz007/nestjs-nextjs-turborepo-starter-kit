// Applies an app's per-page capability requirements to its menu: each item whose URL the map lists takes
// that requirement (any depth), so the JSON stays plain and every slug a compile-checked
// `PERMISSION.*` value in the app's TypeScript (the admin sidebar, the mobile drawer).

import type { SidebarAuthorization, SidebarMenuData, SidebarMenuItem } from "./sidebar-menu-schema";

function applyToItem(item: SidebarMenuItem, requirements: ReadonlyMap<string, SidebarAuthorization>): SidebarMenuItem {
	const authorization = requirements.get(item.url) ?? item.authorization;
	const children = item.children?.map((child) => applyToItem(child, requirements));
	return {
		...item,
		...(authorization !== undefined ? { authorization } : {}),
		...(children !== undefined ? { children } : {}),
	};
}

/** Returns `menu` with each item's `authorization` taken from `requirements` (by URL) when listed there. */
export function applyMenuAuthorization(menu: SidebarMenuData, requirements: ReadonlyMap<string, SidebarAuthorization>): SidebarMenuData {
	return {
		header: menu.header,
		sections: menu.sections.map((section) => ({ ...section, items: section.items.map((item) => applyToItem(item, requirements)) })),
		bottomItems: menu.bottomItems.map((item) => applyToItem(item, requirements)),
	};
}
