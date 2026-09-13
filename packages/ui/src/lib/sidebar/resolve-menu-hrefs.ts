import type { SidebarMenuDataLike, SidebarMenuItemLike } from "./menu-view";

/** Maps a sidebar menu URL to the browser href used for navigation and active-state checks. */
export type SidebarResolveHref = (menuUrl: string) => string;

/** Identity resolver — use when menu URLs already match browser paths (single-tenant apps). */
export function identitySidebarResolveHref(menuUrl: string): string {
	return menuUrl;
}

export function withResolvedMenuItemHref<T extends SidebarMenuItemLike>(item: T, resolveHref: SidebarResolveHref): T {
	const children = item.children;

	return {
		...item,
		url: resolveHref(item.url),
		children: children === undefined ? children : children.map((child) => withResolvedMenuItemHref(child, resolveHref)),
	};
}

export function withResolvedSidebarMenuUrls<T extends SidebarMenuDataLike>(menu: T, resolveHref: SidebarResolveHref): T {
	return {
		...menu,
		sections: menu.sections.map((section) => ({
			...section,
			items: section.items.map((item) => withResolvedMenuItemHref(item, resolveHref)),
		})),
		bottomItems: menu.bottomItems.map((item) => withResolvedMenuItemHref(item, resolveHref)),
	};
}
