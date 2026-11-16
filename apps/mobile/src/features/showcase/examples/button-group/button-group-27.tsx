import SearchIcon from "lucide-react-native/icons/search";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

const STATUSES: readonly string[] = ["Backlog", "In progress", "Completed", "Cancelled"];

export function ButtonGroup27Example(): React.JSX.Element {
	const [status, setStatus] = React.useState<string>("Completed");
	const [query, setQuery] = React.useState<string>("");
	const statuses = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			STATUSES.map((name: string): DropdownMenuItemData<string> => ({ value: name, label: name, kind: "radio", checked: name === status })),
		[status],
	);
	return (
		<ButtonGroup accessibilityLabel="Tasks">
			<DropdownMenu label={status} title="Status" items={statuses} onSelect={setStatus} />
			<InputGroup value={query} onChange={setQuery} leadingIcon={SearchIcon} placeholder="Search tasks…" accessibilityLabel="Search tasks" className="flex-1" />
		</ButtonGroup>
	);
}
