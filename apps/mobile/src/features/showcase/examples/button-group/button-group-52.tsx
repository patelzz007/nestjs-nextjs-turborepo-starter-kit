import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import RefreshCwIcon from "lucide-react-native/icons/refresh-cw";
import Share2Icon from "lucide-react-native/icons/share-2";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

const MORE: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit dashboard" },
	{ value: "csv", label: "Export CSV", group: "Export" },
	{ value: "png", label: "Export PNG", group: "Export" },
];

export function ButtonGroup52Example(): React.JSX.Element {
	return (
		<ButtonGroup variant="separated" accessibilityLabel="Dashboard" className="self-start">
			<IconButton icon={RefreshCwIcon} label="Refresh" onPress={ignorePress} />
			<Button label="Share" variant="outline" icon={Share2Icon} onPress={ignorePress} />
			<DropdownMenu label="More" size="icon" icon={EllipsisIcon} items={MORE} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
