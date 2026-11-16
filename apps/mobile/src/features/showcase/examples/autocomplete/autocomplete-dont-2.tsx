import { Autocomplete } from "@workspace/ui-native/components/autocomplete";
import * as React from "react";

export function AutocompleteDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Autocomplete value={value} onChange={setValue} items={[]} filter={null} accessibilityLabel="Search" />;
}
