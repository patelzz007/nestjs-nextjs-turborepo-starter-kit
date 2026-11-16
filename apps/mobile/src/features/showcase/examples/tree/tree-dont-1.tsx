import { Tree, type TreeNode } from "@workspace/ui-native/components/tree";
import * as React from "react";

const ITEMS: readonly TreeNode[] = [
	{
		value: "a",
		label: "Item",
		children: [{ value: "b", label: "Item", children: [{ value: "c", label: "Item", children: [{ value: "d", label: "Item", children: [{ value: "e", label: "Item" }] }] }] }],
	},
];
const OPEN: readonly string[] = ["a", "b", "c", "d"];

export function TreeDont1Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<string | null>(null);
	return <Tree items={ITEMS} defaultExpanded={OPEN} selected={selected} onSelect={setSelected} />;
}
