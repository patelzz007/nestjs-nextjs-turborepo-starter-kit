import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <InputGroup value={value} onChange={setValue} trailingText="@acme.com" placeholder="username" autoCapitalize="none" accessibilityLabel="Username" />;
}
