import ArchiveIcon from "lucide-react-native/icons/archive";
import PencilIcon from "lucide-react-native/icons/pencil";
import Share2Icon from "lucide-react-native/icons/share-2";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { ContextMenu } from "@workspace/ui-native/components/context-menu";
import type { DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit", icon: PencilIcon },
	{ value: "share", label: "Share", icon: Share2Icon },
	{ value: "archive", label: "Archive", icon: ArchiveIcon, group: "Manage" },
	{ value: "delete", label: "Delete", icon: Trash2Icon, variant: "destructive", group: "Manage" },
];
const AREA = "Long press here";

function Area(): React.JSX.Element {
	return (
		<View className="rounded-card h-32 items-center justify-center border border-dashed border-input">
			<Text className="text-body font-sans text-muted-foreground">{AREA}</Text>
		</View>
	);
}

export function ContextMenuDo1Example(): React.JSX.Element {
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
