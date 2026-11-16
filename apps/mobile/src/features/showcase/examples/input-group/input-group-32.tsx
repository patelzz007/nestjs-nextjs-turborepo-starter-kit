import { Avatar } from "@workspace/ui-native/components/avatar";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

const ROLES: readonly DropdownMenuItemData<string>[] = [
	{ value: "Admin", label: "Admin" },
	{ value: "Editor", label: "Editor" },
	{ value: "Viewer", label: "Viewer" },
];

export function InputGroup32Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("avery@acme.com");
	const [role, setRole] = React.useState<string>("Admin");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leading={<Avatar name="Avery Chen" imageUrl={null} size="sm" />}
			accessibilityLabel="Member"
			trailing={<DropdownMenu label={role} title="Role" size="sm" items={ROLES} onSelect={setRole} />}
		/>
	);
}
