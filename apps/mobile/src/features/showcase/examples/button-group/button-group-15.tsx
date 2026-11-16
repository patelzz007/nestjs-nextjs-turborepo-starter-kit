import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import StarIcon from "lucide-react-native/icons/star";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "watch", label: "Watch" },
	{ value: "fork", label: "Fork" },
	{ value: "report", label: "Report", variant: "destructive", group: "Danger" },
];

export function ButtonGroup15Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Star, 2.4k stars" className="self-start">
			<Button label="Star" variant="outline" icon={StarIcon} trailing={<Badge label="2.4k" size="sm" />} onPress={ignorePress} />
			<DropdownMenu label="Repository actions" size="icon" icon={ChevronDownIcon} items={ACTIONS} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
