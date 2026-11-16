import { Autocomplete } from "@workspace/ui-native/components/autocomplete";
import * as React from "react";

const ITEMS = [{ value: "Accordion" }, { value: "Alert" }, { value: "Avatar" }, { value: "Button" }];

export function AutocompleteDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Autocomplete value={value} onChange={setValue} items={ITEMS} status="Searching…" accessibilityLabel="Search" />;
}
