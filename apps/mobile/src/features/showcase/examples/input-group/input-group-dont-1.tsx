import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroupDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <InputGroup value={value} onChange={setValue} leadingText="Amount in US dollars:" accessibilityLabel="Amount" />;
}
