import { z } from "zod";

export interface SidebarMenuItemLike {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly icon?: string | undefined;
	readonly disabled?: boolean | undefined;
	readonly children?: readonly SidebarMenuItemLike[] | undefined;
}

export type PanelSectionColor = "blue" | "green" | "amber" | "rose" | "purple" | "teal";

export interface SidebarMenuDataLike {
	readonly sections: readonly { readonly title: string; readonly items: readonly SidebarMenuItemLike[]; readonly color?: PanelSectionColor | undefined }[];
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

/** A route match found while walking the menu tree. */
interface RouteMatch {
	readonly id: string;
	/** The top-level item this match was found under (aliases in other sections are separate branches). */
	readonly rootId: string;
	/** Ids of the strict ancestors of this item — they must auto-expand. */
	readonly ancestors: readonly string[];
	readonly urlLength: number;
	readonly depth: number;
	readonly isExact: boolean;
}

/** Closest match to `pathname` = longest matching URL; deeper item wins ties (a parent sharing its URL with its child). */
function isCloserMatch(candidate: RouteMatch, current: RouteMatch): boolean {
	if (candidate.urlLength !== current.urlLength) {
		return candidate.urlLength > current.urlLength;
	}
	return candidate.depth > current.depth;
}

/**
 * Walks the menu tree and returns:
 * - `activeItems` — items for the current route. **Ancestors of an active item
 *   are never active themselves** (no parent/grandparent highlighting):
 *   1. When menu entries point **exactly** at the current pathname, each root
 *      branch lights its deepest such entry — aliases in different sections all
 *      light up (Dashboard + Browse All on `/rewardhub`), but a parent sharing
 *      its URL with the active child ("My Rewards" → "All Rewards") stays dark.
 *   2. Otherwise (an unmapped detail page like `/rewards/<id>`) the **single
 *      closest match** — longest matching URL, deeper item on ties — lights up,
 *      so the closest child wins over its parent.
 * - `autoExpandedItems` — every ancestor of an active item (the branch still
 *   auto-expands; it just isn't highlighted itself).
 */
export function computeRouteState(items: readonly SidebarMenuItemLike[], pathname: string): RouteState {
	const activeItems: Record<string, boolean> = {};
	const autoExpandedItems: Record<string, boolean> = {};
	const matches: RouteMatch[] = [];

	const walk = (item: SidebarMenuItemLike, rootId: string, depth: number, ancestors: readonly string[]): void => {
		if (item.disabled !== true && isRouteActive(item.url, pathname)) {
			matches.push({ id: item.id, rootId, ancestors, urlLength: item.url.length, depth, isExact: pathname === item.url });
		}
		const children = item.children;
		if (children !== undefined) {
			const childAncestors = [...ancestors, item.id];
			for (const child of children) {
				walk(child, rootId, depth + 1, childAncestors);
			}
		}
	};

	for (const item of items) {
		walk(item, item.id, 1, []);
	}

	const winners: RouteMatch[] = [];
	const exactMatches = matches.filter((match) => match.isExact);
	if (exactMatches.length > 0) {
		// Exact page entries win; one per root branch (the deepest, so parents
		// yield to the child that shares their URL).
		const winnersByRoot = new Map<string, RouteMatch>();
		for (const match of exactMatches) {
			const current = winnersByRoot.get(match.rootId);
			if (current === undefined || isCloserMatch(match, current)) {
				winnersByRoot.set(match.rootId, match);
			}
		}
		winners.push(...winnersByRoot.values());
	} else {
		// Unmapped page: light only the single closest match in the whole menu.
		const closest = matches.reduce<RouteMatch | null>((best, match) => (best === null || isCloserMatch(match, best) ? match : best), null);
		if (closest !== null) {
			winners.push(closest);
		}
	}

	for (const winner of winners) {
		activeItems[winner.id] = true;
		for (const ancestorId of winner.ancestors) {
			autoExpandedItems[ancestorId] = true;
		}
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
			acc.push({ ...item, children: hasMatchingChild ? filteredChildren : children });
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

/** One section of the sidebar as rendered: its items after the search filter. Computed here, never parsed from outside. */
export interface SidebarViewSection {
	readonly title: string;
	readonly items: readonly SidebarMenuItemLike[];
	readonly color?: PanelSectionColor | undefined;
}

/** Everything a panel sidebar renders for one pathname + search + section order (`buildSidebarView`). */
export interface SidebarView {
	readonly isSearching: boolean;
	readonly routeState: RouteState;
	readonly sections: readonly SidebarViewSection[];
	readonly sectionTitles: readonly string[];
	readonly bottomItems: readonly SidebarMenuItemLike[];
	readonly noResults: boolean;
}

export function buildSidebarView({
	menu,
	pathname,
	sectionOrder,
	searchQuery,
}: {
	readonly menu: SidebarMenuDataLike;
	readonly pathname: string;
	readonly sectionOrder: readonly string[] | null;
	readonly searchQuery: string;
}): SidebarView {
	const isSearching = searchQuery.trim().length > 0;

	const allItems: readonly SidebarMenuItemLike[] = [...menu.sections.flatMap((section) => section.items), ...menu.bottomItems];
	const routeState = computeRouteState(allItems, pathname);

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
