import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "profile", label: "Profile", shortcut: ["⇧", "⌘", "P"] },
	{ value: "billing", label: "Billing", shortcut: ["⌘", "B"] },
	{ value: "settings", label: "Settings", shortcut: ["⌘", ","] },
	{ value: "shortcuts", label: "Keyboard shortcuts", shortcut: ["⌘", "K"] },
];

export function DropdownMenu4Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choose = React.useCallback((value: string): void => {
		setPicked(value);
	}, []);
	return (
		<View className="gap-2">
			<DropdownMenu label="Open menu" items={ITEMS} onSelect={choose} />
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
