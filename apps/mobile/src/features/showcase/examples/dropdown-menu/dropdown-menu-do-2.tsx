import CopyIcon from "lucide-react-native/icons/copy";
import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import FolderInputIcon from "lucide-react-native/icons/folder-input";
import LinkIcon from "lucide-react-native/icons/link";
import PencilIcon from "lucide-react-native/icons/pencil";
import Share2Icon from "lucide-react-native/icons/share-2";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit", icon: PencilIcon },
	{ value: "duplicate", label: "Duplicate", icon: CopyIcon },
	{
		value: "move",
		label: "Move to",
		icon: FolderInputIcon,
		items: [
			{ value: "move:inbox", label: "Inbox" },
			{ value: "move:archive", label: "Archive" },
		],
	},
	{ value: "share", label: "Share", icon: Share2Icon },
	{ value: "copy-link", label: "Copy link", icon: LinkIcon },
	{ value: "delete", label: "Delete", icon: Trash2Icon, variant: "destructive", group: "Danger" },
];

export function DropdownMenuDo2Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choose = React.useCallback((value: string): void => {
		setPicked(value);
	}, []);
	return (
		<View className="gap-2">
			<DropdownMenu label="Record actions" icon={EllipsisVerticalIcon} size="icon" items={ITEMS} onSelect={choose} />
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Nothing chosen yet." : `Chose: ${picked}`}</Text>
		</View>
	);
}
