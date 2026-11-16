import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import SettingsIcon from "lucide-react-native/icons/settings";
import Share2Icon from "lucide-react-native/icons/share-2";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "settings", label: "Settings", icon: SettingsIcon },
	{ value: "share", label: "Share", icon: Share2Icon },
	{ value: "remove", label: "Remove", icon: Trash2Icon, variant: "destructive" },
];

export function DropdownMenu16Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choose = React.useCallback((value: string): void => {
		setPicked(value);
	}, []);
	return (
		<View className="gap-2">
			<DropdownMenu label="More options" icon={EllipsisIcon} size="icon" variant="ghost" items={ITEMS} onSelect={choose} />
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
