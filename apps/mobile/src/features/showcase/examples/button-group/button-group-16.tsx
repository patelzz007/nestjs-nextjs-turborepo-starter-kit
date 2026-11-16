import FunnelIcon from "lucide-react-native/icons/funnel";
import XIcon from "lucide-react-native/icons/x";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

const SCOPES: readonly string[] = ["All", "Customers", "Orders", "Invoices"];

export function ButtonGroup16Example(): React.JSX.Element {
	const [scope, setScope] = React.useState<string>("All");
	const [query, setQuery] = React.useState<string>("");
	const scopes = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			SCOPES.map((name: string): DropdownMenuItemData<string> => ({ value: name, label: name, kind: "radio", checked: name === scope })),
		[scope],
	);
	const clear = React.useCallback((): void => {
		setQuery("");
	}, []);
	return (
		<ButtonGroup accessibilityLabel="Filter records">
			<DropdownMenu label={scope} title="Search in" icon={FunnelIcon} items={scopes} onSelect={setScope} />
			<Input value={query} onChange={setQuery} placeholder="Search…" accessibilityLabel="Search records" className="flex-1" />
			<IconButton icon={XIcon} label="Clear the search" onPress={clear} className="h-12 w-12" />
		</ButtonGroup>
	);
}
