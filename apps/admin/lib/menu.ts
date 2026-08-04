import type { SidebarMenuItem } from "@/types/sidebar";

/** Unique id for an item based on its breadcrumb trail ("Analytics/Reports/Sales" → slug). */
export function createItemId(item: SidebarMenuItem, parentId: string): string {
	const id = item.title.toLowerCase().replace(/\s+/g, "-");
	return parentId.length > 0 ? `${parentId}-${id}` : id;
}

/**
 * True when `href` is the current route. `/` only matches the root; anything
 * else matches itself plus all nested routes below it ("/organization" does
 * not match "/organizations").
 */
export function isRouteActive(href: string, pathname: string): boolean {
	if (href === "#") {
		return false;
	}
	if (href === "/") {
		return pathname === "/";
	}
	if (pathname.startsWith(href)) {
		const nextChar = pathname.charAt(href.length);
		return nextChar === "" || nextChar === "/";
	}
	return false;
}

export interface RouteState {
	readonly activeItems: Readonly<Record<string, boolean>>;
	readonly autoExpandedItems: Readonly<Record<string, boolean>>;
}

/**
 * Walks the menu tree and returns:
 * - `activeItems` — every item that matches the current route (and, when
 *   `isHighlightParentItem` is set, the top-level ancestor of an active item).
 * - `autoExpandedItems` — every item that has an active descendant (so the
 *   active branch is expanded without any user interaction).
 */
export function computeRouteState(items: readonly SidebarMenuItem[], pathname: string, isHighlightParentItem: boolean): RouteState {
	const activeItems: Record<string, boolean> = {};
	const autoExpandedItems: Record<string, boolean> = {};

	const checkItem = (item: SidebarMenuItem, parentId: string, isRootLevel: boolean): { readonly isActive: boolean; readonly hasActiveChild: boolean } => {
		const itemId = createItemId(item, parentId);
		// Disabled items are never navigable, so they must never highlight.
		const isExactMatch = item.disabled !== true && isRouteActive(item.url, pathname);
		const children = item.children;

		let hasActiveChild = false;
		if (children !== undefined) {
			for (const child of children) {
				const result = checkItem(child, itemId, false);
				if (result.isActive || result.hasActiveChild) {
					hasActiveChild = true;
					autoExpandedItems[itemId] = true;
				}
			}
		}

		if (isHighlightParentItem) {
			if (isExactMatch || (isRootLevel && hasActiveChild)) {
				activeItems[itemId] = true;
			}
		} else if (isExactMatch) {
			activeItems[itemId] = true;
		}

		return { isActive: isExactMatch, hasActiveChild };
	};

	for (const item of items) {
		checkItem(item, "", true);
	}

	return { activeItems, autoExpandedItems };
}

/** Recursively keeps only items (and their children) that match the query. */
export function filterItemsBySearch(items: readonly SidebarMenuItem[], query: string): readonly SidebarMenuItem[] {
	if (query.trim().length === 0) {
		return items;
	}

	const lowerQuery = query.toLowerCase();
	return items.reduce<SidebarMenuItem[]>((acc, item) => {
		const titleMatch = item.title.toLowerCase().includes(lowerQuery);
		const children = item.children;
		const filteredChildren = children !== undefined ? filterItemsBySearch(children, query) : undefined;
		const hasMatchingChild = filteredChildren !== undefined && filteredChildren.length > 0;

		if (titleMatch || hasMatchingChild) {
			acc.push({ ...item, children: hasMatchingChild ? filteredChildren : children });
		}

		return acc;
	}, []);
}

/** Flattens the menu tree into searchable entries carrying their breadcrumb trail. */
export interface SearchableMenuItem {
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly section: string;
	readonly breadcrumb: readonly string[];
}

export function flattenMenuItems(items: readonly SidebarMenuItem[], section: string, breadcrumb: readonly string[], acc: SearchableMenuItem[]): void {
	for (const item of items) {
		if (item.disabled === true) {
			continue;
		}
		const currentBreadcrumb: readonly string[] = [...breadcrumb, item.title];
		acc.push({ title: item.title, url: item.url, icon: item.icon, section, breadcrumb: currentBreadcrumb });
		const children = item.children;
		if (children !== undefined) {
			flattenMenuItems(children, section, currentBreadcrumb, acc);
		}
	}
}
