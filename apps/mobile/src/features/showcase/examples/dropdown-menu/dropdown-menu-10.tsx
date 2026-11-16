import PlusIcon from "lucide-react-native/icons/plus";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

interface Workspace {
	readonly value: string;
	readonly name: string;
	readonly plan: string;
}

const WORKSPACES: readonly Workspace[] = [
	{ value: "acme", name: "Acme Inc.", plan: "Enterprise" },
	{ value: "studio", name: "Studio North", plan: "Pro" },
	{ value: "side", name: "Side project", plan: "Free" },
];

export function DropdownMenu10Example(): React.JSX.Element {
	const [active, setActive] = React.useState("acme");
	const current = WORKSPACES.find((workspace: Workspace): boolean => workspace.value === active);
	const items: readonly DropdownMenuItemData<string>[] = [
		...WORKSPACES.map((workspace: Workspace): DropdownMenuItemData<string> => ({
			value: workspace.value,
			label: workspace.name,
			description: workspace.plan,
			leading: <Avatar name={workspace.name} imageUrl={null} shape="rounded" size="sm" />,
			kind: "radio",
			checked: workspace.value === active,
			group: "Workspaces",
		})),
		{ value: "create", label: "Create workspace", icon: PlusIcon },
	];
	const choose = React.useCallback((value: string): void => {
		if (value === "create") {
			ignorePress();
			return;
		}
		setActive(value);
	}, []);
	return (
		<DropdownMenu
			label={current?.name ?? "Workspace"}
			leading={<Avatar name={current?.name ?? "W"} imageUrl={null} shape="rounded" size="sm" />}
			items={items}
			onSelect={choose}
		/>
	);
}
