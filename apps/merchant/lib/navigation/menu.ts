import { z } from "zod";

import type { CompiledSidebarMenuItem } from "@/lib/navigation/sidebar";

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

export const RouteStateSchema = z.object({
	activeItems: z.record(z.string(), z.boolean()),
	autoExpandedItems: z.record(z.string(), z.boolean()),
});

export type RouteState = z.output<typeof RouteStateSchema>;

export function computeRouteState(items: readonly CompiledSidebarMenuItem[], pathname: string, isHighlightParentItem: boolean): RouteState {
	const activeItems: Record<string, boolean> = {};
	const autoExpandedItems: Record<string, boolean> = {};

	const checkItem = (item: CompiledSidebarMenuItem, isRootLevel: boolean): { readonly isActive: boolean; readonly hasActiveChild: boolean } => {
		const itemId = item.id;
		const children = item.children;
		const hasChildren = children !== undefined && children.length > 0;
		const isExactMatch = item.disabled !== true && isRouteActive(item.url, pathname) && (hasChildren || pathname === item.url);

		let hasActiveChild = false;
		if (children !== undefined) {
			for (const child of children) {
				const result = checkItem(child, false);
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
		checkItem(item, true);
	}

	return { activeItems, autoExpandedItems };
}

export function collectAllMenuItems(
	sections: readonly { readonly items: readonly CompiledSidebarMenuItem[] }[],
	bottomItems: readonly CompiledSidebarMenuItem[],
): readonly CompiledSidebarMenuItem[] {
	const items: CompiledSidebarMenuItem[] = [];

	const walk = (nodes: readonly CompiledSidebarMenuItem[]): void => {
		for (const node of nodes) {
			items.push(node);
			if (node.children !== undefined) {
				walk(node.children);
			}
		}
	};

	for (const section of sections) {
		walk(section.items);
	}
	walk(bottomItems);

	return items;
}
