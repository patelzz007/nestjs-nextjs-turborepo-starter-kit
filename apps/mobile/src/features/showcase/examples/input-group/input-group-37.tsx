import SearchIcon from "lucide-react-native/icons/search";
import XIcon from "lucide-react-native/icons/x";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

const STATUSES: readonly DropdownMenuItemData<string>[] = [
	{ value: "All", label: "All" },
	{ value: "Paid", label: "Paid" },
	{ value: "Refunded", label: "Refunded" },
];

export function InputGroup37Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const [status, setStatus] = React.useState<string>("All");
	const clear = React.useCallback((): void => {
		setValue("");
	}, []);
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leadingIcon={SearchIcon}
			placeholder="Search orders"
			accessibilityLabel="Search orders"
			trailing={
				<>
					{value.length > 0 ? <IconButton icon={XIcon} label="Clear" variant="ghost" size="xs" onPress={clear} /> : null}
					<DropdownMenu label={status} title="Status" size="sm" items={STATUSES} onSelect={setStatus} />
				</>
			}
		/>
	);
}
