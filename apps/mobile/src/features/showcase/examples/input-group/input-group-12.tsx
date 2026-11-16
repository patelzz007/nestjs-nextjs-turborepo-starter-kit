import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

const CODES: readonly DropdownMenuItemData<string>[] = [
	{ value: "+60", label: "+60 Malaysia" },
	{ value: "+65", label: "+65 Singapore" },
	{ value: "+62", label: "+62 Indonesia" },
];

export function InputGroup12Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const [code, setCode] = React.useState<string>("+60");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leading={<DropdownMenu label={code} title="Calling code" variant="ghost" size="sm" items={CODES} onSelect={setCode} />}
			keyboardType="phone-pad"
			placeholder="12 345 6789"
			accessibilityLabel="Phone number"
		/>
	);
}
