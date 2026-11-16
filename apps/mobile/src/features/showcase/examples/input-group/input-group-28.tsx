import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "rename", label: "Rename" },
	{ value: "duplicate", label: "Duplicate" },
	{ value: "delete", label: "Delete", variant: "destructive" },
];

export function InputGroup28Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("report-q3.pdf");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			accessibilityLabel="File name"
			trailing={<DropdownMenu label="File actions" variant="ghost" size="icon" icon={EllipsisIcon} items={ACTIONS} onSelect={ignorePress} />}
		/>
	);
}
