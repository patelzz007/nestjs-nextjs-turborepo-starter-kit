import type { TOCItemType } from "fumadocs-core/toc";

export interface TocTreeNode {
	readonly item: TOCItemType;
	readonly children: readonly TocTreeNode[];
}

interface MutableTocTreeNode {
	item: TOCItemType;
	children: MutableTocTreeNode[];
}

/** Flattens Fumadocs' heading list into a nested tree from `depth` values. */
export function buildTocTree(items: readonly TOCItemType[]): readonly TocTreeNode[] {
	const roots: MutableTocTreeNode[] = [];
	const stack: MutableTocTreeNode[] = [];

	for (const item of items) {
		const node: MutableTocTreeNode = { item, children: [] };

		while (stack.length > 0) {
			const parent = stack[stack.length - 1];
			if (parent === undefined || parent.item.depth < item.depth) {
				break;
			}
			stack.pop();
		}

		const parent = stack[stack.length - 1];
		if (parent === undefined) {
			roots.push(node);
		} else {
			parent.children.push(node);
		}

		stack.push(node);
	}

	return roots;
}
