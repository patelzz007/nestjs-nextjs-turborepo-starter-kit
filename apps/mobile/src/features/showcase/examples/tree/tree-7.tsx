import { Tree, type TreeNode } from "@workspace/ui-native/components/tree";
import * as React from "react";

const ITEMS: readonly TreeNode[] = [
	{
		value: "projects",
		label: "Projects",
		children: [
			{ value: "projects.view", label: "View" },
			{ value: "projects.edit", label: "Edit" },
			{ value: "projects.delete", label: "Delete" },
		],
	},
	{
		value: "billing",
		label: "Billing",
		children: [
			{ value: "billing.view", label: "View invoices" },
			{ value: "billing.pay", label: "Pay invoices" },
		],
	},
	{
		value: "members",
		label: "Members",
		children: [
			{ value: "members.invite", label: "Invite" },
			{ value: "members.remove", label: "Remove" },
		],
	},
];
const OPEN: readonly string[] = ["projects", "billing"];
const GRANTED: readonly string[] = ["projects.view", "projects.edit", "billing.view", "members.invite", "members.remove"];

export function Tree7Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<readonly string[]>(GRANTED);
	return <Tree items={ITEMS} defaultExpanded={OPEN} checked={checked} onCheckedChange={setChecked} toggle="plus" accessibilityLabel="Role permissions" />;
}
