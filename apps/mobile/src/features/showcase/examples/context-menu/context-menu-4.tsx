import { ContextMenu } from "@workspace/ui-native/components/context-menu";
import type { DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "copy", label: "Copy", shortcut: ["⌘", "C"] },
	{ value: "paste", label: "Paste", shortcut: ["⌘", "V"] },
	{
		value: "tools",
		label: "More tools",
		items: [
			{ value: "save", label: "Save page", group: "Page" },
			{ value: "shortcut", label: "Create shortcut", group: "Page" },
			{ value: "devtools", label: "Developer tools", group: "Develop" },
			{ value: "delete", label: "Delete", variant: "destructive", group: "Danger" },
		],
	},
];
const AREA = "Long press here";

function Area(): React.JSX.Element {
	return (
		<View className="rounded-card h-32 items-center justify-center border border-dashed border-input">
			<Text className="text-body font-sans text-muted-foreground">{AREA}</Text>
		</View>
	);
}

export function ContextMenu4Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	return (
		<View className="gap-2">
			<ContextMenu title="Page" items={ITEMS} onSelect={setPicked}>
				<Area />
			</ContextMenu>
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
