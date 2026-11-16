import CopyIcon from "lucide-react-native/icons/copy";
import PencilIcon from "lucide-react-native/icons/pencil";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { Button } from "@workspace/ui-native/components/button";
import { ContextMenu } from "@workspace/ui-native/components/context-menu";
import type { DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Dialog, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const AREA = "Long press here";

function Area(): React.JSX.Element {
	return (
		<View className="rounded-card h-32 items-center justify-center border border-dashed border-input">
			<Text className="text-body font-sans text-muted-foreground">{AREA}</Text>
		</View>
	);
}
const TITLE = "Edit image";
const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit", icon: PencilIcon },
	{ value: "copy", label: "Copy", icon: CopyIcon },
	{
		value: "more",
		label: "More options",
		items: [
			{ value: "crop", label: "Crop" },
			{ value: "rotate", label: "Rotate" },
		],
	},
	{ value: "delete", label: "Delete", icon: Trash2Icon, variant: "destructive", group: "Danger" },
];

export function ContextMenu10Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	return (
		<>
			<Button label="Open dialog" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen} showCloseButton>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
				</DialogHeader>
				<ContextMenu title="Image" items={ITEMS} onSelect={ignorePress}>
					<Area />
				</ContextMenu>
			</Dialog>
		</>
	);
}
