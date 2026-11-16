import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const OPTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "schedule", label: "Schedule" },
	{ value: "unlisted", label: "Publish unlisted" },
];

const MORE: readonly DropdownMenuItemData<string>[] = [
	{ value: "duplicate", label: "Duplicate" },
	{ value: "delete", label: "Delete", variant: "destructive" },
];

export function ButtonGroup53Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center gap-2">
			<View className="flex-row">
				<Avatar name="Avery Chen" imageUrl={null} size="md" />
				<Avatar name="Jordan Lee" imageUrl={null} size="md" className="-ml-2" />
			</View>
			<Button label="Preview" variant="outline" size="sm" onPress={ignorePress} />
			<ButtonGroup size="sm" accessibilityLabel="Publish">
				<Button label="Publish" size="sm" onPress={ignorePress} />
				<ButtonGroupSeparator tone="primary" />
				<DropdownMenu label="Publish options" variant="primary" size="sm" hideChevron icon={ChevronDownIcon} items={OPTIONS} onSelect={ignorePress} />
			</ButtonGroup>
			<DropdownMenu label="More" variant="ghost" size="icon" icon={EllipsisIcon} items={MORE} onSelect={ignorePress} />
		</View>
	);
}
