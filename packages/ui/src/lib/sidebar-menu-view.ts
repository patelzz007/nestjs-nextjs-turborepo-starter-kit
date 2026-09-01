import { z } from "zod";

export interface SidebarMenuItemLike {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly children?: readonly SidebarMenuItemLike[];
}

export type PanelSectionColor = "blue" | "green" | "amber" | "rose" | "purple" | "teal";

export interface SidebarMenuDataLike {
	readonly sections: readonly { readonly title: string; readonly items: readonly SidebarMenuItemLike[]; readonly color?: PanelSectionColor }[];
	readonly bottomItems: readonly SidebarMenuItemLike[];
}

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

export function computeRouteState(items: readonly SidebarMenuItemLike[], pathname: string, isHighlightParentItem: boolean): RouteState {
	const activeItems: Record<string, boolean> = {};
	const autoExpandedItems: Record<string, boolean> = {};

	const checkItem = (item: SidebarMenuItemLike, isRootLevel: boolean): { readonly isActive: boolean; readonly hasActiveChild: boolean } => {
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

function normalizeToken(token: string): string {
	return token.toLowerCase().trim();
}

function itemMatches(item: SidebarMenuItemLike, tokens: readonly string[]): boolean {
	const haystack = normalizeToken([item.title, item.url, item.icon ?? ""].join(" "));
	return tokens.every((token) => haystack.includes(token));
}

export function filterItemsBySearch<T extends SidebarMenuItemLike>(items: readonly T[], query: string): readonly T[] {
	if (query.trim().length === 0) {
		return items;
	}

	const tokens = query
		.split(/\s+/)
		.map(normalizeToken)
		.filter((token) => token.length > 0);
	if (tokens.length === 0) {
		return items;
	}

	return items.reduce<T[]>((acc, item) => {
		const titleMatch = itemMatches(item, tokens);

		if (item.disabled === true) {
			if (titleMatch) {
				acc.push(item);
			}
			return acc;
		}

		const children = item.children;
		const filteredChildren = children !== undefined ? filterItemsBySearch(children, query) : undefined;
		const hasMatchingChild = filteredChildren !== undefined && filteredChildren.length > 0;

		if (titleMatch || hasMatchingChild) {
			acc.push({ ...item, children: hasMatchingChild ? filteredChildren : children } as T);
		}

		return acc;
	}, []);
}

export function sectionHasActiveItem(items: readonly SidebarMenuItemLike[], activeItems: Readonly<Record<string, boolean>>): boolean {
	for (const item of items) {
		if (activeItems[item.id] === true) {
			return true;
		}
		const children = item.children;
		if (children !== undefined && sectionHasActiveItem(children, activeItems)) {
			return true;
		}
	}
	return false;
}

export const SidebarViewSectionSchema = z.object({
	title: z.string(),
	items: z.array(z.custom<SidebarMenuItemLike>()).readonly(),
	color: z.enum(["blue", "green", "amber", "rose", "purple", "teal"]).optional(),
});

export type SidebarViewSection = z.output<typeof SidebarViewSectionSchema>;

export const SidebarViewSchema = z.object({
	isSearching: z.boolean(),
	routeState: RouteStateSchema,
	sections: z.array(SidebarViewSectionSchema).readonly(),
	sectionTitles: z.array(z.string()).readonly(),
	bottomItems: z.array(z.custom<SidebarMenuItemLike>()).readonly(),
	noResults: z.boolean(),
});

export type SidebarView = z.output<typeof SidebarViewSchema>;

export function buildSidebarView({
	menu,
	pathname,
	sectionOrder,
	searchQuery,
	isHighlightParentItem,
}: {
	readonly menu: SidebarMenuDataLike;
	readonly pathname: string;
	readonly sectionOrder: readonly string[] | null;
	readonly searchQuery: string;
	readonly isHighlightParentItem: boolean;
}): SidebarView {
	const isSearching = searchQuery.trim().length > 0;

	const allItems: readonly SidebarMenuItemLike[] = [...menu.sections.flatMap((section) => section.items), ...menu.bottomItems];
	const routeState = computeRouteState(allItems, pathname, isHighlightParentItem);

	const filteredSections: readonly SidebarViewSection[] = menu.sections
		.map((section) => ({ title: section.title, items: filterItemsBySearch(section.items, searchQuery), color: section.color }))
		.filter((section) => section.items.length > 0);

	const bottomItems = filterItemsBySearch(menu.bottomItems, searchQuery);

	let sections = filteredSections;
	if (sectionOrder !== null) {
		sections = [...filteredSections].sort((a, b): number => {
			const aIndex = sectionOrder.indexOf(a.title);
			const bIndex = sectionOrder.indexOf(b.title);
			if (aIndex === -1 && bIndex === -1) {
				return 0;
			}
			if (aIndex === -1) {
				return 1;
			}
			if (bIndex === -1) {
				return -1;
			}
			return aIndex - bIndex;
		});
	}

	const noResults = isSearching && sections.length === 0 && bottomItems.length === 0;

	return {
		isSearching,
		routeState,
		sections,
		sectionTitles: sections.map((section) => section.title),
		bottomItems,
		noResults,
	};
}
