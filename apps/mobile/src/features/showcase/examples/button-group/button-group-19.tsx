import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import SearchIcon from "lucide-react-native/icons/search";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const SCOPES: readonly DropdownMenuItemData<string>[] = [
	{ value: "customers", label: "Customers" },
	{ value: "orders", label: "Orders" },
	{ value: "invoices", label: "Invoices" },
];

export function ButtonGroup19Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<string>("");
	return (
		<ButtonGroup accessibilityLabel="Search records">
			<InputGroup value={query} onChange={setQuery} leadingIcon={SearchIcon} placeholder="Search…" accessibilityLabel="Search records" className="flex-1" />
			<DropdownMenu label="Search scope" size="icon" icon={EllipsisVerticalIcon} items={SCOPES} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
