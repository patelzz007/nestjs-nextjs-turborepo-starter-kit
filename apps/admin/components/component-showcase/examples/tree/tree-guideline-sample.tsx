"use client";

// The tree the Do / Don't pairs show: a headless-tree over a fixed map of rows, every folder open.

import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Tree, TreeItem, TreeItemLabel } from "@workspace/ui/components/tree";
import * as React from "react";

/** One row: its name and, for a folder, its children's ids. */
export interface GuidelineTreeRow {
	readonly name: string;
	readonly children?: readonly string[] | undefined;
}

const INDENT = 20;

export interface GuidelineTreeProps {
	readonly rows: Readonly<Record<string, GuidelineTreeRow>>;
	readonly rootId: string;
	/** The tree's accessible name; none when the example shows a nameless tree. */
	readonly label?: string | undefined;
}

export function GuidelineTree({ rows, rootId, label }: GuidelineTreeProps): React.JSX.Element {
	const lookup = React.useCallback(
		(itemId: string): GuidelineTreeRow => {
			const row = rows[itemId];
			if (row === undefined) {
				throw new Error(`Unknown tree row: ${itemId}`);
			}
			return row;
		},
		[rows],
	);
	const folders = React.useMemo((): string[] => Object.keys(rows).filter((id: string): boolean => (rows[id]?.children?.length ?? 0) > 0), [rows]);
	const tree = useTree<GuidelineTreeRow>({
		initialState: { expandedItems: folders },
		indent: INDENT,
		rootItemId: rootId,
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => (item.getItemData().children?.length ?? 0) > 0,
		dataLoader: {
			getItem: lookup,
			getChildren: (itemId: string): string[] => [...(lookup(itemId).children ?? [])],
		},
		features: [syncDataLoaderFeature, hotkeysCoreFeature],
	});
	return (
		<div className="w-full max-w-xs">
			<Tree indent={INDENT} tree={tree} aria-label={label}>
				{tree.getItems().map((item): React.JSX.Element => (
					<TreeItem key={item.getId()} item={item}>
						<TreeItemLabel />
					</TreeItem>
				))}
			</Tree>
		</div>
	);
}
