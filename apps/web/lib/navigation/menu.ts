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
 *   are never active themselves** (no parent/grandparent highlighting): exact
 *   page entries light up (one per root branch — the deepest, so "My Wallet"
 *   stays dark while "Active Rewards" is the current page); on unmapped detail
 *   pages the single closest match (longest URL, deeper item on ties) lights up.
 * - `autoExpandedItems` — every ancestor of an active item (the active branch
 *   still auto-expands).
 */
export function computeRouteState(items: readonly CompiledSidebarMenuItem[], pathname: string): RouteState {
	const activeItems: Record<string, boolean> = {};
	const autoExpandedItems: Record<string, boolean> = {};
	const matches: RouteMatch[] = [];

	const walk = (item: CompiledSidebarMenuItem, rootId: string, depth: number, ancestors: readonly string[]): void => {
		// Disabled items are never navigable, so they must never highlight.
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
