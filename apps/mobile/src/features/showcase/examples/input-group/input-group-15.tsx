import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup15Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("acme.com");
	return <InputGroup value={value} onChange={setValue} loading accessibilityLabel="Domain" />;
}
