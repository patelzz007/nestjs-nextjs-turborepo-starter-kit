import { ContextMenu } from "@workspace/ui-native/components/context-menu";
import type { DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "a", label: "Copy" },
	{ value: "b", label: "Copy link" },
	{ value: "c", label: "Copy text" },
	{ value: "d", label: "Copy as image" },
	{ value: "e", label: "Copy as PDF" },
	{ value: "f", label: "Copy as Markdown" },
	{ value: "g", label: "Copy as HTML" },
	{ value: "h", label: "Copy path" },
];
const AREA = "Long press here";

function Area(): React.JSX.Element {
	return (
		<View className="rounded-card h-32 items-center justify-center border border-dashed border-input">
			<Text className="text-body font-sans text-muted-foreground">{AREA}</Text>
		</View>
	);
}

export function ContextMenuDont2Example(): React.JSX.Element {
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
