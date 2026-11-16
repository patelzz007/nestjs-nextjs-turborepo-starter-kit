import { Avatar } from "@workspace/ui-native/components/avatar";
import { Tree, type TreeNode } from "@workspace/ui-native/components/tree";
import * as React from "react";

function face(name: string): React.JSX.Element {
	return <Avatar name={name} imageUrl={null} size="sm" />;
}

const ITEMS: readonly TreeNode[] = [
	{
		value: "ceo",
		label: "Ava Patel",
		description: "Chief executive",
		leading: face("Ava Patel"),
		children: [
			{
				value: "cto",
				label: "Ben Ortiz",
				description: "Chief technology officer",
				leading: face("Ben Ortiz"),
				children: [{ value: "eng", label: "Chloe Kim", description: "Engineering lead", leading: face("Chloe Kim") }],
			},
			{ value: "cfo", label: "Dan Rossi", description: "Chief financial officer", leading: face("Dan Rossi") },
		],
	},
];
const OPEN: readonly string[] = ["ceo", "cto"];

export function Tree6Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<string | null>(null);
	return <Tree items={ITEMS} defaultExpanded={OPEN} selected={selected} onSelect={setSelected} indent="lg" guides />;
}
