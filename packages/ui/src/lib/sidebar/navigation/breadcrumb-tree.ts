import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";

/** URL path split into segments (`/users/123` → `["users", "123"]`). */
export type PathSegments = readonly string[];

/**
 * Maps a nav-tree node type to breadcrumb fields. Keeps tree walking generic
 * while each app supplies its own node shape (`SidebarMenuItem`, etc.).
 */
export interface NavTreeAdapter<TNode> {
	getUrl: (node: TNode) => string;
	getChildren: (node: TNode) => readonly TNode[];
	toLinkedCrumb: (node: TNode) => BreadcrumbItem;
	toCurrentCrumb: (node: TNode) => BreadcrumbItem;
}

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

/**
 * Flattens a nav tree into a single list. O(n) nodes, O(n) total work.
 * Uses an explicit stack so deep menus do not recurse past the call stack.
 */
export function flattenNavTree<TNode>(roots: readonly TNode[], getChildren: (node: TNode) => readonly TNode[]): TNode[] {
	const flat: TNode[] = [];
	const stack: TNode[] = [...roots];
	while (stack.length > 0) {
		const node = stack.pop();
		if (node === undefined) {
			continue;
		}
		flat.push(node);
		const children = getChildren(node);
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const child = children[index];
			if (child !== undefined) {
				stack.push(child);
			}
		}
	}
	return flat;
}

/**
 * Longest shared segment prefix between `pathname` and any node URL in `nodes`.
 * O(n · d) — n = node count, d = typical path depth (small for admin routes).
 */
export function bestSharedSegmentPrefix<TNode>(pathname: string, nodes: readonly TNode[], getUrl: (node: TNode) => string): number {
	let best = 0;
	for (const node of nodes) {
		const shared = longestSharedSegmentPrefix(pathname, getUrl(node));
		if (shared > best) {
			best = shared;
		}
	}
	return best;
}

export interface WalkNavTreeOptions {
	/** Exact matches render as linked crumbs (dynamic-segment fallback). */
	readonly asParent?: boolean;
}

/**
 * Walks a nav tree for `pathname`, appending crumbs to `trail`. O(n) nodes visited
 * along the matching branch (worst case O(n) for the whole tree).
 */
export function walkNavTreeForPath<TNode>(
	items: readonly TNode[],
	pathname: string,
	trail: BreadcrumbItem[],
	adapter: NavTreeAdapter<TNode>,
	options: WalkNavTreeOptions = {},
): boolean {
	const asParent = options.asParent ?? false;
	for (const item of items) {
		const url = adapter.getUrl(item);
		if (url === pathname) {
			trail.push(asParent ? adapter.toLinkedCrumb(item) : adapter.toCurrentCrumb(item));
			return true;
		}
		const children = adapter.getChildren(item);
		if (children.length > 0 && isPathAncestor(url, pathname)) {
			trail.push(adapter.toLinkedCrumb(item));
			if (walkNavTreeForPath(children, pathname, trail, adapter, options)) {
				return true;
			}
			return true;
		}
	}
	return false;
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
