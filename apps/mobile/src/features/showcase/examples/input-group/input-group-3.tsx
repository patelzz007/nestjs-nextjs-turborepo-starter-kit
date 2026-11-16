import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <InputGroup value={value} onChange={setValue} invalid placeholder="Enter a value" accessibilityLabel="Value" />;
}
