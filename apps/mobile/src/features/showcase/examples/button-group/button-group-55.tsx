import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const OPTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "schedule", label: "Schedule release" },
	{ value: "cancel", label: "Cancel payout", variant: "destructive" },
];

export function ButtonGroup55Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-2">
			<ButtonGroup accessibilityLabel="Payout of USD 12,480">
				<ButtonGroupText label="USD 12,480" variant="muted" />
				<Button label="Hold" variant="outline" onPress={ignorePress} />
			</ButtonGroup>
			<ButtonGroup accessibilityLabel="Release">
				<Button label="Release" onPress={ignorePress} />
				<ButtonGroupSeparator tone="primary" />
				<DropdownMenu label="Release options" variant="primary" size="icon" icon={ChevronDownIcon} items={OPTIONS} onSelect={ignorePress} />
			</ButtonGroup>
		</View>
	);
}
