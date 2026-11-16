import ArrowUpDownIcon from "lucide-react-native/icons/arrow-up-down";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import FunnelIcon from "lucide-react-native/icons/funnel";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";

import { ignorePress } from "../example-support";

const MORE: readonly DropdownMenuItemData<string>[] = [
	{ value: "link", label: "Copy link" },
	{ value: "share", label: "Share" },
	{ value: "export", label: "Export" },
];

export function ButtonGroup50Example(): React.JSX.Element {
	return (
		<ButtonGroup variant="separated" size="sm" accessibilityLabel="Toolbar" className="items-center self-start">
			<IconButton icon={FunnelIcon} label="Filter" size="sm" onPress={ignorePress} />
			<IconButton icon={ArrowUpDownIcon} label="Sort" size="sm" onPress={ignorePress} />
			<Separator orientation="vertical" className="h-6" />
			<DropdownMenu label="More" size="icon" icon={EllipsisIcon} items={MORE} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
