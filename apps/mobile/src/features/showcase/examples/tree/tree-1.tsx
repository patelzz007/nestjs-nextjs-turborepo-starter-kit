import { Tree, type TreeNode } from "@workspace/ui-native/components/tree";
import * as React from "react";

const ITEMS: readonly TreeNode[] = [
	{
		value: "leads",
		label: "Leads",
		children: [
			{ value: "leads/new", label: "New" },
			{ value: "leads/contacted", label: "Contacted" },
			{ value: "leads/qualified", label: "Qualified" },
		],
	},
	{
		value: "accounts",
		label: "Accounts",
		children: [
			{
				value: "accounts/active",
				label: "Active",
				children: [
					{ value: "accounts/active/enterprise", label: "Enterprise" },
					{ value: "accounts/active/smb", label: "Small business" },
				],
			},
			{ value: "accounts/churned", label: "Churned" },
		],
	},
];
const OPEN: readonly string[] = ["leads"];

export function Tree1Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<string | null>(null);
	return <Tree items={ITEMS} defaultExpanded={OPEN} selected={selected} onSelect={setSelected} />;
}
