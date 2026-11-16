import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import FunnelIcon from "lucide-react-native/icons/funnel";
import SearchIcon from "lucide-react-native/icons/search";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const FILTERS: readonly DropdownMenuItemData<string>[] = [
	{ value: "active", label: "Active", trailing: "128" },
	{ value: "invited", label: "Invited", trailing: "12" },
	{ value: "archived", label: "Archived", trailing: "40" },
];

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "import", label: "Import" },
	{ value: "export", label: "Export" },
];

export function InputGroup39Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leadingIcon={SearchIcon}
			placeholder="Search contacts"
			accessibilityLabel="Search contacts"
			trailing={
				<>
					<DropdownMenu label="Filter" size="icon" icon={FunnelIcon} items={FILTERS} onSelect={ignorePress} />
					<DropdownMenu label="Contact actions" size="icon" icon={EllipsisIcon} variant="ghost" items={ACTIONS} onSelect={ignorePress} />
				</>
			}
		/>
	);
}
