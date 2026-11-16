import SearchIcon from "lucide-react-native/icons/search";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const SCOPES: readonly DropdownMenuItemData<string>[] = [
	{ value: "customers", label: "In customers" },
	{ value: "orders", label: "In orders" },
	{ value: "invoices", label: "In invoices" },
];

export function ButtonGroup20Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<string>("");
	return (
		<ButtonGroup accessibilityLabel="Search records">
			<InputGroup value={query} onChange={setQuery} leadingIcon={SearchIcon} placeholder="Search…" accessibilityLabel="Search records" className="flex-1" />
			<DropdownMenu label="Search" variant="primary" hideChevron items={SCOPES} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
