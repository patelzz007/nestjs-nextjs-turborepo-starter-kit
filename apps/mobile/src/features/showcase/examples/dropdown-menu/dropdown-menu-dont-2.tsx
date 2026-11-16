import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit" },
	{ value: "share", label: "Share" },
];

export function DropdownMenuDont2Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choose = React.useCallback((value: string): void => {
		setPicked(value);
	}, []);
	return (
		<View className="gap-2">
			<DropdownMenu label="" icon={EllipsisVerticalIcon} size="icon" items={ITEMS} onSelect={choose} />
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
