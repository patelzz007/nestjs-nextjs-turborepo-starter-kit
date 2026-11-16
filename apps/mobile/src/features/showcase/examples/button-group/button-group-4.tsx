import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const TARGETS: readonly DropdownMenuItemData<string>[] = [
	{ value: "production", label: "Production" },
	{ value: "staging", label: "Staging" },
	{ value: "development", label: "Development" },
];

export function ButtonGroup4Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Deploy" className="self-start">
			<Button label="Update" variant="outline" onPress={ignorePress} />
			<DropdownMenu label="Deploy target" title="Deploy to" size="icon" icon={ChevronDownIcon} items={TARGETS} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
