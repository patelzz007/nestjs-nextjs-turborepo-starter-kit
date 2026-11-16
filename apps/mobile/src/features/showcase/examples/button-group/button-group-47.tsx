import CheckIcon from "lucide-react-native/icons/check";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "conditions", label: "Approve with conditions" },
	{ value: "changes", label: "Request changes" },
	{ value: "reject", label: "Reject", variant: "destructive", group: "Danger" },
];

export function ButtonGroup47Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Review" className="self-start">
			<Button label="Approve" icon={CheckIcon} onPress={ignorePress} />
			<ButtonGroupSeparator tone="primary" />
			<DropdownMenu label="Other review actions" variant="primary" size="icon" icon={ChevronDownIcon} items={ACTIONS} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
