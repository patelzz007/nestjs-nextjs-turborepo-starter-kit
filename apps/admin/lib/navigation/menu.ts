import { z } from "zod";

import { CompiledSidebarMenuDataSchema, CompiledSidebarMenuItemSchema } from "@/lib/navigation/sidebar";
import type { CompiledSidebarMenuItem } from "@/lib/navigation/sidebar";

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

export const RouteStateSchema = z.object({
	activeItems: z.record(z.string(), z.boolean()),
	autoExpandedItems: z.record(z.string(), z.boolean()),
});

export type RouteState = z.output<typeof RouteStateSchema>;

/**
 * Walks the menu tree and returns:
 * - `activeItems` — every item that matches the current route (and, when
 *   `isHighlightParentItem` is set, the top-level ancestor of an active item).
 * - `autoExpandedItems` — every item that has an active descendant (so the
 *   active branch is expanded without any user interaction).
 *
 * Items are keyed by their **compiled `id`** (never the title) — ids are
 * globally unique, so same-titled items can't cross-highlight each other.
 */
export function computeRouteState(items: readonly CompiledSidebarMenuItem[], pathname: string, isHighlightParentItem: boolean): RouteState {
	const activeItems: Record<string, boolean> = {};
	const autoExpandedItems: Record<string, boolean> = {};

	const checkItem = (item: CompiledSidebarMenuItem, isRootLevel: boolean): { readonly isActive: boolean; readonly hasActiveChild: boolean } => {
		const itemId = item.id;
		const children = item.children;
		const hasChildren = children !== undefined && children.length > 0;

		// Route matching rules:
		// - Disabled items are never navigable, so they must never highlight.
		// - Parents (items with children) match their URL plus any nested route
		//   below it — "Docs Home" (/docs) stays lit on /docs/telescope.
		// - Leaf items match their URL **exactly**. A leaf whose URL is a prefix
		//   of a sibling page ("View All Docs" at /docs vs "Telescope" at
		//   /docs/telescope) must not light up while that sibling is active.
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

/** Lowercases + trims a single search token so comparisons are case-insensitive. */
function normalizeToken(token: string): string {
	return token.toLowerCase().trim();
}

/**
 * True when every non-empty query token appears somewhere in the item's
 * `title`, `url`, or `icon` (sidebar audit, improvement 5). Searching
 * "security sessions" (two tokens) matches the Settings → Security → Sessions
 * branch via its title path, and "/docs/prisma" matches by URL.
 */
function itemMatches(item: CompiledSidebarMenuItem, tokens: readonly string[]): boolean {
	const haystack = normalizeToken([item.title, item.url, item.icon ?? ""].join(" "));
	return tokens.every((token) => haystack.includes(token));
}

/**
 * Recursively keeps only items (and their children) that match the query.
 * A parent is kept when it matches itself OR when any descendant matches
 * (pruned to the matching branch). Compiled `id`s flow through untouched.
 */
export function filterItemsBySearch(items: readonly CompiledSidebarMenuItem[], query: string): readonly CompiledSidebarMenuItem[] {
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

	return items.reduce<CompiledSidebarMenuItem[]>((acc, item) => {
		const titleMatch = itemMatches(item, tokens);

		// Disabled parents render as a single dimmed row (audit #14) — their
		// children are pruned at render, so a child-only match would surface an
		// invisible result. Never recurse into a disabled parent's subtree.
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
			acc.push({ ...item, children: hasMatchingChild ? filteredChildren : children });
		}

		return acc;
	}, []);
}

/** True when this item (or any descendant) is in the active-items map. */
export function sectionHasActiveItem(items: readonly CompiledSidebarMenuItem[], activeItems: Readonly<Record<string, boolean>>): boolean {
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

/** A section after search filtering + ordering — what the sidebar actually renders. */
export const SidebarViewSectionSchema = z.object({
	title: z.string(),
	items: z.array(CompiledSidebarMenuItemSchema).readonly(),
});

export type SidebarViewSection = z.output<typeof SidebarViewSectionSchema>;

/**
 * Everything the sidebar needs to render, computed **once** per change in the
 * dashboard layout and passed to BOTH the desktop and mobile `Sidebar`
 * instances (sidebar audit, improvement 20) — the two instances share one
 * route computation, one search pass, and one ordering pass instead of each
 * doing the full walk.
 */
export const SidebarViewSchema = z.object({
	isSearching: z.boolean(),
	routeState: RouteStateSchema,
	sections: z.array(SidebarViewSectionSchema).readonly(),
	sectionTitles: z.array(z.string()).readonly(),
	bottomItems: z.array(CompiledSidebarMenuItemSchema).readonly(),
	noResults: z.boolean(),
});

export type SidebarView = z.output<typeof SidebarViewSchema>;

export const SidebarViewParamsSchema = z.object({
	menu: CompiledSidebarMenuDataSchema,
	pathname: z.string(),
	sectionOrder: z.array(z.string()).readonly().nullable(),
	searchQuery: z.string(),
	isHighlightParentItem: z.boolean(),
});

export type SidebarViewParams = z.output<typeof SidebarViewParamsSchema>;

/**
 * Builds the sidebar render model: route state (from the FULL menu, so search
 * never affects highlighting), then search-filtered + reordered sections.
 * Pure and unit-testable — the component layer just renders it.
 */
export function buildSidebarView({ menu, pathname, sectionOrder, searchQuery, isHighlightParentItem }: SidebarViewParams): SidebarView {
	const isSearching = searchQuery.trim().length > 0;

	const allItems: readonly CompiledSidebarMenuItem[] = [...menu.sections.flatMap((section) => section.items), ...menu.bottomItems];
	const routeState = computeRouteState(allItems, pathname, isHighlightParentItem);

	const filteredSections: readonly SidebarViewSection[] = menu.sections
		.map((section) => ({ title: section.title, items: filterItemsBySearch(section.items, searchQuery) }))
		.filter((section) => section.items.length > 0);

	const bottomItems = filterItemsBySearch(menu.bottomItems, searchQuery);

	// A stored custom order wins when it covers the current section list;
	// otherwise the natural order is used (unknown titles sort last).
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

/** Flattens the menu tree into searchable entries carrying their breadcrumb trail. */
export const SearchableMenuItemSchema = z.object({
	title: z.string(),
	url: z.string(),
	icon: z.string().optional(),
	section: z.string(),
	breadcrumb: z.array(z.string()).readonly(),
});

export type SearchableMenuItem = z.output<typeof SearchableMenuItemSchema>;

export function flattenMenuItems(items: readonly CompiledSidebarMenuItem[], section: string, breadcrumb: readonly string[], acc: SearchableMenuItem[]): void {
	for (const item of items) {
		if (item.disabled === true) {
			continue;
		}
		const currentBreadcrumb: readonly string[] = [...breadcrumb, item.title];
		// The schema-derived `SearchableMenuItem.breadcrumb` is `readonly string[]`
		// (`.readonly()`), so the spread is a defensive mutable copy that stays
		// assignable either way.
		acc.push({ title: item.title, url: item.url, icon: item.icon, section, breadcrumb: [...currentBreadcrumb] });
		const children = item.children;
		if (children !== undefined) {
			flattenMenuItems(children, section, currentBreadcrumb, acc);
		}
	}
}
