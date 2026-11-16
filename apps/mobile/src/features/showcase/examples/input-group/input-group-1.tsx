import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <InputGroup value={value} onChange={setValue} placeholder="Type here…" accessibilityLabel="Text" />;
}
