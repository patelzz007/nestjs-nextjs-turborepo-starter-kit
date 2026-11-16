import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Input value={value} onChange={setValue} placeholder="Enter text…" accessibilityLabel="Text" />;
}
