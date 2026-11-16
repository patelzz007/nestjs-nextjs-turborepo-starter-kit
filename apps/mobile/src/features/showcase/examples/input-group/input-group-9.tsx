import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <InputGroup value={value} onChange={setValue} leadingText="$" trailingText="USD" keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel="Amount" />;
}
