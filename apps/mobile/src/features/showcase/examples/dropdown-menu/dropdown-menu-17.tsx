import BellIcon from "lucide-react-native/icons/bell";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "a1", label: "Your export is ready", kind: "checkbox", checked: true },
	{ value: "a2", label: "New sign-in from Chrome" },
	{ value: "a3", label: "Storage is 80% full" },
];

export function DropdownMenu17Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choose = React.useCallback((value: string): void => {
		setPicked(value);
	}, []);
	return (
		<View className="gap-2">
			<DropdownMenu label="Notifications" icon={BellIcon} size="icon" variant="ghost" items={ITEMS} onSelect={choose} />
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
