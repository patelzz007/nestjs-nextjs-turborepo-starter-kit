import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const OPTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "publish", label: "Save and publish" },
	{ value: "draft", label: "Save as draft" },
	{ value: "exit", label: "Save and exit" },
];

export function ButtonGroup39Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Save" className="self-start">
			<Button label="Save" onPress={ignorePress} />
			<ButtonGroupSeparator tone="primary" />
			<DropdownMenu label="More save options" variant="primary" size="icon" icon={ChevronDownIcon} items={OPTIONS} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
