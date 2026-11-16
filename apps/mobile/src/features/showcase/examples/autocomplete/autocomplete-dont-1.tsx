import { Autocomplete } from "@workspace/ui-native/components/autocomplete";
import { Field } from "@workspace/ui-native/components/field";
import * as React from "react";

const ITEMS = [{ value: "Accordion" }, { value: "Alert" }, { value: "Avatar" }, { value: "Button" }];

export function AutocompleteDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Country (must be listed)">
			<Autocomplete value={value} onChange={setValue} items={ITEMS} />
		</Field>
	);
}
