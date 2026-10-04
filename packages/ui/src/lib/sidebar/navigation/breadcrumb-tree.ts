/** URL path split into segments (`/users/123` → `["users", "123"]`). */
export type PathSegments = readonly string[];

/** Splits a pathname into non-empty segments. O(d) where d = path depth. */
export function segmentsOfPath(pathname: string): PathSegments {
	return pathname.split("/").filter((segment) => segment.length > 0);
}

/** Strips trailing slashes (`/x/` → `/x`). O(d). */
export function normalizePath(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Counts leading segments shared by two arrays. O(min(a, b)).
 *
 * Optional `equals` supports non-string segment types without casting.
 */
export function longestSharedPrefix<TSegment>(left: readonly TSegment[], right: readonly TSegment[], equals: (leftValue: TSegment, rightValue: TSegment) => boolean): number {
	let index = 0;
	while (index < left.length && index < right.length) {
		const leftValue = left[index];
		const rightValue = right[index];
		if (leftValue === undefined || rightValue === undefined || !equals(leftValue, rightValue)) {
			break;
		}
		index += 1;
	}
	return index;
}

/** Leading URL segments shared between a pathname and a menu URL. O(d). */
export function longestSharedSegmentPrefix(pathname: string, menuUrl: string): number {
	return longestSharedPrefix(segmentsOfPath(pathname), segmentsOfPath(menuUrl), (left, right) => left === right);
}

/** Whether `pathname` equals or extends `menuUrl` with further segments. O(d). */
export function isPathAncestor(menuUrl: string, pathname: string): boolean {
	if (pathname === menuUrl) {
		return true;
	}
	return pathname.startsWith(`${menuUrl}/`);
}

/**
 * Whether two URLs share the same first segment (`/users/all` vs `/users/123`).
 * O(d). Used at section roots only — not when walking children.
 */
export function sharesPathSegmentRoot(menuUrl: string, pathname: string): boolean {
	const menuSegments = segmentsOfPath(menuUrl);
	const pathSegments = segmentsOfPath(pathname);
	if (menuSegments.length === 0 || pathSegments.length === 0) {
		return false;
	}
	return menuSegments[0] === pathSegments[0];
}

/** How a nav tree's URL path and child nodes are read, whatever the node type. */
export interface NavTreeShape<TNode> {
	readonly getUrl: (node: TNode) => string;
	readonly getChildren: (node: TNode) => readonly TNode[];
}

/**
 * The deepest menu match for `pathname`: the chain of nodes from a root down
 * to the node whose URL is `pathname` (`kind: "exact"`) or its closest
 * ancestor (`kind: "ancestor"` — the caller labels the segments below it).
 */
export interface NavTreeMatch<TNode> {
	readonly kind: "exact" | "ancestor";
	/** Root first, matched node last. Never empty. */
	readonly chain: readonly TNode[];
	/** The matched (last) node's URL. */
	readonly url: string;
}

/** Deepest match below (and including) `node`, or `null` when `node` is neither `pathname` nor one of its ancestors. */
function matchNode<TNode>(node: TNode, pathname: string, shape: NavTreeShape<TNode>): NavTreeMatch<TNode> | null {
	const url = shape.getUrl(node);
	if (url === pathname) {
		return { kind: "exact", chain: [node], url };
	}
	if (!isPathAncestor(url, pathname)) {
		return null;
	}
	const below = findDeepestNavMatch(shape.getChildren(node), pathname, shape);
	if (below === null) {
		return { kind: "ancestor", chain: [node], url };
	}
	// A child sharing its parent's URL ("Users" → "All users", both `/users`)
	// is the same page: the parent stands for it, so it is not crumbed twice.
	const [firstBelow, ...restBelow] = below.chain;
	const descendants = firstBelow !== undefined && shape.getUrl(firstBelow) === url ? restBelow : below.chain;
	return { kind: below.kind, chain: [node, ...descendants], url: below.url };
}

/**
 * Finds the deepest node matching `pathname` across `roots`: an exact URL
 * match, otherwise the closest ancestor — **leaf or branch**, so a leaf like
 * Catalog → Products still anchors `/catalog/products/42`. The longest matched
 * URL wins; the first in menu order wins a tie. Only branches whose URL is an
 * ancestor of `pathname` are descended. O(n · d) for n nodes of depth d.
 */
export function findDeepestNavMatch<TNode>(roots: readonly TNode[], pathname: string, shape: NavTreeShape<TNode>): NavTreeMatch<TNode> | null {
	let best: NavTreeMatch<TNode> | null = null;
	for (const root of roots) {
		const match = matchNode(root, pathname, shape);
		if (match !== null && (best === null || match.url.length > best.url.length)) {
			best = match;
		}
	}
	return best;
}

/** Replaces the final trail item. O(n) copy of prefix, n = trail length. */
export function replaceLastTrailItem<TItem>(trail: readonly TItem[], item: TItem): readonly TItem[] {
	if (trail.length === 0) {
		return [item];
	}
	const lastIndex = trail.length - 1;
	return [...trail.slice(0, lastIndex), item];
}

/** Updates the final trail item via `updater`. O(n) copy of prefix. */
export function updateLastTrailItem<TItem>(trail: readonly TItem[], updater: (last: TItem) => TItem): readonly TItem[] {
	if (trail.length === 0) {
		return trail;
	}
	const lastIndex = trail.length - 1;
	const last = trail[lastIndex];
	if (last === undefined) {
		return trail;
	}
	return replaceLastTrailItem(trail, updater(last));
}
