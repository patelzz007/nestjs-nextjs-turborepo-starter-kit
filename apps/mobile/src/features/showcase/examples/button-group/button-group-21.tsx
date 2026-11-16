import FileIcon from "lucide-react-native/icons/file";
import PlusIcon from "lucide-react-native/icons/plus";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const CREATE: readonly DropdownMenuItemData<string>[] = [
	{ value: "file", label: "New file" },
	{ value: "folder", label: "New folder" },
	{ value: "workspace", label: "New workspace" },
];

export function ButtonGroup21Example(): React.JSX.Element {
	const [name, setName] = React.useState<string>("report-q3.pdf");
	return (
		<ButtonGroup accessibilityLabel="File name">
			<InputGroup value={name} onChange={setName} leadingIcon={FileIcon} accessibilityLabel="File name" className="flex-1" />
			<DropdownMenu label="Create" size="icon" icon={PlusIcon} items={CREATE} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
