import { Tree, type TreeNode } from "@workspace/ui-native/components/tree";
import * as React from "react";

const ITEMS: readonly TreeNode[] = [
	{
		value: "projects",
		label: "Projects",
		children: [
			{ value: "projects.view", label: "View" },
			{ value: "projects.edit", label: "Edit" },
		],
	},
];
const OPEN: readonly string[] = ["projects"];

export function TreeDont2Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<string | null>(null);
	return <Tree items={ITEMS} defaultExpanded={OPEN} selected={selected} onSelect={setSelected} />;
}
