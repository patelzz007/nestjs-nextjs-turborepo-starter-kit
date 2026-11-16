import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup7Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup value={value} onChange={setValue} leadingText="https://" placeholder="example.com" keyboardType="url" autoCapitalize="none" accessibilityLabel="Domain" />
	);
}
