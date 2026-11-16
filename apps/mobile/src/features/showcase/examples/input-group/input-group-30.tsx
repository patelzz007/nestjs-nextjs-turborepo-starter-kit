import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup30Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("240.00");
	return <InputGroup value={value} onChange={setValue} leadingText="€" trailingText="EUR" variant="filled" keyboardType="decimal-pad" accessibilityLabel="Amount" />;
}
