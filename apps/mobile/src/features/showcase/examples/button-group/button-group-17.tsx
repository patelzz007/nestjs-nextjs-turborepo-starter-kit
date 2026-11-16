import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "pin", label: "Pin" },
	{ value: "rename", label: "Rename" },
	{ value: "mute", label: "Mute" },
	{ value: "archive", label: "Archive" },
	{ value: "export", label: "Export" },
	{ value: "share", label: "Share" },
	{ value: "delete", label: "Delete conversation", variant: "destructive", group: "Danger" },
];

export function ButtonGroup17Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Conversation" className="self-start">
			<Button label="Conversation" variant="outline" onPress={ignorePress} />
			<DropdownMenu label="Conversation actions" size="icon" icon={EllipsisVerticalIcon} items={ACTIONS} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
