import ClipboardIcon from "lucide-react-native/icons/clipboard";
import CopyIcon from "lucide-react-native/icons/copy";
import ScissorsIcon from "lucide-react-native/icons/scissors";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { ContextMenu } from "@workspace/ui-native/components/context-menu";
import type { DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "copy", label: "Copy", icon: CopyIcon },
	{ value: "cut", label: "Cut", icon: ScissorsIcon },
	{ value: "paste", label: "Paste", icon: ClipboardIcon },
	{ value: "delete", label: "Delete", icon: Trash2Icon, variant: "destructive", group: "Danger" },
];
const AREA = "Long press here";

function Area(): React.JSX.Element {
	return (
		<View className="rounded-card h-32 items-center justify-center border border-dashed border-input">
			<Text className="text-body font-sans text-muted-foreground">{AREA}</Text>
		</View>
	);
}

export function ContextMenu2Example(): React.JSX.Element {
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
