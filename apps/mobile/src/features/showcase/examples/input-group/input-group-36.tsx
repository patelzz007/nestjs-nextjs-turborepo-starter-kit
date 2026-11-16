import { Button } from "@workspace/ui-native/components/button";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const METHODS: readonly DropdownMenuItemData<string>[] = [
	{ value: "GET", label: "GET" },
	{ value: "POST", label: "POST" },
	{ value: "PUT", label: "PUT" },
	{ value: "DELETE", label: "DELETE", variant: "destructive" },
];

export function InputGroup36Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("/v1/orders");
	const [method, setMethod] = React.useState<string>("GET");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leading={<DropdownMenu label={method} title="Method" variant="ghost" size="sm" items={METHODS} onSelect={setMethod} />}
			autoCapitalize="none"
			keyboardType="url"
			accessibilityLabel="Endpoint"
			trailing={<Button label="Send" size="xs" onPress={ignorePress} />}
		/>
	);
}
